import { PerspectiveCamera } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../config';

export interface CameraRig {
  camera: PerspectiveCamera;
  controls: OrbitControls;
}

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const camera = new PerspectiveCamera(
    CONFIG.camera.fieldOfView,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far,
  );
  camera.position.set(0.1, 0.15, CONFIG.camera.distance);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.045;
  controls.enablePan = false;
  controls.minDistance = CONFIG.camera.minDistance;
  controls.maxDistance = CONFIG.camera.maxDistance;
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = false;
  controls.target.set(0, 0, 0);
  controls.update();

  return { camera, controls };
}
