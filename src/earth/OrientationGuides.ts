import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';

/** Quiet instrument markings in the globe's own tilted coordinate frame. */
export class OrientationGuides extends THREE.Group {
  private readonly globeGuides = new THREE.Group();
  private readonly sectionGuides = new THREE.Group();
  private readonly meridians = new THREE.Group();

  constructor() {
    super();
    const radius = CONFIG.earth.radius;
    const axisExtent = radius + CONFIG.atmosphere.equatorialShellThickness + 0.18;
    const axisMaterial = new THREE.LineBasicNodeMaterial({
      color: 0xb49767, transparent: true, opacity: 0.48, depthWrite: false,
    });
    const equatorMaterial = new THREE.LineBasicNodeMaterial({
      color: 0x99815b, transparent: true, opacity: 0.32, depthWrite: false,
    });
    const latitudeMaterial = new THREE.LineBasicNodeMaterial({
      color: 0x99815b, transparent: true, opacity: 0.20, depthWrite: false,
    });
    const line = (points: THREE.Vector3[], material: THREE.LineBasicNodeMaterial) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);

    const longitudeMaterial = new THREE.LineBasicNodeMaterial({
      color: 0x99815b, transparent: true, opacity: 0.24, depthWrite: false,
    });
    // Twelve pole-to-pole semicircles, 30° apart, rotating with the ground.
    for (let degrees = 0; degrees < 360; degrees += 30) {
      const longitude = THREE.MathUtils.degToRad(degrees);
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i += 1) {
        const latitude = -Math.PI / 2 + i / 128 * Math.PI;
        const ringRadius = (radius + 0.004) * Math.cos(latitude);
        points.push(new THREE.Vector3(
          ringRadius * Math.cos(longitude),
          (radius + 0.004) * Math.sin(latitude),
          ringRadius * Math.sin(longitude),
        ));
      }
      this.meridians.add(line(points, longitudeMaterial));
    }
    this.globeGuides.add(this.meridians);

    // Normal depth testing hides the axis inside the solid globe and the far
    // half of the equator behind the Earth.
    this.globeGuides.add(line([
      new THREE.Vector3(0, -axisExtent, 0),
      new THREE.Vector3(0, axisExtent, 0),
    ], axisMaterial));

    // The tropics and polar circles follow the same obliquity as the axis.
    const obliquity = Math.abs(CONFIG.earth.axialTiltDegrees);
    const latitudes = [0, obliquity, -obliquity, 90 - obliquity, -(90 - obliquity)];
    for (const degrees of latitudes) {
      const latitude = THREE.MathUtils.degToRad(degrees);
      const material = degrees === 0 ? equatorMaterial : latitudeMaterial;
      const surfaceRadius = radius + 0.003;
      const circleRadius = surfaceRadius * Math.cos(latitude);
      const height = surfaceRadius * Math.sin(latitude);
      const circle: THREE.Vector3[] = [];
      for (let i = 0; i <= 256; i += 1) {
        const angle = i / 256 * Math.PI * 2;
        circle.push(new THREE.Vector3(
          Math.cos(angle) * circleRadius, height,
          Math.sin(angle) * circleRadius,
        ));
      }
      this.globeGuides.add(line(circle, material));

      // A meridional cut intersects a parallel at two surface points. The
      // connecting chord is a quiet orientation guide across the cut face.
      const halfChord = radius * Math.cos(latitude);
      const sectionHeight = radius * Math.sin(latitude);
      this.sectionGuides.add(line([
        new THREE.Vector3(-halfChord, sectionHeight, -0.09),
        new THREE.Vector3(halfChord, sectionHeight, -0.09),
      ], material));
    }

    // In section, both markings lie just in front of the opaque cut face.
    this.sectionGuides.add(line([
      new THREE.Vector3(0, -axisExtent, -0.09),
      new THREE.Vector3(0, axisExtent, -0.09),
    ], axisMaterial));
    this.sectionGuides.visible = false;
    this.add(this.globeGuides, this.sectionGuides);
  }

  setSectionVisible(section: boolean): void {
    this.globeGuides.visible = !section;
    this.sectionGuides.visible = section;
  }

  setSpinAngle(angle: number): void {
    this.meridians.rotation.y = angle + CONFIG.earth.rotationRadians;
  }
}
