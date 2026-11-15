import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';

/** Opaque face of the meridional cut, behind the slab's visible particles. */
export class EarthSection extends THREE.Group {
  constructor() {
    super();
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(CONFIG.earth.radius, 128),
      new THREE.MeshBasicNodeMaterial({ color: 0x080e12, side: THREE.DoubleSide }),
    );
    face.position.z = -0.095;
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(0.998, 1.002, 128),
      new THREE.MeshBasicNodeMaterial({
        color: 0x796448, transparent: true, opacity: 0.48,
        side: THREE.DoubleSide,
      }),
    );
    edge.position.z = -0.094;
    this.add(face, edge);
    this.visible = false;
  }
}
