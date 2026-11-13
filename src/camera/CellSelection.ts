import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';
import { HADLEY_MODEL } from '../atmosphere/HadleyModel';

export function cellAtLatitude(latitude: number): number {
  return Math.min(2, Math.floor(Math.abs(latitude) / HADLEY_MODEL.cellEdgeRadians))
    + (latitude < 0 ? 3 : 0);
}

/** Tap/click recognition independent of OrbitControls. Multitouch, holds and
 * drags never select; the canvas keeps its ordinary camera gestures.
 */
export class CellSelection {
  private readonly pointers = new Set<number>();
  private gesture: { id: number; x: number; y: number; started: number; cancelled: boolean } | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly localRay = new THREE.Ray();
  private readonly inverse = new THREE.Matrix4();
  private readonly point = new THREE.Vector3();
  private readonly pointer = new THREE.Vector2();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly globe: THREE.Group,
    private readonly isSection: () => boolean,
    private readonly canSelect: () => boolean,
    private readonly onSelect: (cell: number) => void,
  ) {
    canvas.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.cancel);
    window.addEventListener('blur', this.clearGesture);
  }

  private down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointers.add(event.pointerId);
    if (this.pointers.size > 1) {
      if (this.gesture) this.gesture.cancelled = true;
      return;
    }
    this.gesture = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      started: performance.now(), cancelled: !this.canSelect(),
    };
  };

  private move = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (gesture?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7) gesture.cancelled = true;
  };

  private up = (event: PointerEvent): void => {
    this.move(event);
    this.pointers.delete(event.pointerId);
    const gesture = this.gesture;
    if (gesture?.id !== event.pointerId) return;
    this.gesture = null;
    if (gesture.cancelled || performance.now() - gesture.started > 450 || !this.canSelect()) return;
    this.onSelect(this.pick(event.clientX, event.clientY));
  };

  private cancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.gesture) this.gesture.cancelled = true;
  };

  private clearGesture = (): void => {
    this.pointers.clear();
    this.gesture = null;
  };

  private pick(x: number, y: number): number {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.globe.updateWorldMatrix(true, false);
    this.inverse.copy(this.globe.matrixWorld).invert();
    this.localRay.copy(this.raycaster.ray).applyMatrix4(this.inverse);
    const origin = new THREE.Vector3();
    if (this.isSection()) {
      if (!this.localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), this.point)) return -1;
      if (this.point.length() < CONFIG.earth.radius) return -1;
    } else {
      // Visible hemisphere latitude on the surface, or the limb latitude for
      // taps outside the surface but inside the exaggerated atmospheric halo.
      if (!this.localRay.intersectSphere(new THREE.Sphere(origin, CONFIG.earth.radius), this.point)) {
        this.localRay.closestPointToPoint(origin, this.point);
      }
    }
    const radius = this.point.length();
    const latitude = Math.asin(THREE.MathUtils.clamp(this.point.y / Math.max(radius, 1e-6), -1, 1));
    const thickness = CONFIG.atmosphere.polarShellThickness
      + (CONFIG.atmosphere.equatorialShellThickness - CONFIG.atmosphere.polarShellThickness) * Math.cos(latitude) ** 2;
    if (radius > CONFIG.earth.radius + 0.018 + thickness + 0.015) return -1;
    return cellAtLatitude(latitude);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.cancel);
    window.removeEventListener('blur', this.clearGesture);
  }
}
