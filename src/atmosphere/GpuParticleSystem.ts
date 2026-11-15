import * as THREE from 'three/webgpu';
import type { ComputeNode, Node } from 'three/webgpu';
import {
  Fn,
  If,
  PI2,
  color,
  deltaTime,
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  shapeCircle,
  time,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import { CONFIG } from '../config';
import { sampleHadleyField } from './HadleyFieldNode';
import { HADLEY_MODEL } from './HadleyModel';
import { CORIOLIS_MODEL } from './CoriolisModel';
import { coriolisVisualScaleNode, zonalCoriolisAccelerationNode } from './CoriolisNode';
import { GpuParticleTrails } from './GpuParticleTrails';
import { cellFocusNode } from './CellSelectionNode';
import { meridionalProjectionNode } from './MeridionalProjectionNode';
import { JET_STREAMS_MODEL } from './JetStreamsModel';
import { jetEastwardSpeedNode } from './JetStreamsNode';

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
    const count = CONFIG.atmosphere.particleCount;
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

    // Smooth latitude-dependent shell; shared by rendering and wind metrics.
    const particleRadius = Fn<
      [Node<'float'>, Node<'float'>], Node<'float'>
    >(([latitude, altitude]) => {
      const thickness = latitude.cos().pow(2)
        .mul(CONFIG.atmosphere.equatorialShellThickness - CONFIG.atmosphere.polarShellThickness)
        .add(CONFIG.atmosphere.polarShellThickness);
      return float(CONFIG.earth.radius + 0.018).add(altitude.mul(thickness));
    });

    const toCartesian = Fn<
      [Node<'float'>, Node<'float'>, Node<'float'>],
      Node<'vec3'>
    >(([latitude, longitude, altitude]) => {
      const radius = particleRadius(latitude, altitude);
      const cosLatitude = latitude.cos();

      return vec3(
        radius.mul(cosLatitude).mul(longitude.cos()),
        radius.mul(latitude.sin()),
        radius.mul(cosLatitude).mul(longitude.sin()),
      );
    });

    const computeInit = Fn(() => {
      const index = instanceIndex.toFloat();
      const position = positions.element(instanceIndex);
      const velocity = velocities.element(instanceIndex);
      const state = sphericalState.element(instanceIndex);
      const hemisphere = float(1).toVar();

      If(hash(index.add(1)).lessThan(0.5), () => {
        hemisphere.assign(-1);
      });

      const cellPosition = seedCellPosition(hash(index.add(7)));
      const altitude = hash(index.add(17))
        .pow(1.3)
        .mul(MAX_ALTITUDE - MIN_ALTITUDE)
        .add(MIN_ALTITUDE);
      const cellIndex = allocatedCellIndex();
      const latitude = hemisphere.mul(HADLEY_MODEL.cellEdgeRadians).mul(cellPosition.add(cellIndex));
      const longitude = hash(index.add(29)).mul(PI2);
      const life = hash(index.add(43)).mul(0.5).add(0.5);
      const field = sampleHadleyField(latitude, altitude);

      state.assign(vec4(latitude, longitude, altitude, cellIndex));
      position.assign(vec4(toCartesian(latitude, longitude, altitude), life));
      velocity.assign(field);
      zonalSpeeds.element(instanceIndex).assign(0);
    })().compute(count).setName('Initialize atmospheric particles');

    const computeUpdate = Fn(() => {
      const position = positions.element(instanceIndex);
      const velocity = velocities.element(instanceIndex);
      const state = sphericalState.element(instanceIndex);
      const dt = deltaTime.min(0.05).mul(CONFIG.atmosphere.flowSpeed);
      const field = sampleHadleyField(state.x, state.z);
      const zonalSpeed = zonalSpeeds.element(instanceIndex);
      const radius = particleRadius(state.x, state.z);
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
      const thicknessDifference = CONFIG.atmosphere.equatorialShellThickness - CONFIG.atmosphere.polarShellThickness;
      const thickness = state.x.cos().pow(2).mul(thicknessDifference)
        .add(CONFIG.atmosphere.polarShellThickness);
      const radialSpeed = field.z.mul(thickness).sub(state.z.mul(2 * thicknessDifference)
        .mul(state.x.cos()).mul(state.x.sin()).mul(field.x));
      const eastward = jetEastwardSpeedNode(state.x, state.z,
        backgroundLongitudeRate.negate().mul(zonalMetric), northwardSpeed, radialSpeed, jetStrength);
      const longitudeRate = eastward.negate().div(zonalMetric);

      state.x.addAssign(field.x.mul(dt));
      state.y.addAssign(longitudeRate.mul(dt));
      state.z.addAssign(field.z.mul(dt));

      const hemisphere = state.x.sign();
      const minimumLatitude = state.w.add(LATITUDE_EPSILON).mul(HADLEY_MODEL.cellEdgeRadians);
      const maximumLatitude = state.w.add(1 - LATITUDE_EPSILON).mul(HADLEY_MODEL.cellEdgeRadians);
      state.x.assign(state.x.abs().clamp(minimumLatitude, maximumLatitude).mul(hemisphere));
      state.y.assign(state.y.add(PI2).mod(PI2));
      state.z.assign(state.z.clamp(MIN_ALTITUDE, MAX_ALTITUDE));

      position.xyz.assign(toCartesian(state.x, state.y, state.z));
      position.w.subAssign(dt.mul(0.055));
      velocity.assign(field);
      velocity.y.assign(longitudeRate);

      // Lifetime and respawn stay on the GPU. The time-varying hash prevents
      // repeated particles from returning to a visible fixed lattice.
      If(position.w.lessThanEqual(0), () => {
        const respawnSeed = instanceIndex.toFloat().add(time.mul(19.17));
        const respawnHemisphere = float(1).toVar();

        If(hash(respawnSeed.add(3)).lessThan(0.5), () => {
          respawnHemisphere.assign(-1);
        });

        const cellPosition = seedCellPosition(hash(respawnSeed.add(11)));
        const altitude = hash(respawnSeed.add(23))
          .pow(1.3)
          .mul(MAX_ALTITUDE - MIN_ALTITUDE)
          .add(MIN_ALTITUDE);
        const cellIndex = allocatedCellIndex();
        const latitude = respawnHemisphere
          .mul(HADLEY_MODEL.cellEdgeRadians)
          .mul(cellPosition.add(cellIndex));
        const longitude = hash(respawnSeed.add(37)).mul(PI2);
        const respawnField = sampleHadleyField(latitude, altitude);

        state.assign(vec4(latitude, longitude, altitude, cellIndex));
        position.assign(
          vec4(
            toCartesian(latitude, longitude, altitude),
            hash(respawnSeed.add(59)).mul(0.35).add(0.65),
          ),
        );
        velocity.assign(respawnField);
        zonalSpeed.assign(0);
      });
    })().compute(count).setName('Advect atmospheric particles');

    const particlePosition = positions.toAttribute();
    const particleVelocity = velocities.toAttribute();
    const temperature = float(particleVelocity.w);
    const coolToViolet = mix(
      color(0x124bff),
      color(0x953de8),
      temperature.mul(2).clamp(),
    ) as Node<'vec3'>;
    const particleColor = mix(
      coolToViolet,
      color(0xff102b),
      temperature.sub(0.5).mul(2).clamp(),
    ) as Node<'vec3'>;
    const shimmer = time
      .mul(1.35)
      .add(hash(instanceIndex).mul(PI2))
      .sin()
      .mul(0.08)
      .add(0.92);
    const lifeFade = float(particlePosition.w).clamp(0, 0.24).div(0.24);
    const projection = meridionalProjectionNode(particlePosition.xyz, spinAngle, projectionProgress);

    const material = new THREE.SpriteNodeMaterial();
    const focus = cellFocusNode(float(sphericalState.toAttribute().x), selectedCell);
    material.positionNode = projection.position;
    material.scaleNode = float(CONFIG.atmosphere.particleSize);
    material.colorNode = particleColor.mul(0.9).mul(sectionBrightness).mul(focus);
    material.opacityNode = (shapeCircle() as Node<'float'>)
      .mul(shimmer)
      .mul(lifeFade)
      .mul(projection.visibility)
      .mul(0.68);
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.blending = THREE.AdditiveBlending;
    material.alphaToCoverage = true;

    super(material);
    this.trails = new GpuParticleTrails(count, positions, velocities, projectionProgress, spinAngle, sectionBrightness, selectedCell);
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
