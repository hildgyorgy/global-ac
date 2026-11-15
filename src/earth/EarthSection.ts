import * as THREE from 'three/webgpu';
import { float, positionLocal } from 'three/tsl';
import { CONFIG } from '../config';
import { ProjectionAnnotations } from './ProjectionAnnotations';

/** Opaque projection face and a purely graphical near-surface haze. */
export class EarthSection extends THREE.Group {
  private readonly annotations = new ProjectionAnnotations();
  constructor() {
    super();
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(CONFIG.earth.radius, 128),
      new THREE.MeshBasicNodeMaterial({ color: 0x080e12, side: THREE.DoubleSide }),
    );
    face.position.z = -0.095;
    // Start exactly at the physical surface. No outline or shifted surface:
    // this neutral haze fades through the existing particle clearance.
    const hazeWidth = .085;
    const hazeMaterial = new THREE.MeshBasicNodeMaterial({
      color: 0x79817a, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    hazeMaterial.opacityNode = float(1).sub(positionLocal.xy.length()
      .sub(CONFIG.earth.radius).div(hazeWidth).clamp(0, 1)).pow(2).mul(.18);
    const haze = new THREE.Mesh(
      new THREE.RingGeometry(CONFIG.earth.radius, CONFIG.earth.radius + hazeWidth, 256, 8),
      hazeMaterial,
    );
    haze.position.z = -.093;
    this.add(face, haze, this.annotations);
    this.visible = false;
  }

  dispose(): void { this.annotations.dispose(); }
}
