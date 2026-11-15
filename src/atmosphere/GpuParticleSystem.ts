import * as THREE from 'three/webgpu';
import type { ComputeNode, Node } from 'three/webgpu';
import {
  Fn,
  If,
  PI2,
  deltaTime,
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  shapeCircle,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { particleRadiusNode, radialVelocityNode } from './GeometryNode';
import { temperatureColorNode, particleLifeFadeNode, jetTracerFadeNode } from './ParticleAppearanceNode';
import { CONFIG } from '../config';
import { sampleHadleyField } from './HadleyFieldNode';
import { HADLEY_MODEL } from './HadleyModel';
import { CORIOLIS_MODEL } from './CoriolisModel';
import { coriolisVisualScaleNode, zonalCoriolisAccelerationNode } from './CoriolisNode';
import { GpuParticleTrails } from './GpuParticleTrails';
import { cellFocusNode } from './CellSelectionNode';
import { meridionalProjectionNode } from './MeridionalProjectionNode';
import { JET_STREAMS_MODEL } from './JetStreamsModel';
import { jetEastwardSpeedNode, jetStreamWeightNode, jetTracerSeedNode } from './JetStreamsNode';

// Keep only a numerical epsilon at latitude separatrices, not visible gaps.
const LATITUDE_EPSILON = 0.0001;
const MIN_ALTITUDE = 0.04;
const MAX_ALTITUDE = 0.96;

export class GpuParticleSystem extends THREE.Sprite {
  readonly trails: GpuParticleTrails;
  private readonly projectionProgress;
  private readonly sectionBrightness;
  private readonly coriolisStrength;
  private readonly spinAngle;
  private readonly selectedCell;
  private readonly jetStrength;
  private jetTarget = 0;
  private previousComputeTime = 0;
  private readonly computeInit: ComputeNode;
  private readonly computeUpdate: ComputeNode;

  constructor() {
    const baseCount = CONFIG.atmosphere.particleCount;
    const count = baseCount + JET_STREAMS_MODEL.extraTracerCount;
    const projectionProgress = uniform(0);
    const sectionBrightness = uniform(1);
    const coriolisStrength = uniform(0);
    const spinAngle = uniform(0);
    const selectedCell = uniform(-1);
    const jetStrength = uniform(0);
    const zonalSpeeds = instancedArray(count, 'float').setName('particleZonalSpeeds');
    const positions = instancedArray(count, 'vec4').setName('particlePositions');
    const velocities = instancedArray(count, 'vec4').setName('particleVelocities');
    const sphericalState = instancedArray(count, 'vec4').setName('particleSphericalState');
    const jetLifecycle = instancedArray(count, 'vec2').setName('jetTracerLifecycle');

    // Exact configured cell budgets; respawns retain their original cell.
    const allocatedCellIndex = Fn(() => {
      const budgets = CONFIG.atmosphere.cellParticleCounts;
      const cell = float(0).toVar();
      If(instanceIndex.greaterThanEqual(budgets.hadley), () => { cell.assign(1); });
      If(instanceIndex.greaterThanEqual(budgets.hadley + budgets.ferrel), () => { cell.assign(2); });
      return cell;
    });

    // A smooth sampling bias supplies more tracers to shared cell boundaries.
    // The analytical field then carries both neighboring populations along the
    // same ascending/descending branch. This changes density, not brightness.
    const seedCellPosition = Fn<[Node<'float'>], Node<'float'>>(([random]) => {
      const edgeBiased = float(1).sub(random.mul(Math.PI).cos()).mul(0.5);
      return random.mul(0.35).add(edgeBiased.mul(0.65))
        .mul(1 - 2 * LATITUDE_EPSILON).add(LATITUDE_EPSILON);
    });

    const toCartesian = Fn<
      [Node<'float'>, Node<'float'>, Node<'float'>],
      Node<'vec3'>
    >(([latitude, longitude, altitude]) => {
      const radius = particleRadiusNode(latitude, altitude);
      const cosLatitude = latitude.cos();

      return vec3(
        radius.mul(cosLatitude).mul(longitude.cos()),
        radius.mul(latitude.sin()),
        radius.mul(cosLatitude).mul(longitude.sin()),
      );
    });

    const seedJet = Fn<[Node<'float'>], Node<'vec2'>>(([seed]) => jetTracerSeedNode(
      instanceIndex.sub(baseCount).mod(4).toFloat(),
      hash(seed.add(71)).mul(PI2), hash(seed.add(89)).sqrt(),
    ));

    // Phase 0 initializes; phase 1 respawns. Preserve each phase's hash salts
    // and life distribution while sharing all state writes and jet handling.
    const seedParticle = (seed: Node<'float'>, phase: Node<'float'>): void => {
      const hemisphere = float(1).toVar();
      If(hash(seed.add(mix(1, 3, phase))).lessThan(.5), () => { hemisphere.assign(-1); });
      const cellPosition = seedCellPosition(hash(seed.add(mix(7, 11, phase))));
      const altitude = hash(seed.add(mix(17, 23, phase))).pow(1.3)
        .mul(MAX_ALTITUDE - MIN_ALTITUDE).add(MIN_ALTITUDE).toVar();
      const cellIndex = allocatedCellIndex().toVar();
      const latitude = hemisphere.mul(HADLEY_MODEL.cellEdgeRadians).mul(cellPosition.add(cellIndex)).toVar();
      If(instanceIndex.greaterThanEqual(baseCount), () => {
        const jet = seedJet(seed);
        latitude.assign(jet.x); altitude.assign(jet.y);
        cellIndex.assign(latitude.abs().div(HADLEY_MODEL.cellEdgeRadians).floor().min(2));
      });
      const longitude = hash(seed.add(mix(29, 37, phase))).mul(PI2);
      const life = hash(seed.add(mix(43, 59, phase))).mul(mix(.5, .35, phase)).add(mix(.5, .65, phase));
      const position = positions.element(instanceIndex);
      sphericalState.element(instanceIndex).assign(vec4(latitude, longitude, altitude, cellIndex));
      position.assign(vec4(toCartesian(latitude, longitude, altitude), life));
      // A life increase clears trails, including early jet-marker respawns.
      If(instanceIndex.greaterThanEqual(baseCount), () => { position.w.assign(1); });
      jetLifecycle.element(instanceIndex).assign(vec2(0, 1));
      velocities.element(instanceIndex).assign(sampleHadleyField(latitude, altitude));
      zonalSpeeds.element(instanceIndex).assign(0);
    };

    const computeInit = Fn(() => {
      seedParticle(instanceIndex.toFloat(), float(0));
    })().compute(count).setName('Initialize atmospheric particles');

    const computeUpdate = Fn(() => {
      const position = positions.element(instanceIndex);
      const velocity = velocities.element(instanceIndex);
      const state = sphericalState.element(instanceIndex);
      const dt = deltaTime.min(0.05).mul(CONFIG.atmosphere.flowSpeed);
      const field = sampleHadleyField(state.x, state.z);
      const zonalSpeed = zonalSpeeds.element(instanceIndex);
      const radius = particleRadiusNode(state.x, state.z);
      const northwardSpeed = field.x.mul(radius);
      const acceleration = zonalCoriolisAccelerationNode(state.x, northwardSpeed)
        .mul(coriolisStrength);
      const drag = mix(CORIOLIS_MODEL.switchOffDrag, CORIOLIS_MODEL.drag, coriolisStrength);
      // Exact damped update for frozen f,v over one frame; no CPU state copies.
      const decay = drag.mul(dt).negate().exp();
      zonalSpeed.assign(zonalSpeed.mul(decay)
        .add(acceleration.div(drag).mul(float(1).sub(decay))));
      // Our Cartesian longitude increases westward about the +Y polar axis.
      // Convert eastward linear speed to negative longitude rate. Regularize
      // near the poles where longitude itself becomes singular.
      const longitudeLimit = coriolisVisualScaleNode(state.x).mul(CORIOLIS_MODEL.maxLongitudeRate);
      const zonalMetric = radius.mul(state.x.cos().max(CORIOLIS_MODEL.minimumCosLatitude));
      const backgroundLongitudeRate = zonalSpeed.negate()
        .div(zonalMetric)
        .clamp(longitudeLimit.negate(), longitudeLimit);

      // Actual background velocity after the cap. dr/dt includes the
      // latitude-dependent shell thickness, not just normalized altitude.
      const radialSpeed = radialVelocityNode(state.x, state.z, field.x, field.z);
      const eastward = jetEastwardSpeedNode(state.x, state.z,
        backgroundLongitudeRate.negate().mul(zonalMetric), northwardSpeed, radialSpeed, jetStrength);
      const longitudeRate = eastward.negate().div(zonalMetric);

      state.x.addAssign(field.x.mul(dt));
      state.y.addAssign(longitudeRate.mul(dt));
      state.z.addAssign(field.z.mul(dt));

      const hemisphere = state.x.sign();
      const minimumLatitude = state.w.add(LATITUDE_EPSILON).mul(HADLEY_MODEL.cellEdgeRadians);
      const maximumLatitude = state.w.add(1 - LATITUDE_EPSILON).mul(HADLEY_MODEL.cellEdgeRadians);
      If(instanceIndex.lessThan(baseCount), () => {
        state.x.assign(state.x.abs().clamp(minimumLatitude, maximumLatitude).mul(hemisphere));
      }).Else(() => {
        // Extra markers sample the same field and can cross cell boundaries.
        state.x.assign(state.x.clamp(-Math.PI / 2 + .0001, Math.PI / 2 - .0001));
      });
      state.y.assign(state.y.add(PI2).mod(PI2));
      state.z.assign(state.z.clamp(MIN_ALTITUDE, MAX_ALTITUDE));

      position.xyz.assign(toCartesian(state.x, state.y, state.z));
      position.w.subAssign(dt.mul(0.055));
      velocity.assign(field);
      velocity.y.assign(longitudeRate);

      const lifecycle = jetLifecycle.element(instanceIndex);
      If(instanceIndex.greaterThanEqual(baseCount), () => {
        lifecycle.x.addAssign(dt);
        If(lifecycle.y.lessThan(1).or(jetStreamWeightNode(state.x, state.z)
          .lessThan(JET_STREAMS_MODEL.tracerExitWeight)), () => {
          lifecycle.y.assign(lifecycle.y.sub(dt.div(JET_STREAMS_MODEL.tracerFadeSeconds)).max(0));
        });
      });

      // Lifetime and respawn stay on the GPU. The time-varying hash prevents
      // repeated particles from returning to a visible fixed lattice.
      If(position.w.lessThanEqual(0).or(instanceIndex.greaterThanEqual(baseCount)
        .and(lifecycle.y.lessThanEqual(0))), () => {
        seedParticle(instanceIndex.toFloat().add(time.mul(19.17)), float(1));
      });
    })().compute(count).setName('Advect atmospheric particles');

    const particlePosition = positions.toAttribute();
    const particleVelocity = velocities.toAttribute();
    const temperature = float(particleVelocity.w);
    const particleColor = temperatureColorNode(temperature);
    const shimmer = time
      .mul(1.35)
      .add(hash(instanceIndex).mul(PI2))
      .sin()
      .mul(0.08)
      .add(0.92);
    const lifeFade = particleLifeFadeNode(float(particlePosition.w));
    const cycle = jetLifecycle.toAttribute();
    const jetDisplayFade = jetTracerFadeNode(instanceIndex.toFloat(), float(baseCount), cycle, jetStrength);
    const projection = meridionalProjectionNode(particlePosition.xyz, spinAngle, projectionProgress);

    const material = new THREE.SpriteNodeMaterial();
    const focus = cellFocusNode(float(sphericalState.toAttribute().x), selectedCell);
    material.positionNode = projection.position;
    material.scaleNode = float(CONFIG.atmosphere.particleSize);
    material.colorNode = particleColor.mul(0.9).mul(sectionBrightness).mul(focus);
    material.opacityNode = (shapeCircle() as Node<'float'>)
      .mul(shimmer)
      .mul(lifeFade)
      .mul(jetDisplayFade)
      .mul(projection.visibility)
      .mul(0.68);
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.blending = THREE.AdditiveBlending;
    material.alphaToCoverage = true;

    super(material);
    this.trails = new GpuParticleTrails({ particleCount: count, positions, velocities, projectionProgress, spinAngle,
      sectionBrightness, selectedCell, baseParticleCount: baseCount, jetLifecycle, jetStrength });
    this.add(this.trails);
    this.projectionProgress = projectionProgress;
    this.sectionBrightness = sectionBrightness;
    this.coriolisStrength = coriolisStrength;
    this.spinAngle = spinAngle;
    this.selectedCell = selectedCell;
    this.jetStrength = jetStrength;
    this.count = count;
    this.frustumCulled = false;
    this.renderOrder = 3;
    this.computeInit = computeInit;
    this.computeUpdate = computeUpdate;
  }

  async initialize(renderer: THREE.WebGPURenderer): Promise<void> {
    await renderer.computeAsync(this.computeInit);
    await renderer.computeAsync(this.computeUpdate);
    await this.trails.initialize(renderer);
    this.previousComputeTime = performance.now();
  }

  compute(renderer: THREE.WebGPURenderer): void {
    // Only this global switch scalar is eased on the CPU; all per-particle
    // field evaluation, advection and history updates stay on the GPU.
    const now = performance.now();
    const dt = Math.min(.05, Math.max(0, (now - this.previousComputeTime) / 1000));
    this.previousComputeTime = now;
    this.jetStrength.value += (this.jetTarget - this.jetStrength.value)
      * (1 - Math.exp(-dt / JET_STREAMS_MODEL.switchTimeSeconds));
    renderer.compute(this.computeUpdate);
    this.trails.compute(renderer);
  }

  setSectionProgress(progress: number): void {
    this.projectionProgress.value = progress;
    this.sectionBrightness.value = 1 + progress * 0.6;
  }

  setCoriolisEnabled(enabled: boolean): void {
    this.coriolisStrength.value = enabled ? 1 : 0;
  }

  setJetsEnabled(enabled: boolean): void { this.jetTarget = enabled ? 1 : 0; }

  setSpinAngle(angle: number): void {
    this.spinAngle.value = angle;
  }

  setSelectedCell(cell: number): void {
    this.selectedCell.value = cell;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.trails.dispose();
  }
}
