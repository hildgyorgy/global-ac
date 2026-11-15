import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { Fn, instanceIndex, instancedArray, mix, hash, PI2 } from 'three/tsl';
import { jetEastwardSpeedNode, jetTracerSeedNode } from '../src/atmosphere/JetStreamsNode';
import { sampleJetEastwardSpeed, JET_STREAMS_MODEL as model } from '../src/atmosphere/JetStreamsModel';
import { CONFIG } from '../src/config';
import { CORIOLIS_MODEL, zonalCoriolisAcceleration, coriolisVisualScale } from '../src/atmosphere/CoriolisModel';
import { sampleHadleyModel, normalizeTemperatureKelvin } from '../src/atmosphere/HadleyModel';
import { sampleHadleyField } from '../src/atmosphere/HadleyFieldNode';
import { zonalCoriolisAccelerationNode, coriolisVisualScaleNode } from '../src/atmosphere/CoriolisNode';

// One-time verification only. The production simulation never reads tracer
// buffers back to the CPU. Serve this page with the local Vite dev server.
async function check(): Promise<void> {
  if (!WebGPU.isAvailable()) throw new Error('WebGPU is required for this check.');
  const cases: number[][] = [];
  for (const degrees of [-90, -75, -60, -45, -30, -15, -.001, 0, .001, 15, 30, 45, 60, 75, 90]) {
    for (const altitude of [0, .2, .55, .7, .78, .86, .96, 1]) {
      for (const strength of [0, .5, 1]) {
        for (const eastward of [-.2, 0, .2]) {
          cases.push([degrees * Math.PI / 180, altitude, eastward, .04, -.02, strength]);
        }
      }
    }
  }
  const a = new Float32Array(cases.length * 4), b = new Float32Array(cases.length * 4);
  cases.forEach((values, i) => {
    a.set(values.slice(0, 4), i * 4); b.set(values.slice(4), i * 4);
  });
  const inputsA = instancedArray(a, 'vec4'), inputsB = instancedArray(b, 'vec4');
  const output = instancedArray(cases.length, 'float');
  const dragOutput = instancedArray(cases.length, 'float');
  const fieldOutput = instancedArray(cases.length, 'vec4');
  const coriolisOutput = instancedArray(cases.length, 'vec2');
  const compute = Fn(() => {
    const v = inputsA.element(instanceIndex), w = inputsB.element(instanceIndex);
    output.element(instanceIndex).assign(jetEastwardSpeedNode(v.x, v.y, v.z, v.w, w.x, w.y));
    fieldOutput.element(instanceIndex).assign(sampleHadleyField(v.x, v.y));
    coriolisOutput.element(instanceIndex).x.assign(zonalCoriolisAccelerationNode(v.x, v.w));
    coriolisOutput.element(instanceIndex).y.assign(coriolisVisualScaleNode(v.x));
    dragOutput.element(instanceIndex).assign(mix(CORIOLIS_MODEL.switchOffDrag, CORIOLIS_MODEL.drag, w.y));
  })().compute(cases.length);
  const renderer = new THREE.WebGPURenderer();
  const seeds = instancedArray(model.extraTracerCount, 'vec2');
  const seedCompute = Fn(() => {
    seeds.element(instanceIndex).assign(jetTracerSeedNode(instanceIndex.mod(4).toFloat(),
      hash(instanceIndex.toFloat().add(71)).mul(PI2), hash(instanceIndex.toFloat().add(89)).sqrt()));
  })().compute(model.extraTracerCount);
  try {
    await renderer.init();
    await renderer.computeAsync(compute);
    const actual = new Float32Array(await renderer.getArrayBufferAsync(output.value));
    const drag = new Float32Array(await renderer.getArrayBufferAsync(dragOutput.value));
    const fields = new Float32Array(await renderer.getArrayBufferAsync(fieldOutput.value));
    const coriolis = new Float32Array(await renderer.getArrayBufferAsync(coriolisOutput.value));
    let maxError = 0;
    for (let i = 0; i < cases.length; i++) {
      const j = i * 4;
      const expected = sampleJetEastwardSpeed(a[j], a[j + 1],
        { eastward: a[j + 2], northward: a[j + 3], radial: b[j] }, b[j + 1]);
      const reference = sampleHadleyModel(a[j], a[j + 1]);
      const expectedField = [reference.latitudeVelocity, reference.longitudeVelocity,
        reference.altitudeVelocity, normalizeTemperatureKelvin(reference.temperatureKelvin)];
      expectedField.forEach((value, component) => {
        if (!Number.isFinite(fields[j + component]) || Math.abs(value - fields[j + component]) > 1e-5) {
          throw new Error(`Circulation/temperature GPU mismatch at case ${i}, component ${component}`);
        }
      });
      const expectedCoriolis = [zonalCoriolisAcceleration(a[j], a[j + 3]), coriolisVisualScale(a[j])];
      expectedCoriolis.forEach((value, component) => {
        if (!Number.isFinite(coriolis[i * 2 + component]) || Math.abs(value - coriolis[i * 2 + component]) > 1e-5) {
          throw new Error(`Coriolis GPU mismatch at case ${i}, component ${component}`);
        }
      });
      const error = Math.abs(expected - actual[i]);
      if (!Number.isFinite(actual[i]) || error > 1e-5) {
        throw new Error(`GPU mismatch at case ${i}: ${actual[i]} vs ${expected}`);
      }
      maxError = Math.max(maxError, error);
      const expectedDrag = CORIOLIS_MODEL.switchOffDrag
        + (CORIOLIS_MODEL.drag - CORIOLIS_MODEL.switchOffDrag) * b[j + 1];
      if (!(drag[i] > 0) || Math.abs(drag[i] - expectedDrag) > 1e-5) {
        throw new Error(`Non-damping or incorrect Coriolis switch response at case ${i}`);
      }
    }
    await renderer.computeAsync(seedCompute);
    const seeded = new Float32Array(await renderer.getArrayBufferAsync(seeds.value));
    for (let i = 0; i < model.extraTracerCount; i++) {
      const slot = i % 4, band = model.bands[slot < 2 ? 0 : 1];
      const latitude = seeded[i * 2], altitude = seeded[i * 2 + 1];
      const centreLatitude = band.latitude * (slot % 2 ? -1 : 1);
      const thickness = CONFIG.atmosphere.polarShellThickness
        + (CONFIG.atmosphere.equatorialShellThickness - CONFIG.atmosphere.polarShellThickness)
        * Math.cos(centreLatitude) ** 2;
      const radius = CONFIG.earth.radius + .018 + band.coreAltitude * thickness;
      const offset = Math.hypot((latitude - centreLatitude) * radius,
        (altitude - band.coreAltitude) * thickness);
      if (!Number.isFinite(offset) || offset > model.tracerCrossSectionRadius + 1e-6
        || altitude < .04 || altitude > .96 || Math.sign(latitude) !== Math.sign(centreLatitude)) {
        throw new Error(`Invalid jet seed at ${i}`);
      }
    }
    document.getElementById('result')!.textContent = `PASS: ${cases.length} circulation/Coriolis/jet GPU-reference cases, ${model.extraTracerCount} jet seeds; max error ${maxError}`;
  } finally { renderer.dispose(); }
}

check().catch(error => { document.getElementById('result')!.textContent = `FAIL: ${error.message}`; });
