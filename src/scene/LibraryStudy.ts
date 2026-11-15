import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SEASON_MODEL } from './SeasonModel';

const DESK_Y = -1.86;

/** A small, entirely code-built observatory desk. No downloaded models or
 * background photographs: all props remain solid as the camera moves. */
export class LibraryStudy extends THREE.Group {
  readonly lampPosition = new THREE.Vector3(...SEASON_MODEL.lampPosition);
  readonly seasonAnchor = new THREE.Group();
  readonly controlAnchor = new THREE.Group();
  private readonly textures: THREE.Texture[] = [];
  private readonly brass = new THREE.MeshStandardNodeMaterial({
    color: 0x927044,
    metalness: 0.62,
    roughness: 0.38,
    emissive: 0x120b03,
    emissiveIntensity: 0.22,
  });
  private readonly darkBrass = new THREE.MeshStandardNodeMaterial({
    color: 0x40311c,
    metalness: 0.48,
    roughness: 0.6,
  });
  private randomState = 137;
  private readonly materialDimmers = new Map<THREE.MeshStandardNodeMaterial, number>();
  private readonly unlitDimmers = new Map<
    THREE.MeshBasicNodeMaterial | THREE.LineBasicNodeMaterial,
    THREE.Color
  >();

  constructor() {
    super();
    const wood = this.woodTexture();
    const walnut = new THREE.MeshStandardNodeMaterial({
      map: wood,
      roughness: 0.56,
      metalness: 0.04,
    });
    const desktop = new THREE.Mesh(new RoundedBoxGeometry(10, 0.23, 6.6, 2, 0.035), walnut);
    desktop.position.y = DESK_Y - 0.115;
    desktop.receiveShadow = true;
    this.add(desktop);
    this.box(10.05, 0.07, 6.65, this.darkBrass, 0, DESK_Y - 0.25, 0);
    this.box(9.8, 0.27, 0.15, walnut, 0, DESK_Y - 0.41, 3.12);
    for (const x of [-4.25, 4.25]) {
      for (const z of [-2.5, 2.5]) this.box(0.24, 2.4, 0.24, walnut, x, DESK_Y - 1.4, z);
    }
    // Fine joints between broad walnut planks.
    const seam = new THREE.MeshStandardNodeMaterial({ color: 0x0c0704, roughness: 1 });
    for (const z of [-2.3, -1.1, 0.1, 1.3, 2.5])
      this.box(10, 0.002, 0.008, seam, 0, DESK_Y + 0.001, z);
    this.createLevitationPlate();
    this.seasonAnchor.position.y = DESK_Y + 0.085;
    this.add(this.seasonAnchor);
    this.createLamp();
    this.createParchment(-2.45, 1.05, -0.23);
    this.createInkAndQuill();
    this.createBookStack(-2.8, -1.3);
    this.createScroll(3.1, -0.9);
    this.createRoom(walnut);

    // Inlaid instruments lie flush along the near long edge of the desktop.
    this.controlAnchor.position.set(0, DESK_Y + 0.008, 2.35);
    this.controlAnchor.rotation.x = -Math.PI / 2;
    this.add(this.controlAnchor);
    // Capture only room materials now. DeskControls is attached later and
    // keeps its own emissive button lighting independent of the reading lamp.
    this.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardNodeMaterial) {
          this.materialDimmers.set(material, material.emissiveIntensity);
        } else if (
          material instanceof THREE.MeshBasicNodeMaterial ||
          material instanceof THREE.LineBasicNodeMaterial
        ) {
          this.unlitDimmers.set(material, material.color.clone());
        }
      }
    });
  }

  setIllumination(level: number): void {
    for (const [material, intensity] of this.materialDimmers)
      material.emissiveIntensity = intensity * level;
    // Includes the visible bulb, the warm shade underside and plate light pool.
    for (const [material, color] of this.unlitDimmers)
      material.color.copy(color).multiplyScalar(level);
  }

  private random(): number {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private canvasTexture(
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas textures are unavailable.');
    draw(context);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.push(texture);
    return texture;
  }

  private woodTexture(): THREE.CanvasTexture {
    return this.canvasTexture(1024, 512, (ctx) => {
      ctx.fillStyle = '#352218';
      ctx.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 1800; i++) {
        const y = this.random() * 512;
        const phase = this.random() * 20;
        ctx.strokeStyle =
          this.random() > 0.5
            ? `rgba(123,82,42,${this.random() * 0.15})`
            : `rgba(7,4,2,${this.random() * 0.28})`;
        ctx.lineWidth = 0.3 + this.random() * 2;
        ctx.beginPath();
        for (let x = 0; x <= 1024; x += 12) {
          const bend = Math.sin(x * 0.007 + phase) * 3 + Math.sin(x * 0.021 + phase) * 0.6;
          if (x === 0) ctx.moveTo(x, y + bend);
          else ctx.lineTo(x, y + bend);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = '#9a704322';
        ctx.lineWidth = 0.7;
        const x = this.random() * 1024,
          y = this.random() * 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + this.random() * 75, y + 0.5);
        ctx.stroke();
      }
    });
  }

  private box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Group = this,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private cylinder(
    radius: number,
    height: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Group = this,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private createLevitationPlate(): void {
    this.cylinder(1.27, 0.065, this.darkBrass, 0, DESK_Y + 0.012, 0);
    this.cylinder(1.23, 0.018, this.brass, 0, DESK_Y + 0.05, 0);
    const engraving = this.canvasTexture(1024, 1024, (ctx) => {
      ctx.fillStyle = '#29291e';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.translate(512, 512);
      ctx.strokeStyle = '#a88e58';
      ctx.lineWidth = 1.2;
      for (const r of [210, 320, 405, 448, 464, 487]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 120; i++) {
        ctx.save();
        ctx.rotate((i / 120) * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, 477);
        ctx.lineTo(0, i % 5 ? 465 : 443);
        ctx.stroke();
        ctx.restore();
      }
      ctx.font = '21px Georgia';
      ctx.fillStyle = '#b49d69';
      ctx.textAlign = 'center';
      for (const [text, angle] of [
        ['SEPTENTRIO', 0],
        ['ORIENS', Math.PI / 2],
        ['MERIDIES', Math.PI],
        ['OCCIDENS', Math.PI * 1.5],
      ] as const) {
        ctx.save();
        ctx.rotate(angle);
        ctx.fillText(text, 0, -420);
        ctx.restore();
      }
      // Solar instrument face: the moving fader represents Earth on a half-orbit.
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#d2ad6b';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = '#9d743c55';
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 16; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 8);
        ctx.beginPath();
        ctx.moveTo(0, -76);
        ctx.lineTo(0, i % 2 ? -112 : -142);
        ctx.stroke();
        ctx.restore();
      }
      ctx.font = '24px Georgia';
      ctx.fillStyle = '#c5a165';
      ctx.fillText('SOL', 0, 173);
      ctx.globalAlpha = 1;
      ctx.font = '34px Georgia';
      for (const [name, x] of [
        ['DECEMBER', -330],
        ['JUNE', 330],
      ] as const) {
        ctx.fillStyle = '#29291e';
        ctx.fillRect(x - 120, 112, 240, 50);
        ctx.fillStyle = '#c5a165';
        ctx.fillText(name, x, 149);
      }
    });
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(1.205, 128),
      new THREE.MeshStandardNodeMaterial({
        map: engraving,
        roughness: 0.52,
        metalness: 0.26,
        emissiveMap: engraving,
        emissive: 0xffffff,
        emissiveIntensity: 0.22,
      }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = DESK_Y + 0.061;
    face.receiveShadow = true;
    this.add(face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.009, 8, 128), this.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = DESK_Y + 0.057;
    this.add(ring);
    // A very faint pool, not a support beam or a semicircular cradle.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(0.88, 64),
      new THREE.MeshBasicNodeMaterial({
        color: 0x536b70,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = DESK_Y + 0.064;
    this.add(pool);
  }

  private createLamp(): void {
    const x = this.lampPosition.x,
      z = this.lampPosition.z;
    this.cylinder(0.36, 0.08, this.darkBrass, x, DESK_Y + 0.04, z);
    this.cylinder(0.28, 0.025, this.brass, x, DESK_Y + 0.095, z);
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, DESK_Y + 0.1, z),
      new THREE.Vector3(x - 0.12, -0.9, z),
      new THREE.Vector3(x - 0.3, 1.0, z),
      new THREE.Vector3(x - 0.12, 1.98, z),
      new THREE.Vector3(x, 2.03, z),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(path, 48, 0.027, 10, false), this.brass);
    arm.castShadow = true;
    this.add(arm);
    // Old shaded reading lamp: dark enamel outside, warm ivory inside.
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.46, 0.36, 64, 1, true),
      new THREE.MeshStandardNodeMaterial({
        color: 0x243b32,
        roughness: 0.39,
        metalness: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    shade.position.set(x, 1.84, z);
    this.add(shade);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.014, 8, 64), this.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 1.66, z);
    this.add(rim);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 16, 12),
      new THREE.MeshBasicNodeMaterial({ color: 0xffd69c }),
    );
    bulb.position.copy(this.lampPosition);
    this.add(bulb);
    const underShade = new THREE.Mesh(
      new THREE.CircleGeometry(0.39, 48),
      new THREE.MeshBasicNodeMaterial({
        color: 0xffc777,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    underShade.rotation.x = Math.PI / 2;
    underShade.position.set(x, 1.67, z);
    this.add(underShade);
  }

  private createParchment(x: number, z: number, angle: number): void {
    const map = this.canvasTexture(1024, 700, (ctx) => {
      ctx.fillStyle = '#b7a279';
      ctx.fillRect(0, 0, 1024, 700);
      const vignette = ctx.createRadialGradient(500, 330, 90, 500, 330, 650);
      vignette.addColorStop(0, '#e4d2a1');
      vignette.addColorStop(1, '#82613d');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 1024, 700);
      for (let i = 0; i < 16000; i++) {
        ctx.fillStyle = this.random() < 0.5 ? '#fff7db0c' : '#4a28190b';
        ctx.fillRect(this.random() * 1024, this.random() * 700, 1.5, 1.5);
      }
      ctx.fillStyle = '#443922';
      ctx.font = 'italic 42px Georgia';
      ctx.fillText('De motu aeris', 80, 85);
      ctx.strokeStyle = '#5b4e32';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(330, 365, 182, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(330, 365, 65, 182, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (const dy of [-90, 0, 90]) {
        ctx.beginPath();
        ctx.ellipse(330, 365 + dy, Math.sqrt(182 ** 2 - dy ** 2), 23, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = 'italic 20px Georgia';
      ctx.fillText('Septentrio', 273, 154);
      ctx.fillText('Æquator', 530, 370);
      for (let row = 0; row < 15; row++) {
        ctx.beginPath();
        const y = 170 + row * 26;
        ctx.moveTo(630, y);
        for (let col = 0; col < 32; col++)
          ctx.lineTo(630 + col * 8, y + Math.sin(col * 2 + row) * (this.random() * 8));
        ctx.stroke();
      }
      ctx.font = 'italic 18px Georgia';
      ctx.fillText('Observatio · venti perpetui', 82, 630);
    });
    const geometry = new THREE.PlaneGeometry(1.85, 1.25, 32, 24);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const u = Math.abs(positions.getX(i)) / 0.925;
      positions.setZ(i, 0.07 * u ** 10 + 0.008 * Math.sin(positions.getY(i) * 8));
    }
    geometry.computeVertexNormals();
    const page = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardNodeMaterial({ map, roughness: 1, side: THREE.DoubleSide }),
    );
    page.rotation.set(-Math.PI / 2, 0, angle);
    page.position.set(x, DESK_Y + 0.026, z);
    page.castShadow = true;
    page.receiveShadow = true;
    this.add(page);
  }

  private createInkAndQuill(): void {
    const set = new THREE.Group();
    set.position.set(2.6, DESK_Y, 0.85);
    this.add(set);
    const glass = new THREE.MeshStandardNodeMaterial({
      color: 0x071e19,
      roughness: 0.17,
      metalness: 0.28,
    });
    const bottle = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.1, 0),
          new THREE.Vector2(0.17, 0.025),
          new THREE.Vector2(0.17, 0.2),
          new THREE.Vector2(0.1, 0.26),
          new THREE.Vector2(0.085, 0.28),
          new THREE.Vector2(0.085, 0.36),
        ],
        32,
      ),
      glass,
    );
    bottle.castShadow = true;
    set.add(bottle);
    this.cylinder(0.09, 0.025, this.brass, 0, 0.34, 0, set);
    this.cylinder(
      0.073,
      0.005,
      new THREE.MeshStandardNodeMaterial({ color: 0x010303, roughness: 0.12 }),
      0,
      0.356,
      0,
      set,
    );
    this.cylinder(0.095, 0.035, this.brass, 0.3, 0.025, 0.08, set);
    const quill = new THREE.Group();
    quill.position.set(0, 0.26, 0);
    quill.rotation.z = -0.3;
    quill.rotation.y = -0.35;
    set.add(quill);
    const featherMaterial = new THREE.MeshStandardNodeMaterial({
      color: 0xa19378,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const feather = new THREE.Shape();
    feather.moveTo(0, 0.23);
    feather.quadraticCurveTo(-0.34, 0.74, 0.04, 1.65);
    feather.quadraticCurveTo(0.4, 0.86, 0, 0.23);
    const vane = new THREE.Mesh(new THREE.ShapeGeometry(feather, 32), featherMaterial);
    vane.castShadow = true;
    vane.receiveShadow = true;
    quill.add(vane);
    const rachis = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.008),
      new THREE.Vector3(0, 0.6, 0.015),
      new THREE.Vector3(0.04, 1.65, 0.008),
    ]);
    const shaft = new THREE.Mesh(
      new THREE.TubeGeometry(rachis, 24, 0.007, 6, false),
      featherMaterial,
    );
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    quill.add(shaft);
    const barbs: THREE.Vector3[] = [];
    for (let i = 0; i < 35; i++) {
      const y = 0.32 + i * 0.034;
      const width = Math.sin(((y - 0.23) / 1.42) * Math.PI) * 0.17;
      barbs.push(new THREE.Vector3(0.02, y, 0.014), new THREE.Vector3(-width, y + 0.13, 0.014));
      barbs.push(new THREE.Vector3(0.02, y, 0.015), new THREE.Vector3(width, y + 0.12, 0.015));
    }
    // Fine raised fibres receive the same lamp and room fill as the vane.
    // Instancing keeps all fibres in one draw, without unlit line materials.
    const fibres = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.0007, 0.0007, 1, 3),
      new THREE.MeshStandardNodeMaterial({ color: 0x71654f, roughness: 1 }),
      barbs.length / 2,
    );
    const transform = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < barbs.length; i += 2) {
      const start = barbs[i],
        end = barbs[i + 1];
      const direction = end.clone().sub(start);
      transform.position.copy(start).add(end).multiplyScalar(0.5);
      transform.scale.set(1, direction.length(), 1);
      transform.quaternion.setFromUnitVectors(up, direction.normalize());
      transform.updateMatrix();
      fibres.setMatrixAt(i / 2, transform.matrix);
    }
    fibres.instanceMatrix.needsUpdate = true;
    fibres.receiveShadow = true;
    quill.add(fibres);
    // Spare brass nib pen resting on the desk next to the ink.
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.95, 12), this.darkBrass);
    pen.rotation.set(Math.PI / 2, 0, -0.4);
    pen.position.set(0.1, 0.04, 0.48);
    set.add(pen);
  }

  private createBookStack(x: number, z: number): void {
    for (let i = 0; i < 3; i++) {
      const book = new THREE.Group();
      book.position.set(x + i * 0.04, DESK_Y + 0.04 + i * 0.2, z);
      book.rotation.y = (i - 1) * 0.17;
      this.add(book);
      const leather = new THREE.MeshStandardNodeMaterial({
        color: [0x26372c, 0x472c24, 0x39372a][i],
        roughness: 0.78,
      });
      const paper = new THREE.MeshStandardNodeMaterial({ color: 0x9d8c66, roughness: 1 });
      this.box(1.25, 0.13, 0.78, paper, 0, 0.07, 0, book);
      this.box(1.34, 0.035, 0.85, leather, 0, -0.01, 0, book);
      this.box(1.34, 0.035, 0.85, leather, 0, 0.16, 0, book);
      this.box(0.055, 0.2, 0.85, leather, -0.65, 0.07, 0, book);
      for (const offset of [-0.25, 0.25])
        this.box(0.07, 0.005, 0.84, this.darkBrass, offset, 0.18, 0, book);
    }
  }

  private createScroll(x: number, z: number): void {
    const paper = new THREE.MeshStandardNodeMaterial({ color: 0xb6a27a, roughness: 0.92 });
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 1.1, 32), paper);
    scroll.rotation.set(Math.PI / 2, 0, -0.4);
    scroll.position.set(x, DESK_Y + 0.11, z);
    scroll.castShadow = true;
    this.add(scroll);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.108, 0.108, 0.055, 32),
      this.darkBrass,
    );
    band.rotation.copy(scroll.rotation);
    band.position.copy(scroll.position);
    this.add(band);
  }

  private createRoom(wood: THREE.Material): void {
    const wall = new THREE.MeshStandardNodeMaterial({ color: 0x111c19, roughness: 1 });
    this.box(18, 10, 0.2, wall, 0, 1.4, -4.6);
    this.box(18, 0.2, 16, wood, 0, -4.3, -1);
    for (const side of [-1, 1]) {
      const x = side * 3.65;
      const shelfWood = new THREE.MeshStandardNodeMaterial({ color: 0x22190f, roughness: 0.83 });
      this.box(2.8, 6.5, 0.12, shelfWood, x, -0.8, -4.35);
      for (const dx of [-1.45, 1.45]) this.box(0.16, 6.5, 0.65, shelfWood, x + dx, -0.8, -4.1);
      for (let row = 0; row < 5; row++) {
        const y = -3.9 + row * 1.3;
        this.box(3, 0.1, 0.7, shelfWood, x, y, -4.05);
        let cursor = -1.29;
        while (cursor < 1.27) {
          const width = 0.09 + this.random() * 0.14;
          const height = 0.67 + this.random() * 0.4;
          const palette = [0x343b29, 0x3a231e, 0x34302a, 0x1e302e, 0x49402a];
          const material = new THREE.MeshStandardNodeMaterial({
            color: palette[Math.floor(this.random() * palette.length)],
            roughness: 0.85,
          });
          this.box(
            width,
            height,
            0.4 + this.random() * 0.12,
            material,
            x + cursor,
            y + 0.06 + height / 2,
            -4.01,
          );
          for (const fraction of [0.17, 0.82])
            this.box(
              width * 0.88,
              0.012,
              0.006,
              this.darkBrass,
              x + cursor,
              y + 0.06 + height * fraction,
              -3.72,
            );
          cursor += width + 0.025;
        }
      }
    }
    // Central woodwork is intentionally almost lost in shadow.
    for (const x of [-1.65, 1.65]) this.box(0.06, 5.8, 0.05, this.darkBrass, x, -0.5, -4.43);
  }

  dispose(): void {
    for (const texture of this.textures) texture.dispose();
  }
}
