import '../src/styles.css';
import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { App } from '../src/core/App';
import { startWithErrorBoundary } from '../src/core/startup';
import { GpuParticleSystem } from '../src/atmosphere/GpuParticleSystem';

// Development-only fault injection exercises the real startup and error UI.
const result = document.querySelector('#result')!;
window.addEventListener('unhandledrejection', () => { result.textContent = 'FAIL: unhandled rejection'; });
async function check(): Promise<void> {
  if (!WebGPU.isAvailable()) { result.textContent = 'SKIP: WebGPU unavailable'; return; }
  const computeFailure = new URLSearchParams(location.search).get('stage') === 'compute';
  const originalInit = THREE.WebGPURenderer.prototype.init;
  const originalCompute = GpuParticleSystem.prototype.initialize;
  const failure = new Error('Simulated GPU startup failure');
  if (computeFailure) GpuParticleSystem.prototype.initialize = async () => { throw failure; };
  else THREE.WebGPURenderer.prototype.init = async () => { throw failure; };
  try {
    const container = document.querySelector<HTMLElement>('#app')!;
    const app = new App(container);
    const started = await startWithErrorBoundary(() => app.start(), error => app.showInitializationError(error));
    if (started || container.querySelector('canvas') || !container.querySelector('[role="alert"]')?.textContent?.includes('could not start')) {
      throw new Error('Startup did not replace the canvas with its error alert');
    }
    result.textContent = `PASS: ${computeFailure ? 'compute' : 'renderer'} failure displays the startup alert`;
  } finally {
    THREE.WebGPURenderer.prototype.init = originalInit;
    GpuParticleSystem.prototype.initialize = originalCompute;
  }
}
void check().catch(error => { result.textContent = `FAIL: ${error.message}`; });
