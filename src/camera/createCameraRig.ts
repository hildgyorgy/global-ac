import { PerspectiveCamera } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../config';

export interface CameraRig {
  camera: PerspectiveCamera;
  controls: OrbitControls;
}

export function defaultCameraPosition(aspect: number): { x: number; y: number; z: number } {
  const fit = Math.max(1, 1.15 / Math.max(0.35, aspect));
  return { x: 0.15, y: CONFIG.camera.height * fit, z: CONFIG.camera.distance * fit };
}

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const camera = new PerspectiveCamera(
    CONFIG.camera.fieldOfView,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far,
  );
  const initial = defaultCameraPosition(camera.aspect);
  camera.position.set(initial.x, initial.y, initial.z);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.045;
  controls.enablePan = false;
  controls.minDistance = CONFIG.camera.minDistance;
  controls.maxDistance = Math.max(CONFIG.camera.maxDistance, camera.position.length() * 1.5);
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.45;
  controls.minAzimuthAngle = -0.9;
  controls.maxAzimuthAngle = 0.9;
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = false;
  controls.target.set(0, CONFIG.camera.targetHeight, 0);
  controls.update();

  return { camera, controls };
}
