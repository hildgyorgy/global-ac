import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SEASON_MODEL, seasonHandlePosition, seasonProgressFromPoint } from '../scene/SeasonModel';

interface SeasonDialOptions {
  anchor: THREE.Group;
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  navigation: { enabled: boolean };
  occluder: THREE.Object3D;
  canInteract: () => boolean;
  onChange: (progress: number) => void;
}

/** A physical curved fader, with an equivalent keyboard-accessible range. */
export class SeasonDial {
  readonly element = document.createElement('input');
  private readonly knob = new THREE.Group();
  private readonly knobMaterial = new THREE.MeshStandardNodeMaterial({
    color: 0xb99961,
    metalness: 0.7,
    roughness: 0.35,
    emissive: 0x62451f,
    emissiveIntensity: 0,
  });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly point = new THREE.Vector3();
  private readonly plane = new THREE.Plane();
  private enabled = false;
  private focused = false;
  private value = 0;
  private pointerId: number | null = null;
  private navigationWasEnabled = true;

  constructor(private readonly options: SeasonDialOptions) {
    this.element.type = 'range';
    this.element.min = '0';
    this.element.max = '1';
    this.element.step = '.001';
    this.element.value = '0';
    this.element.disabled = true;
    this.element.setAttribute('aria-label', 'Season: December to June');
    const points = Array.from({ length: 97 }, (_, i) => {
      const angle = (i * Math.PI) / 96;
      return new THREE.Vector3(
        Math.cos(angle) * SEASON_MODEL.trackRadius,
        0,
        Math.sin(angle) * SEASON_MODEL.trackRadius,
      );
    });
    const path = new THREE.CatmullRomCurve3(points);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(path, 96, 0.025, 8, false),
      new THREE.MeshStandardNodeMaterial({ color: 0x79603c, metalness: 0.65, roughness: 0.48 }),
    );
    const groove = new THREE.Mesh(
      new THREE.TubeGeometry(path, 96, 0.013, 8, false),
      new THREE.MeshStandardNodeMaterial({ color: 0x120f09, roughness: 0.85 }),
    );
    groove.position.y = 0.014;
    options.anchor.add(rail, groove, this.knob);
    const grip = new THREE.Mesh(
      new RoundedBoxGeometry(0.19, 0.065, 0.13, 2, 0.018),
      this.knobMaterial,
    );
    grip.castShadow = true;
    grip.receiveShadow = true;
    this.knob.add(grip);
    const dark = new THREE.MeshStandardNodeMaterial({
      color: 0x47351d,
      metalness: 0.4,
      roughness: 0.6,
    });
    for (const x of [-0.065, -0.045, 0.045, 0.065]) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.003, 0.09), dark);
      ridge.position.set(x, 0.034, 0);
      this.knob.add(ridge);
    }
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 16, 10),
      new THREE.MeshStandardNodeMaterial({ color: 0x385c5a, metalness: 0.25, roughness: 0.5 }),
    );
    earth.position.y = 0.038;
    this.knob.add(earth);
    this.updateHandle();
    this.element.addEventListener('input', this.input);
    this.element.addEventListener('keydown', this.keydown);
    this.element.addEventListener('focus', this.focus);
    this.element.addEventListener('blur', this.blur);
    options.canvas.addEventListener('pointerdown', this.down, true);
    window.addEventListener('pointermove', this.move, true);
    window.addEventListener('pointerup', this.up, true);
    window.addEventListener('pointercancel', this.cancel, true);
    window.addEventListener('blur', this.finish);
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.element.disabled = !enabled;
    if (!enabled) this.finish();
    this.updateFocus();
  }

  private setValue(value: number): void {
    this.value = THREE.MathUtils.clamp(value, 0, 1);
    this.element.value = this.value.toFixed(3);
    this.updateHandle();
    this.options.onChange(this.value);
  }

  private updateHandle(): void {
    const [x, z] = seasonHandlePosition(this.value);
    this.knob.position.set(x, 0.045, z);
    this.knob.rotation.y = -Math.atan2(z, x);
    this.element.setAttribute(
      'aria-valuetext',
      this.value <= 0.001
        ? 'December solstice'
        : this.value >= 0.999
          ? 'June solstice'
          : Math.abs(this.value - 0.5) < 0.01
            ? 'Equinox position'
            : `${Math.round(this.value * 100)}% from December toward June`,
    );
  }

  private pointOnDial(x: number, y: number): boolean {
    const { canvas, camera, anchor } = this.options;
    const rect = canvas.getBoundingClientRect();
    this.pointer.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      (-(y - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, camera);
    anchor.updateWorldMatrix(true, false);
    const origin = anchor.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 1, 0).transformDirection(anchor.matrixWorld);
    this.plane.setFromNormalAndCoplanarPoint(normal, origin);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.point)) return false;
    return true;
  }

  private pick(x: number, y: number): boolean {
    if (!this.enabled || !this.options.canInteract() || !this.pointOnDial(x, y)) return false;
    const distance = this.raycaster.ray.origin.distanceTo(this.point);
    this.options.occluder.updateWorldMatrix(true, true);
    const covered = this.raycaster.intersectObject(this.options.occluder, true).some((hit) => {
      if (hit.distance >= distance - 0.01 || !(hit.object instanceof THREE.Mesh)) return false;
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) {
        if (!object.visible) return false;
      }
      const materials = Array.isArray(hit.object.material)
        ? hit.object.material
        : [hit.object.material];
      return materials.some(
        (material) => material.visible && material.depthWrite && !material.transparent,
      );
    });
    this.options.anchor.worldToLocal(this.point);
    return (
      !covered &&
      this.point.z >= -0.14 &&
      Math.abs(Math.hypot(this.point.x, this.point.z) - SEASON_MODEL.trackRadius) < 0.16
    );
  }

  private down = (event: PointerEvent): void => {
    if (this.pointerId !== null) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.button !== 0 || !this.pick(event.clientX, event.clientY)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.pointerId = event.pointerId;
    this.navigationWasEnabled = this.options.navigation.enabled;
    this.options.navigation.enabled = false;
    this.options.canvas.setPointerCapture(event.pointerId);
    this.options.canvas.style.cursor = 'grabbing';
    this.element.focus({ preventScroll: true });
    this.setValue(seasonProgressFromPoint(this.point.x, this.point.z));
  };

  private move = (event: PointerEvent): void => {
    if (this.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.pointOnDial(event.clientX, event.clientY)) {
        this.options.anchor.worldToLocal(this.point);
        this.setValue(seasonProgressFromPoint(this.point.x, this.point.z));
      }
    } else if (
      this.pointerId === null &&
      event.target === this.options.canvas &&
      this.pick(event.clientX, event.clientY)
    ) {
      event.preventDefault();
      this.options.canvas.style.cursor = 'grab';
    }
  };

  private up = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) return;
    this.move(event);
    this.finish();
  };

  private cancel = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.finish();
  };

  private finish = (): void => {
    if (this.pointerId === null) return;
    if (this.options.canvas.hasPointerCapture(this.pointerId))
      this.options.canvas.releasePointerCapture(this.pointerId);
    this.pointerId = null;
    this.options.navigation.enabled = this.navigationWasEnabled && this.options.canInteract();
    this.options.canvas.style.cursor = '';
  };

  private input = (): void => this.setValue(Number(this.element.value));
  private keydown = (event: KeyboardEvent): void => {
    const steps: Record<string, number> = {
      ArrowRight: 0.02,
      ArrowUp: 0.02,
      ArrowLeft: -0.02,
      ArrowDown: -0.02,
      PageUp: 0.1,
      PageDown: -0.1,
    };
    if (event.key === 'Home' || event.key === 'End' || event.key in steps) {
      event.preventDefault();
      this.setValue(
        event.key === 'Home' ? 0 : event.key === 'End' ? 1 : this.value + steps[event.key],
      );
    }
  };
  private focus = (): void => {
    this.focused = true;
    this.updateFocus();
  };
  private blur = (): void => {
    this.focused = false;
    this.updateFocus();
  };
  private updateFocus(): void {
    this.knobMaterial.emissiveIntensity = this.focused && this.enabled ? 0.5 : 0;
  }

  dispose(): void {
    this.finish();
    this.element.removeEventListener('input', this.input);
    this.element.removeEventListener('keydown', this.keydown);
    this.element.removeEventListener('focus', this.focus);
    this.element.removeEventListener('blur', this.blur);
    this.options.canvas.removeEventListener('pointerdown', this.down, true);
    window.removeEventListener('pointermove', this.move, true);
    window.removeEventListener('pointerup', this.up, true);
    window.removeEventListener('pointercancel', this.cancel, true);
    window.removeEventListener('blur', this.finish);
    this.element.remove();
    // Scene traversal owns geometry and material disposal.
  }
}
