import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { Fn, instanceIndex, instancedArray } from 'three/tsl';
import { ANTICYCLONE_MODEL as model, sampleAnticyclone } from '../src/atmosphere/AnticycloneModel';
import { sampleAnticycloneNode } from '../src/atmosphere/AnticycloneNode';
import { geographicLongitude, particleLongitude } from '../src/atmosphere/geometry';
import { geographicLongitudeNode } from '../src/atmosphere/GeometryNode';

// Development-only readback; production particles remain GPU-resident.
async function check(): Promise<void> {
  if (!WebGPU.isAvailable()) throw new Error('WebGPU is required for this check.');
  const cases: number[][] = [];
  for (const latitude of [
    -Math.PI / 2,
    0,
    model.latitude - model.outerRadius,
    model.latitude - model.coreRadius,
    model.latitude,
    model.latitude + model.coreRadius,
    model.latitude + model.outerRadius,
    Math.PI / 2,
  ]) {
    for (const longitude of [
      -Math.PI,
      model.longitude - 2 * Math.PI,
      model.longitude - 0.4,
      model.longitude,
      model.longitude + 0.4,
      0,
      Math.PI,
    ]) {
      for (const altitude of [0, 0.1, 0.5, 0.75, 0.94, 1]) {
        for (const strength of [0, 0.5, 1]) {
          cases.push([latitude, particleLongitude(longitude), altitude, strength]);
        }
      }
    }
  }
  const inputs = instancedArray(new Float32Array(cases.flat()), 'vec4');
  const output = instancedArray(cases.length, 'vec4');
  const compute = Fn(() => {
    const p = inputs.element(instanceIndex);
    output
      .element(instanceIndex)
      .assign(
        sampleAnticycloneNode(
          p.x,
          geographicLongitudeNode(p.y),
          p.z,
          new THREE.Vector3(0.04, -0.03, 0.02),
          p.w,
        ),
      );
  })().compute(cases.length);
  const renderer = new THREE.WebGPURenderer();
  try {
    await renderer.init();
    await renderer.computeAsync(compute);
    const actual = new Float32Array(await renderer.getArrayBufferAsync(output.value));
    const roundedInputs = new Float32Array(cases.flat());
    let maxError = 0;
    cases.forEach((_, index) => {
      const p = roundedInputs.subarray(index * 4, index * 4 + 4);
      const expected = sampleAnticyclone(
        p[0],
        geographicLongitude(p[1]),
        p[2],
        { eastward: 0.04, northward: -0.03, altitudeVelocity: 0.02 },
        p[3],
      );
      [
        expected.eastward,
        expected.northward,
        expected.altitudeVelocity,
        expected.influence,
      ].forEach((value, component) => {
        const error = Math.abs(value - actual[index * 4 + component]);
        if (!Number.isFinite(error) || error > 1e-5) {
          throw new Error(`Anticyclone GPU mismatch at case ${index}, component ${component}`);
        }
        maxError = Math.max(maxError, error);
      });
    });
    document.querySelector('#result')!.textContent =
      `PASS: ${cases.length} anticyclone GPU/reference cases; max error ${maxError}`;
  } finally {
    renderer.dispose();
  }
}

void check().catch((error) => {
  document.querySelector('#result')!.textContent = `FAIL: ${error.message}`;
});
