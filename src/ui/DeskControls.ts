import * as THREE from 'three/webgpu';

interface Instrument {
  button: HTMLButtonElement;
  hit: THREE.Mesh;
  knob: THREE.Mesh;
  leftLabel?: THREE.Mesh;
  rightLabel?: THREE.Mesh;
  x: number;
}

/** Real WebGPU desk instruments share depth with the globe and its particles.
 * Native buttons retain keyboard/screen-reader access; pointer gestures hit
 * the physical controls, rather than an always-on-top DOM overlay.
 */
export class DeskControls {
  private readonly instruments: Instrument[] = [];
  private readonly textures: THREE.CanvasTexture[] = [];
  private readonly group = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly pointers = new Set<number>();
  private gesture: { id: number; x: number; y: number; time: number; index: number; cancelled: boolean } | null = null;
  private readonly brass = new THREE.MeshStandardNodeMaterial({
    color: 0xc5a268, metalness: .67, roughness: .33,
    emissive: 0x39230c, emissiveIntensity: .22,
  });
  private readonly recess = new THREE.MeshStandardNodeMaterial({ color: 0x0c100d, roughness: .65 });

  constructor(
    container: HTMLElement, private readonly element: HTMLElement, anchor: THREE.Group,
    private readonly canvas: HTMLCanvasElement, private readonly camera: THREE.PerspectiveCamera,
  ) {
    element.className = 'instrument-controls accessible-instruments';
    container.append(element);
    anchor.add(this.group);
    this.addTitle();
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
    buttons.forEach((button, index) => this.addInstrument(button, [-1.02, .57, 2.05][index]));
    canvas.addEventListener('pointerdown', this.down, true);
    window.addEventListener('pointermove', this.move, true);
    window.addEventListener('pointerup', this.up, true);
    window.addEventListener('pointercancel', this.cancel);
    window.addEventListener('blur', this.clear);
  }

