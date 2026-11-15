import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { Fn, instanceIndex, instancedArray, mix } from 'three/tsl';
import { jetEastwardSpeedNode } from '../src/atmosphere/JetStreamsNode';
import { sampleJetEastwardSpeed } from '../src/atmosphere/JetStreamsModel';
import { CORIOLIS_MODEL } from '../src/atmosphere/CoriolisModel';

// One-time verification only. The production simulation never reads tracer
// buffers back to the CPU. Serve this page with the local Vite dev server.
async function check(): Promise<void> {
  if (!WebGPU.isAvailable()) throw new Error('WebGPU is required for this check.');
  const cases: number[][] = [];
  for (const degrees of [-90, -55, -30, 0, 30, 55, 90]) {
    for (const altitude of [.2, .55, .7, .84, .96]) {
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
  const compute = Fn(() => {
    const v = inputsA.element(instanceIndex), w = inputsB.element(instanceIndex);
    output.element(instanceIndex).assign(jetEastwardSpeedNode(v.x, v.y, v.z, v.w, w.x, w.y));
    dragOutput.element(instanceIndex).assign(mix(CORIOLIS_MODEL.switchOffDrag, CORIOLIS_MODEL.drag, w.y));
  })().compute(cases.length);
  const renderer = new THREE.WebGPURenderer();
  try {
    await renderer.init();
    await renderer.computeAsync(compute);
    const actual = new Float32Array(await renderer.getArrayBufferAsync(output.value));
    const drag = new Float32Array(await renderer.getArrayBufferAsync(dragOutput.value));
    let maxError = 0;
    for (let i = 0; i < cases.length; i++) {
      const j = i * 4;
      const expected = sampleJetEastwardSpeed(a[j], a[j + 1],
        { eastward: a[j + 2], northward: a[j + 3], radial: b[j] }, b[j + 1]);
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
    document.getElementById('result')!.textContent = `PASS: ${cases.length} GPU/reference cases; max error ${maxError}`;
  } finally { renderer.dispose(); }
}

check().catch(error => { document.getElementById('result')!.textContent = `FAIL: ${error.message}`; });
