import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../config';

export interface CameraRig {
  camera: PerspectiveCamera;
  controls: OrbitControls;
}

/** Dolly about the near desk edge: its screen position stays fixed while the
 * globe and room grow upward, without stretching the rendered geometry. */
export function frameAroundDesk(position: Vector3, target: Vector3, magnification: number) {
  const anchor = new Vector3(0, -1.852, 2.35);
  return {
    position: position.clone().sub(anchor).divideScalar(magnification).add(anchor),
    target: target.clone().sub(anchor).divideScalar(magnification).add(anchor),
  };
}

export function defaultCameraFrame(aspect: number) {
  // Include the inlaid title and controls in portrait layouts.
  const fit = Math.max(1, 1.45 / Math.max(0.35, aspect));
  // Wide views already nearly fill the top; portrait views have more headroom.
  const magnification = 1.035 + .020 * Math.max(0, Math.min(1, (1.7 - aspect) / .7));
  return frameAroundDesk(
    new Vector3(.15, CONFIG.camera.height * fit, CONFIG.camera.distance * fit),
    new Vector3(0, CONFIG.camera.targetHeight, 0), magnification,
  );
}

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const camera = new PerspectiveCamera(
    CONFIG.camera.fieldOfView,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far,
  );
  const initial = defaultCameraFrame(camera.aspect);
  camera.position.copy(initial.position);

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
  controls.target.copy(initial.target);
  controls.update();

  return { camera, controls };
}
