import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { GpuParticleSystem } from '../atmosphere/GpuParticleSystem';
import { createCameraRig, type CameraRig } from '../camera/createCameraRig';
import { CONFIG } from '../config';
import { Earth } from '../earth/Earth';
import { EarthSection } from '../earth/EarthSection';
import { OrientationGuides } from '../earth/OrientationGuides';
import { SectionSwitch } from '../ui/SectionSwitch';
import { createStarField } from '../scene/createStarField';

export class App {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGPURenderer;
  private readonly cameraRig: CameraRig;
  private readonly earth = new Earth();
  private readonly particles = new GpuParticleSystem();
  private readonly globe = new THREE.Group();
  private readonly rotatingGlobe = new THREE.Group();
  private spinAngle = 0;
  private previousFrameTime = 0;
  private readonly earthSection = new EarthSection();
  private readonly orientationGuides = new OrientationGuides();
  private readonly sectionSwitch: SectionSwitch;
  private readonly coriolisSwitch: SectionSwitch;
  private readonly instrumentControls = document.createElement('div');
  private readonly resetButton = document.createElement('button');
  private sectionEnabled = false;
  private sectionProgress = 0;
  private transitionStarted = 0;
  private transitionFrom = 0;
  private transitioning = false;
  private readonly savedCameraPosition = new THREE.Vector3();
  private readonly cameraStart = new THREE.Vector3();
  private readonly cameraDestination = new THREE.Vector3();
  private running = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGPURenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(CONFIG.renderer.background, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.append(this.renderer.domElement);

    this.cameraRig = createCameraRig(this.renderer.domElement);
    this.sectionSwitch = new SectionSwitch(this.setSectionEnabled);
    this.coriolisSwitch = new SectionSwitch(
      (enabled) => this.particles.setCoriolisEnabled(enabled),
      { label: 'Coriolis-hatás', off: 'Coriolis ki', on: 'Be' },
    );
    this.instrumentControls.className = 'instrument-controls';
    this.resetButton.type = 'button';
    this.resetButton.className = 'section-switch reset-button';
    this.resetButton.setAttribute('aria-label', 'Glóbusz alaphelyzetbe állítása');
    this.resetButton.innerHTML = '<span class="reset-emblem" aria-hidden="true">↺</span><span class="switch-label">Alaphelyzet</span>';
    this.resetButton.addEventListener('click', this.resetView);
    this.instrumentControls.append(this.sectionSwitch.element, this.coriolisSwitch.element, this.resetButton);
    container.append(this.instrumentControls);
    this.configureScene();
    window.addEventListener('resize', this.handleResize);
  }

  async start(): Promise<void> {
    if (!WebGPU.isAvailable()) {
      this.showWebGpuError();
      return;
    }

    await this.renderer.init();
    await this.particles.initialize(this.renderer);
    this.running = true;
    this.previousFrameTime = performance.now();
    this.renderer.setAnimationLoop(this.animate);
  }

