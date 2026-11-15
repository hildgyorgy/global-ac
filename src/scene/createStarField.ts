import * as THREE from 'three/webgpu';

export function createStarField(): THREE.Points<THREE.BufferGeometry, THREE.PointsNodeMaterial> {
  const count = 1_300;
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const radius = 16 + Math.random() * 34;
    const longitude = Math.random() * Math.PI * 2;
    const latitude = Math.asin(Math.random() * 2 - 1);
    const offset = index * 3;

    positions[offset] = radius * Math.cos(latitude) * Math.cos(longitude);
    positions[offset + 1] = radius * Math.sin(latitude);
    positions[offset + 2] = radius * Math.cos(latitude) * Math.sin(longitude);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsNodeMaterial({
    color: 0x9aa9aa,
    size: 0.025,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}
