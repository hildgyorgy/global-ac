import * as THREE from 'three/webgpu';

interface Instrument {
  button: HTMLButtonElement;
  hit: THREE.Mesh;
  face: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardNodeMaterial>;
  rim: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardNodeMaterial>;
  label: THREE.Mesh;
  light: number;
  pulseUntil: number;
  onClick: () => void;
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
  private gesture: {
    id: number;
    x: number;
    y: number;
    time: number;
    index: number;
    cancelled: boolean;
  } | null = null;
  private readonly brass = new THREE.MeshStandardNodeMaterial({
    color: 0xc5a268,
    metalness: 0.67,
    roughness: 0.33,
    emissive: 0x39230c,
    emissiveIntensity: 0.22,
  });
  private previousFrame = performance.now();
  private roomIllumination = 1;
  private titleLabel!: THREE.Mesh;

  constructor(
    container: HTMLElement,
    private readonly element: HTMLElement,
    anchor: THREE.Group,
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    element.className = 'instrument-controls accessible-instruments';
    container.append(element);
    anchor.add(this.group);
    this.addTitle();
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
    buttons.forEach((button, index) =>
      this.addInstrument(button, (index - (buttons.length - 1) / 2) * 1.55),
    );
    canvas.addEventListener('pointerdown', this.down, true);
    window.addEventListener('pointermove', this.move, true);
    window.addEventListener('pointerup', this.up, true);
    window.addEventListener('pointercancel', this.cancel);
    window.addEventListener('blur', this.clear);
  }

