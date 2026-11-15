import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';

/** Engraved reference labels for the meridional display, in globe coordinates.
 * Geographic parallels are precise; horse latitudes are deliberately soft
 * illustrative belts, not additional fixed geographic circles.
 */
export class ProjectionAnnotations extends THREE.Group {
  private readonly textures: THREE.CanvasTexture[] = [];

  constructor() {
    super();
    this.addHorseLatitudeBelts();
    const tilt = Math.abs(CONFIG.earth.axialTiltDegrees);
    this.label('ARCTIC CIRCLE', `${(90 - tilt).toFixed(1)}° N`, -.03, .79, .61);
    this.label('TROPIC OF CANCER', `${tilt.toFixed(1)}° N`, -.39, .31, .74);
    this.label('EQUATOR', '0°', -.43, -.065, .48);
    this.label('TROPIC OF CAPRICORN', `${tilt.toFixed(1)}° S`, -.37, -.43, .80);
    this.label('ANTARCTIC CIRCLE', `${(90 - tilt).toFixed(1)}° S`, -.03, -.80, .68);
    this.label('HORSE LATITUDES', '≈30° N', .39, .56, .66);
    this.label('HORSE LATITUDES', '≈30° S', .39, -.49, .66);
    const axis = this.label('ROTATION AXIS', '', .055, .04, .57);
    // The axis label follows the axis; other labels stay horizontal on screen.
    axis.rotation.z = Math.PI / 2;

    const material = new THREE.LineBasicNodeMaterial({
      color: 0x9f855d, transparent: true, opacity: .23, depthWrite: false,
    });
    const leader = (points: number[][]) => this.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y, -.083))), material,
    ));
    // Short leaders connect the exact circles to displaced lettering.
    const polarY = Math.sin(THREE.MathUtils.degToRad(90 - tilt));
    leader([[-.20, polarY], [-.20, .86], [-.12, .84]]);
    leader([[-.20, -polarY], [-.20, -.87], [-.12, -.85]]);
    const tropicY = Math.sin(THREE.MathUtils.degToRad(tilt));
    leader([[-.82, tropicY], [-.73, tropicY], [-.69, .35]]);
    leader([[-.82, -tropicY], [-.76, -tropicY], [-.71, -.40]]);
  }

  private texture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
    this.textures.push(texture); return texture;
  }

  private label(title: string, subtitle: string, x: number, y: number, width: number): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = Math.round(width * 1280); canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const center = canvas.width / 2;
    ctx.fillStyle = '#c1a77c'; ctx.font = '64px Georgia, "Times New Roman", serif';
    ctx.fillText(title, center, subtitle ? 58 : 96);
    if (subtitle) {
      ctx.fillStyle = '#8f805f'; ctx.font = '52px Georgia, "Times New Roman", serif';
      ctx.fillText(subtitle, center, 143);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 192 / 1280),
      new THREE.MeshBasicNodeMaterial({ map: this.texture(canvas), transparent: true,
        opacity: .78, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set(x, y, -.080);
    mesh.rotation.z = -THREE.MathUtils.degToRad(CONFIG.earth.axialTiltDegrees);
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
}
