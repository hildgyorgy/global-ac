import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

/** WebGPU wide lines keep quiet diagram strokes legible in screen pixels. */
export function createProjectionLine(
  points: THREE.Vector3[],
  material: THREE.Line2NodeMaterial,
  disconnected = false,
): LineSegments2 {
  const positions: number[] = [];
  const step = disconnected ? 2 : 1;
  for (let i = 0; i + 1 < points.length; i += step) {
    positions.push(...points[i].toArray(), ...points[i + 1].toArray());
  }
  return new LineSegments2(new LineSegmentsGeometry().setPositions(positions), material);
}
