import * as THREE from 'three/webgpu';
import { color, float, normalWorld, positionWorldDirection, texture } from 'three/tsl';
import { CONFIG } from '../config';

export class Earth extends THREE.Group {
  private readonly surfaceGeometry: THREE.SphereGeometry;
  private readonly surfaceMaterial: THREE.MeshStandardNodeMaterial;
  private readonly glowGeometry: THREE.SphereGeometry;
  private readonly glowMaterial: THREE.MeshBasicNodeMaterial;

  constructor() {
    super();

    const loader = new THREE.TextureLoader();
    const colorMap = loader.load('/textures/earth_atmos_2048.jpg');
    const normalMap = loader.load('/textures/earth_normal_2048.jpg');
    colorMap.colorSpace = THREE.SRGBColorSpace;

    this.surfaceGeometry = new THREE.SphereGeometry(CONFIG.earth.radius, 96, 64);
    this.surfaceMaterial = new THREE.MeshStandardNodeMaterial({
      normalMap,
      normalScale: new THREE.Vector2(0.46, 0.46),
      roughness: 0.82,
      metalness: 0,
    });
    this.surfaceMaterial.colorNode = texture(colorMap).mul(color(0xd8e0dc));

    const surface = new THREE.Mesh(this.surfaceGeometry, this.surfaceMaterial);
    surface.rotation.y = CONFIG.earth.rotationRadians;
    surface.renderOrder = 1;
    this.add(surface);

    const rim = float(1)
      .sub(normalWorld.dot(positionWorldDirection).abs())
      .clamp(0, 1)
      .pow(3.2);

    this.glowGeometry = new THREE.SphereGeometry(CONFIG.earth.radius * 1.055, 80, 56);
    this.glowMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.glowMaterial.colorNode = color(0x3390aa).mul(rim);
    this.glowMaterial.opacityNode = rim.mul(0.26);

    const glow = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
    glow.renderOrder = 2;
    this.add(glow);
  }

  dispose(): void {
    this.surfaceMaterial.normalMap?.dispose();
    this.surfaceGeometry.dispose();
    this.surfaceMaterial.dispose();
    this.glowGeometry.dispose();
    this.glowMaterial.dispose();
  }
}