  private lettering(text: string, width: number, height: number, size = 68): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = text.length > 20 ? 1536 : 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${size}px Georgia, 'Times New Roman', serif`;
    const center = canvas.width / 2, maxWidth = canvas.width - 32;
    ctx.lineWidth = 4; ctx.strokeStyle = '#211409'; ctx.strokeText(text, center + 1, 131, maxWidth);
    const grain = ctx.createLinearGradient(0, 85, 0, 175);
    grain.addColorStop(0, '#d7b982'); grain.addColorStop(.45, '#a47f48'); grain.addColorStop(1, '#d2af71');
    ctx.fillStyle = grain; ctx.fillText(text, center, 128, maxWidth);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8; this.textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardNodeMaterial({ map: texture, alphaTest: .15, roughness: .68,
        metalness: .15, emissive: 0x80603a, emissiveMap: texture, emissiveIntensity: .42 }));
    mesh.position.z = .002; this.group.add(mesh); return mesh;
  }

  private addTitle(): void {
    const title = this.lettering('Global Atmospheric Circulation', 3.15, .46, 130);
    title.position.set(-3.28, 0, .002);
    for (const y of [-.19, .19]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(3.02, .006, .002), this.brass);
      line.position.set(-3.28, y, .001); this.group.add(line);
    }
  }

  private addInstrument(button: HTMLButtonElement, x: number): void {
    const toggle = button.getAttribute('role') === 'switch';
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(toggle ? 1.47 : 1.26, .64),
      new THREE.MeshBasicNodeMaterial({ visible: false }));
    hit.position.set(x, 0, .01); this.group.add(hit);
    const ring = new THREE.Mesh(new THREE.CapsuleGeometry(.075, toggle ? .22 : 0, 6, 16), this.brass);
    ring.rotation.z = Math.PI / 2; ring.scale.z = .20;
    ring.position.set(x, -.055, .004); this.group.add(ring);
    const slot = new THREE.Mesh(new THREE.CapsuleGeometry(.062, toggle ? .22 : 0, 6, 16), this.recess);
    slot.rotation.z = Math.PI / 2; slot.scale.z = .22;
    slot.position.set(x, -.055, .009); this.group.add(slot);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(toggle ? .065 : .08, 24, 12), this.brass);
    knob.scale.z = .4; knob.position.set(x, -.055, .035);
    knob.castShadow = true; this.group.add(knob);
    const item: Instrument = { button, hit, knob, x };
    if (toggle) {
      const labels = [...button.querySelectorAll('.switch-label')].map(label => label.textContent ?? '');
      item.leftLabel = this.lettering(labels[0].toUpperCase(), .67, .26, 170);
      item.leftLabel.position.set(x - .37, .19, .002);
      item.rightLabel = this.lettering(labels[1].toUpperCase(), .64, .26, 170);
      item.rightLabel.position.set(x + .37, .19, .002);
    } else {
      const label = this.lettering('ALAPHELYZET', 1.13, .26, 170);
      label.position.set(x, .19, .002);
      const emblem = this.lettering('↺', .13, .13, 200);
      emblem.position.set(x, -.055, .07);
    }
    this.instruments.push(item);
  }

  render(): void {
    for (const item of this.instruments) {
      const toggle = item.button.getAttribute('role') === 'switch';
      const on = item.button.getAttribute('aria-checked') === 'true';
      const destination = item.x + (toggle ? (on ? .105 : -.105) : 0);
      item.knob.position.x = THREE.MathUtils.lerp(item.knob.position.x, destination, .16);
      for (const [label, active] of [[item.leftLabel, !on], [item.rightLabel, on]] as const) {
        if (label) (label.material as THREE.MeshStandardNodeMaterial).color.setScalar(active ? 1 : .55);
      }
      item.knob.scale.setScalar(document.activeElement === item.button ? 1.13 : 1);
      item.knob.scale.z *= .4;
    }
  }

  private pick(x: number, y: number): number {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.group.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.instruments.map(item => item.hit), false)[0];
    if (hit) {
      let root: THREE.Object3D = this.group;
      while (root.parent) root = root.parent;
      // An opaque globe or prop can cover a control. Sparse particles do not
      // block taps, but the solid Earth must not become a click-through UI.
      const covered = this.raycaster.intersectObject(root, true).some(candidate => {
        if (candidate.distance >= hit.distance - .001) return false;
        const mesh = candidate.object;
        if (!(mesh instanceof THREE.Mesh)) return false;
        for (let object: THREE.Object3D | null = mesh; object; object = object.parent) {
          if (object === this.group) return false;
          if (!object.visible) return false;
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        return materials.some(material => material.visible && material.depthWrite && !material.transparent);
      });
      if (covered) return -1;
    }
    return hit ? this.instruments.findIndex(item => item.hit === hit.object) : -1;
  }

  private down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointers.add(event.pointerId);
    if (this.pointers.size > 1) { if (this.gesture) this.gesture.cancelled = true; return; }
    const index = this.pick(event.clientX, event.clientY);
    if (index < 0) return;
    this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
      time: performance.now(), index, cancelled: false };
  };

  private move = (event: PointerEvent): void => {
    if (!this.pointers.size && event.target === this.canvas) {
      this.canvas.style.cursor = this.pick(event.clientX, event.clientY) >= 0 ? 'pointer' : '';
    }
    if (this.gesture?.id === event.pointerId && Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 7) {
      this.gesture.cancelled = true;
    }
  };

  private up = (event: PointerEvent): void => {
    this.move(event); this.pointers.delete(event.pointerId);
    const gesture = this.gesture;
    if (gesture?.id !== event.pointerId) return;
    this.gesture = null;
    if (gesture.cancelled || performance.now() - gesture.time > 450 || this.pick(event.clientX, event.clientY) !== gesture.index) return;
    event.preventDefault();
    this.instruments[gesture.index].button.click();
  };

  private cancel = (event: PointerEvent): void => { this.pointers.delete(event.pointerId); this.gesture = null; };
  private clear = (): void => { this.pointers.clear(); this.gesture = null; };

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.down, true);
    window.removeEventListener('pointermove', this.move, true);
    window.removeEventListener('pointerup', this.up, true);
    window.removeEventListener('pointercancel', this.cancel);
    window.removeEventListener('blur', this.clear);
    this.textures.forEach(texture => texture.dispose());
    // App scene traversal owns geometry/material cleanup.
    this.element.remove();
  }
}