  dispose(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);
    this.cameraRig.controls.dispose();
    this.sectionSwitch.dispose();
    this.coriolisSwitch.dispose();
    this.resetButton.removeEventListener('click', this.resetView);
    this.instrumentControls.remove();
    this.earth.dispose();
    this.particles.dispose();
    this.scene.traverse((object) => {
      if (object === this.particles) return;
      const disposable = object as unknown as {
        geometry?: { dispose(): void };
        material?: { dispose(): void };
      };
      disposable.geometry?.dispose();
      disposable.material?.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private configureScene(): void {
    this.scene.add(createStarField());

    const ambient = new THREE.AmbientLight(0x78909a, 0.13);
    const sun = new THREE.DirectionalLight(0xfff0d4, 3.4);
    sun.position.set(-3.5, 2.1, 4.5);
    this.scene.add(ambient, sun);

    this.globe.rotation.z = (CONFIG.earth.axialTiltDegrees * Math.PI) / 180;
    this.rotatingGlobe.add(this.earth, this.particles);
    this.globe.add(this.rotatingGlobe, this.earthSection, this.orientationGuides);
    this.scene.add(this.globe);
  }

  private animate = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const delta = Math.min(0.05, Math.max(0, (now - this.previousFrameTime) / 1000));
    this.previousFrameTime = now;
    this.spinAngle = (this.spinAngle + CONFIG.earth.spinRadiansPerSecond * delta) % (Math.PI * 2);
    this.rotatingGlobe.rotation.y = this.spinAngle;
    this.particles.setSpinAngle(this.spinAngle);
    this.particles.compute(this.renderer);
    this.updateSectionTransition();
    this.cameraRig.controls.update();
    this.renderer.render(this.scene, this.cameraRig.camera);
  };

  private setSectionEnabled = (enabled: boolean): void => {
    const { camera, controls } = this.cameraRig;
    if (enabled && !this.sectionEnabled) this.savedCameraPosition.copy(camera.position);
    this.sectionEnabled = enabled;
    this.transitionFrom = this.sectionProgress;
    this.transitionStarted = performance.now();
    this.cameraStart.copy(camera.position);
    this.cameraDestination.copy(enabled
      ? new THREE.Vector3(0, 0, this.sectionCameraDistance)
      : this.savedCameraPosition);
    controls.autoRotate = false;
    controls.maxDistance = enabled
      ? Math.max(CONFIG.camera.maxDistance, this.sectionCameraDistance * 1.5)
      : CONFIG.camera.maxDistance;
    controls.enabled = false;
    this.transitioning = true;
  };

  private resetView = (): void => {
    // Restore the initial globe view; preserve the atmospheric/Coriolis state.
    this.savedCameraPosition.set(0.1, 0.15, CONFIG.camera.distance);
    this.sectionSwitch.setEnabled(false);
    this.cameraRig.controls.target.set(0, 0, 0);
  };

  private updateSectionTransition(): void {
    if (!this.transitioning) return;
    const t = Math.min(1, (performance.now() - this.transitionStarted) / 1400);
    const eased = t * t * (3 - 2 * t);
    this.sectionProgress = THREE.MathUtils.lerp(
      this.transitionFrom, this.sectionEnabled ? 1 : 0, eased,
    );
    this.particles.setSectionProgress(this.sectionProgress);
    this.earth.visible = this.sectionProgress < 0.5;
    this.earthSection.visible = !this.earth.visible;
    this.orientationGuides.setSectionVisible(this.earthSection.visible);
    this.cameraRig.camera.position.lerpVectors(this.cameraStart, this.cameraDestination, eased);
    if (t === 1) {
      this.transitioning = false;
      this.cameraRig.controls.enabled = true;
      this.cameraRig.controls.enableRotate = !this.sectionEnabled;
      this.cameraRig.controls.autoRotate = false;
    }
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.cameraRig.camera.aspect = width / Math.max(1, height);
    this.cameraRig.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    if (this.sectionEnabled) {
      this.cameraRig.camera.position.set(0, 0, this.sectionCameraDistance);
      this.cameraDestination.copy(this.cameraRig.camera.position);
      this.cameraRig.controls.maxDistance = Math.max(
        CONFIG.camera.maxDistance, this.sectionCameraDistance * 1.5,
      );
    }
  };

  private get sectionCameraDistance(): number {
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    // Reserve margin for the full atmospheric cross-section and the brass lever.
    return 1.58 / (Math.tan(THREE.MathUtils.degToRad(CONFIG.camera.fieldOfView / 2))
      * Math.min(1, aspect));
  }

  private showWebGpuError(): void {
    this.renderer.domElement.remove();
    const message = document.createElement('p');
    message.className = 'webgpu-error';
    message.textContent = 'This prototype requires a browser with WebGPU enabled.';
    this.container.append(message);
  }

  private get pixelRatio(): number {
    return Math.min(window.devicePixelRatio, CONFIG.renderer.maxPixelRatio);
  }
}