  private lettering(
    text: string,
    width: number,
    height: number,
    size = 68,
    reference?: string,
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = text.length > 20 ? 1536 : 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px Georgia, 'Times New Roman', serif`;
    const center = canvas.width / 2,
      maxWidth = canvas.width - 32;
    const grain = ctx.createLinearGradient(0, 85, 0, 175);
    grain.addColorStop(0, '#d7b982');
    grain.addColorStop(0.45, '#a47f48');
    grain.addColorStop(1, '#d2af71');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#211409';
    ctx.fillStyle = grain;
    if (reference) {
      // One shared horizontal font scale, calibrated to PROJECTION. Shorter
      // labels keep the same glyph proportions and leave more empty space.
      ctx.translate(center, 0);
      const referenceWidth = Math.max(
        ctx.measureText(reference).width,
        ctx.measureText('JET-STREAMS').width,
        ctx.measureText('AZORES HIGH').width,
      );
      ctx.scale(Math.min(1, maxWidth / referenceWidth), 1);
      ctx.strokeText(text, 1, 131);
      ctx.fillText(text, 0, 128);
    } else {
      ctx.strokeText(text, center + 1, 131, maxWidth);
      ctx.fillText(text, center, 128, maxWidth);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.textures.push(texture);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardNodeMaterial({
        map: texture,
        alphaTest: 0.15,
        roughness: 0.68,
        metalness: 0.15,
        emissive: 0x80603a,
        emissiveMap: texture,
        emissiveIntensity: 0.42,
      }),
    );
    mesh.position.z = 0.002;
    this.group.add(mesh);
    return mesh;
  }

  private addTitle(): void {
    const title = this.lettering('Global Atmospheric Circulation', 3.15, 0.33, 130);
    this.titleLabel = title;
    title.position.set(0, 0.56, 0.002);
    for (const y of [0.425, 0.695]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.006, 0.002), this.brass);
      line.position.set(0, y, 0.001);
      this.group.add(line);
    }
  }

  private addInstrument(button: HTMLButtonElement, x: number): void {
    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.64),
      new THREE.MeshBasicNodeMaterial({ visible: false }),
    );
    hit.position.set(x, 0, 0.01);
    this.group.add(hit);
    const pill = (width: number, height: number) => {
      const r = height / 2,
        a = width / 2 - r;
      const shape = new THREE.Shape();
      shape.moveTo(-a, -r);
      shape.lineTo(a, -r);
      shape.absarc(a, 0, r, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(-a, r);
      shape.absarc(-a, 0, r, Math.PI / 2, Math.PI * 1.5, false);
      shape.closePath();
      return new THREE.ShapeGeometry(shape, 32);
    };
    const rim = new THREE.Mesh(pill(1.35, 0.36), this.brass.clone());
    rim.position.set(x, 0, 0.001);
    this.group.add(rim);
    const face = new THREE.Mesh(
      pill(1.3, 0.31),
      new THREE.MeshStandardNodeMaterial({
        color: 0x100f0b,
        roughness: 0.55,
        metalness: 0.25,
        emissive: 0x95632d,
        emissiveIntensity: 0.025,
      }),
    );
    face.position.set(x, 0, 0.003);
    this.group.add(face);
    const label = this.lettering(
      (button.textContent ?? '').toUpperCase(),
      1.1,
      0.29,
      180,
      'PROJECTION',
    );
    label.position.set(x, 0, 0.005);
    const item: Instrument = {
      button,
      hit,
      face,
      rim,
      label,
      light: 0,
      pulseUntil: 0,
      onClick: () => {
        item.pulseUntil = performance.now() + 550;
      },
    };
    button.addEventListener('click', item.onClick);
    this.instruments.push(item);
  }

  render(): void {
    const now = performance.now();
    const easing = 1 - Math.exp(-Math.min(0.05, (now - this.previousFrame) / 1000) * 10);
    this.previousFrame = now;
    const darkRoom = 1 - this.roomIllumination;
    for (const item of this.instruments) {
      const toggle = item.button.hasAttribute('aria-pressed');
      const on = toggle
        ? item.button.getAttribute('aria-pressed') === 'true'
        : now < item.pulseUntil;
      item.light = THREE.MathUtils.lerp(item.light, on ? 1 : 0, easing);
      item.face.material.emissiveIntensity = 0.025 + darkRoom * 0.03 + item.light * 0.38;
      item.rim.material.emissiveIntensity =
        0.18 +
        darkRoom * 0.45 +
        item.light * 0.85 +
        (document.activeElement === item.button ? 0.7 : 0);
      const label = item.label.material as THREE.MeshStandardNodeMaterial;
      label.emissiveIntensity = 0.3 + darkRoom * 0.65 + item.light * 1.7;
      label.color.setScalar(0.72 + item.light * 0.28);
    }
  }

  setRoomIllumination(level: number): void {
    this.roomIllumination = level;
    // Title and decorative rules belong to the room. Button faces, labels
    // and cloned rims remain self-lit in the dark projection view.
    (this.titleLabel.material as THREE.MeshStandardNodeMaterial).emissiveIntensity = 0.42 * level;
    this.brass.emissiveIntensity = 0.22 * level;
  }

  private pick(x: number, y: number): number {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      (-(y - rect.top) / rect.height) * 2 + 1,
    );
    this.group.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(
      this.instruments.map((item) => item.hit),
      false,
    )[0];
    if (hit) {
      let root: THREE.Object3D = this.group;
      while (root.parent) root = root.parent;
      // An opaque globe or prop can cover a control. Sparse particles do not
      // block taps, but the solid Earth must not become a click-through UI.
      const covered = this.raycaster.intersectObject(root, true).some((candidate) => {
        if (candidate.distance >= hit.distance - 0.001) return false;
        const mesh = candidate.object;
        if (!(mesh instanceof THREE.Mesh)) return false;
        for (let object: THREE.Object3D | null = mesh; object; object = object.parent) {
          if (object === this.group) return false;
          if (!object.visible) return false;
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        return materials.some(
          (material) => material.visible && material.depthWrite && !material.transparent,
        );
      });
      if (covered) return -1;
    }
    return hit ? this.instruments.findIndex((item) => item.hit === hit.object) : -1;
  }

  private down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointers.add(event.pointerId);
    if (this.pointers.size > 1) {
      if (this.gesture) this.gesture.cancelled = true;
      return;
    }
    const index = this.pick(event.clientX, event.clientY);
    if (index < 0) return;
    this.gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      index,
      cancelled: false,
    };
  };

  private move = (event: PointerEvent): void => {
    if (!this.pointers.size && event.target === this.canvas) {
      this.canvas.style.cursor = this.pick(event.clientX, event.clientY) >= 0 ? 'pointer' : '';
    }
    if (
      this.gesture?.id === event.pointerId &&
      Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 7
    ) {
      this.gesture.cancelled = true;
    }
  };

  private up = (event: PointerEvent): void => {
    this.move(event);
    this.pointers.delete(event.pointerId);
    const gesture = this.gesture;
    if (gesture?.id !== event.pointerId) return;
    this.gesture = null;
    if (
      gesture.cancelled ||
      performance.now() - gesture.time > 450 ||
      this.pick(event.clientX, event.clientY) !== gesture.index
    )
      return;
    event.preventDefault();
    this.instruments[gesture.index].button.click();
  };

  private cancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.gesture = null;
  };
  private clear = (): void => {
    this.pointers.clear();
    this.gesture = null;
  };

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.down, true);
    window.removeEventListener('pointermove', this.move, true);
    window.removeEventListener('pointerup', this.up, true);
    window.removeEventListener('pointercancel', this.cancel);
    window.removeEventListener('blur', this.clear);
    this.textures.forEach((texture) => texture.dispose());
    this.instruments.forEach((item) => item.button.removeEventListener('click', item.onClick));
    // App scene traversal owns geometry/material cleanup.
    this.element.remove();
  }
}
