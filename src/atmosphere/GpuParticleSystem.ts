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
import { zonalCoriolisAccelerationNode } from './CoriolisNode';

// Keep only a numerical epsilon at latitude separatrices, not visible gaps.
const LATITUDE_EPSILON = 0.0001;
const MIN_ALTITUDE = 0.04;
const MAX_ALTITUDE = 0.96;

export class GpuParticleSystem extends THREE.Sprite {
  private readonly sliceHalfWidth;
  private readonly sectionBrightness;
  private readonly coriolisStrength;
  private readonly spinAngle;
  private readonly computeInit: ComputeNode;
  private readonly computeUpdate: ComputeNode;

  constructor() {
    const count = CONFIG.atmosphere.particleCount;
    const sliceHalfWidth = uniform(2);
    const sectionBrightness = uniform(1);
    const coriolisStrength = uniform(0);
    const spinAngle = uniform(0);
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
      const drag = float(CORIOLIS_MODEL.switchOffDrag)
        .mix(CORIOLIS_MODEL.drag, coriolisStrength);
      // Exact damped update for frozen f,v over one frame; no CPU state copies.
      const decay = drag.mul(dt).negate().exp();
      zonalSpeed.assign(zonalSpeed.mul(decay)
        .add(acceleration.div(drag).mul(float(1).sub(decay))));
      // Our Cartesian longitude increases westward about the +Y polar axis.
      // Convert eastward linear speed to negative longitude rate. Regularize
      // near the poles where longitude itself becomes singular.
      const longitudeRate = zonalSpeed.negate()
        .div(radius.mul(state.x.cos().max(CORIOLIS_MODEL.minimumCosLatitude)))
        .clamp(-CORIOLIS_MODEL.maxLongitudeRate, CORIOLIS_MODEL.maxLongitudeRate);

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
    // Slice stays in the tilted globe frame while particles and the surface
    // rotate through it. Rotate each center into that frame before filtering.
    const sectionDepth = float(particlePosition.z).mul(spinAngle.cos())
      .sub(float(particlePosition.x).mul(spinAngle.sin()));
    const sliceVisibility = float(1).sub(
      sectionDepth.abs().smoothstep(
        sliceHalfWidth.sub(0.018), sliceHalfWidth,
      ),
    );

    const material = new THREE.SpriteNodeMaterial();
    material.positionNode = particlePosition.xyz;
    material.scaleNode = float(CONFIG.atmosphere.particleSize);
    material.colorNode = particleColor.mul(0.9).mul(sectionBrightness);
    material.opacityNode = (shapeCircle() as Node<'float'>)
      .mul(shimmer)
      .mul(lifeFade)
      .mul(sliceVisibility)
      .mul(0.68);
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.blending = THREE.AdditiveBlending;
    material.alphaToCoverage = true;

    super(material);
    this.sliceHalfWidth = sliceHalfWidth;
    this.sectionBrightness = sectionBrightness;
    this.coriolisStrength = coriolisStrength;
    this.spinAngle = spinAngle;
    this.count = count;
    this.frustumCulled = false;
    this.renderOrder = 3;
    this.computeInit = computeInit;
    this.computeUpdate = computeUpdate;
  }

  async initialize(renderer: THREE.WebGPURenderer): Promise<void> {
    await renderer.computeAsync(this.computeInit);
    await renderer.computeAsync(this.computeUpdate);
  }

  compute(renderer: THREE.WebGPURenderer): void {
    renderer.compute(this.computeUpdate);
  }

  setSectionProgress(progress: number): void {
    this.sliceHalfWidth.value = 2 + (0.09 - 2) * progress;
    this.sectionBrightness.value = 1 + progress * 1.4;
  }

  setCoriolisEnabled(enabled: boolean): void {
    this.coriolisStrength.value = enabled ? 1 : 0;
  }

  setSpinAngle(angle: number): void {
    this.spinAngle.value = angle;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
