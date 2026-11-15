import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';

/** Engraved reference labels for the meridional display, in globe coordinates.
 * Geographic parallels are precise; horse latitudes are deliberately soft
 * illustrative belts, not additional fixed geographic circles.
 */
export class ProjectionAnnotations extends THREE.Group {
  private readonly textures: THREE.CanvasTexture[] = [];
  private readonly referenceOpacities = new Map<THREE.Material, number>();

  constructor() {
    super();
    this.addHorseLatitudeBelts();
    const tilt = Math.abs(CONFIG.earth.axialTiltDegrees);
    const tropicY = Math.sin(THREE.MathUtils.degToRad(tilt));
    const polarY = Math.sin(THREE.MathUtils.degToRad(90 - tilt));
    // Alignment anchors sit immediately beside the rotation axis. The
    // lettering shares the tilted latitude frame instead of facing upright.
    this.label('ARCTIC CIRCLE', `${(90 - tilt).toFixed(1)}° N`, -.055, polarY, .55, 'right', true);
    this.label('TROPIC OF CANCER', `${tilt.toFixed(1)}° N`, -.055, tropicY, .65, 'right');
    this.label('EQUATOR', '0°', -.055, 0, .43, 'right');
    this.label('TROPIC OF CAPRICORN', `${tilt.toFixed(1)}° S`, -.055, -tropicY, .70, 'right');
    this.label('ANTARCTIC CIRCLE', `${(90 - tilt).toFixed(1)}° S`, -.055, -polarY, .60, 'right');
    this.label('HORSE LATITUDES', '≈30° N', .055, .50, .60, 'left');
    this.label('HORSE LATITUDES', '≈30° S', .055, -.50, .60, 'left');
    this.label('ROTATION AXIS', '', .13, 1.37, .57, 'left');

    const material = new THREE.LineBasicNodeMaterial({
      color: 0x9f855d, transparent: true, opacity: .23, depthWrite: false,
    });
    const leader = (points: number[][]) => this.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y, -.083))), material,
    ));
    // Tag the exposed upper shaft, outside both the Earth and polar atmosphere.
    leader([[0, 1.37], [.10, 1.37]]);
  }

  private texture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
    this.textures.push(texture); return texture;
  }

  private label(title: string, subtitle: string, x: number, y: number, width: number,
    align: 'left' | 'right', flipped = false): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = Math.round(width * 1280); canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    const edge = align === 'right' ? canvas.width - 8 : 8;
    // The marked parallel passes through the texture centre (y=96): name
    // above and degrees below. At the Arctic Circle put the name inward.
    ctx.fillStyle = '#c1a77c'; ctx.font = '44px Georgia, "Times New Roman", serif';
    ctx.fillText(title, edge, subtitle ? (flipped ? 132 : 60) : 96);
    if (subtitle) {
      ctx.fillText(subtitle, edge, flipped ? 60 : 132);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 192 / 1280),
      new THREE.MeshBasicNodeMaterial({ map: this.texture(canvas), transparent: true,
        opacity: .78, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set(x + (align === 'right' ? -width / 2 : width / 2), y, -.080);
    this.add(mesh); return mesh;
  }

  private addHorseLatitudeBelts(): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(512, 512); ctx.scale(512, -512);
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.clip();
    // Illustrative 25–35° belts with feathered edges, centred near 30°.
    // They show the latitude range across the cut face, not a solid air mass.
    for (const hemisphere of [-1, 1]) {
      const lo = Math.sin(25 * Math.PI / 180) * hemisphere;
      const hi = Math.sin(35 * Math.PI / 180) * hemisphere;
      const low = Math.min(lo, hi), high = Math.max(lo, hi);
      const gradient = ctx.createLinearGradient(0, low, 0, high);
      gradient.addColorStop(0, 'rgba(175,135,72,0)');
      gradient.addColorStop(.48, 'rgba(175,135,72,0.09)');
      gradient.addColorStop(1, 'rgba(175,135,72,0)');
      ctx.fillStyle = gradient; ctx.fillRect(-1, low, 2, high - low);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicNodeMaterial({ map: this.texture(canvas), transparent: true,
        depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.z = -.092; this.add(mesh);
  }

  dispose(): void { this.textures.forEach(texture => texture.dispose()); }

  setOpacity(opacity: number): void {
    this.visible = opacity > .001;
    this.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!this.referenceOpacities.has(material)) this.referenceOpacities.set(material, material.opacity);
        material.opacity = this.referenceOpacities.get(material)! * opacity;
      }
    });
  }
}
