import * as THREE from 'three/webgpu';
import type { ComputeNode, Node, StorageBufferNode } from 'three/webgpu';
import {
  Fn, If, Loop, color, float, instanceIndex, instancedArray,
  mix, uniform, varying, vec4, vertexIndex,
} from 'three/tsl';
import { cellFocusNode } from './CellSelectionNode';

const STRIDE = 24;
const SAMPLES = 24;
const SAMPLE_INTERVAL = 0.075;

/** Short, Earth-relative motion histories for every 24th tracer.
 * One GPU invocation owns an entire trail: shifting samples has no data races.
 */
export class GpuParticleTrails extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicNodeMaterial> {
  private readonly initializeNode: ComputeNode;
  private readonly updateNode: ComputeNode;
  private readonly sampleNow;
  private previousTime = 0;
  private sampleAccumulator = 0;

  constructor(
    particleCount: number,
    positions: StorageBufferNode<'vec4'>,
    velocities: StorageBufferNode<'vec4'>,
    sliceHalfWidth: Node<'float'>,
    spinAngle: Node<'float'>,
    sectionBrightness: Node<'float'>,
    selectedCell: Node<'float'>,
  ) {
    const trailCount = Math.ceil(particleCount / STRIDE);
    const history = instancedArray(trailCount * SAMPLES, 'vec4').setName('trailHistory');
    const previousLife = instancedArray(trailCount, 'float').setName('trailPreviousLife');
    const sampleNow = uniform(0);

    const initializeNode = Fn(() => {
      const particle = instanceIndex.mul(STRIDE);
      const point = vec4(positions.element(particle).xyz, velocities.element(particle).w);
      const base = instanceIndex.toInt().mul(SAMPLES);
      Loop(SAMPLES, ({ i }) => { history.element(base.add(i)).assign(point); });
      previousLife.element(instanceIndex).assign(positions.element(particle).w);
    })().compute(trailCount).setName('InitializeParticleTrails');

    const updateNode = Fn(() => {
      const particle = instanceIndex.mul(STRIDE);
      const position = positions.element(particle);
      const point = vec4(position.xyz, velocities.element(particle).w);
      const base = instanceIndex.toInt().mul(SAMPLES);
      const lastLife = previousLife.element(instanceIndex);
      // Respawning increases life. Clear every sample before the draw, even
      // between sample ticks, so a teleport never creates a connecting streak.
      If(position.w.greaterThan(lastLife), () => {
        Loop(SAMPLES, ({ i }) => { history.element(base.add(i)).assign(point); });
      }).Else(() => {
        If(sampleNow.greaterThan(0), () => {
          Loop({ type: 'int', start: SAMPLES - 1, end: 0, condition: '>', update: '--' }, ({ i }) => {
            history.element(base.add(i)).assign(history.element(base.add(i).sub(1)));
          });
          history.element(base).assign(point);
        });
      });
      lastLife.assign(position.w);
    })().compute(trailCount).setName('UpdateParticleTrails');

    const segment = vertexIndex.div(2);
    const trail = segment.div(SAMPLES);
    const age = segment.mod(SAMPLES).add(vertexIndex.mod(2)).toInt().sub(1);
    const particle = trail.mul(STRIDE);
    const trailPoint = Fn(() => {
      const result = vec4(positions.element(particle).xyz, velocities.element(particle).w).toVar();
      If(age.greaterThanEqual(0), () => {
        result.assign(history.element(trail.toInt().mul(SAMPLES).add(age)));
      });
      return result;
    })();
    const temperature = varying(trailPoint.w);
    const coldToViolet = mix(color(0x124bff), color(0x953de8), temperature.mul(2).clamp()) as Node<'vec3'>;
    const temperatureColor = mix(coldToViolet, color(0xff102b), temperature.sub(0.5).mul(2).clamp()) as Node<'vec3'>;
    const fade = varying(float(1).sub(age.toFloat().add(1).div(SAMPLES)).max(0).pow(1.5));
    const lifeFade = varying(positions.element(particle).w.clamp(0, 0.24).div(0.24));
    const slicePosition = varying(trailPoint.xyz);
    const latitude = slicePosition.y.div(slicePosition.length().max(0.001)).clamp(-1, 1).asin();
    const focus = cellFocusNode(latitude, selectedCell);
    const sectionDepth = slicePosition.z.mul(spinAngle.cos()).sub(slicePosition.x.mul(spinAngle.sin()));
    const sliceVisibility = float(1).sub(sectionDepth.abs().smoothstep(sliceHalfWidth.sub(0.018), sliceHalfWidth));

    const material = new THREE.LineBasicNodeMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    material.positionNode = trailPoint.xyz;
    material.colorNode = temperatureColor.mul(sectionBrightness).mul(1.35).mul(focus);
    material.opacityNode = fade.mul(lifeFade).mul(sliceVisibility).mul(0.72);
    const geometry = new THREE.BufferGeometry();
    // Only topology lives on the CPU. All animated vertex positions come from
    // GPU storage via vertexIndex; no history is read back or uploaded per frame.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailCount * SAMPLES * 2 * 3), 3));
    super(geometry, material);
    this.frustumCulled = false;
    this.renderOrder = 4;
    this.initializeNode = initializeNode;
    this.updateNode = updateNode;
    this.sampleNow = sampleNow;
  }

  async initialize(renderer: THREE.WebGPURenderer): Promise<void> {
    await renderer.computeAsync(this.initializeNode);
    this.previousTime = performance.now();
  }

  compute(renderer: THREE.WebGPURenderer): void {
    const now = performance.now();
    this.sampleAccumulator += Math.min(0.05, (now - this.previousTime) / 1000);
    this.previousTime = now;
    this.sampleNow.value = this.sampleAccumulator >= SAMPLE_INTERVAL ? 1 : 0;
    if (this.sampleNow.value) this.sampleAccumulator %= SAMPLE_INTERVAL;
    renderer.compute(this.updateNode);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
