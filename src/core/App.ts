import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { GpuParticleSystem } from '../atmosphere/GpuParticleSystem';
import {
  createCameraRig,
  defaultCameraFrame,
  frameAroundDesk,
  type CameraRig,
} from '../camera/createCameraRig';
import { CONFIG } from '../config';
import { Earth } from '../earth/Earth';
import { EarthSection } from '../earth/EarthSection';
import { OrientationGuides } from '../earth/OrientationGuides';
import { SectionSwitch } from '../ui/SectionSwitch';
import { LibraryStudy } from '../scene/LibraryStudy';
import { DeskControls } from '../ui/DeskControls';
import { CellSelection } from '../camera/CellSelection';
import { SeasonDial } from '../ui/SeasonDial';
import { seasonYaw, solarKeyPosition } from '../scene/SeasonModel';

export class App {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGPURenderer;
  private readonly cameraRig: CameraRig;
  private readonly earth = new Earth();
  private readonly particles = new GpuParticleSystem();
  private readonly globe = new THREE.Group();
  private readonly rotatingGlobe = new THREE.Group();
  private readonly study = new LibraryStudy();
  private readonly roomLights: { light: THREE.Light; intensity: number }[] = [];
  private readonly deskControls: DeskControls;
  private readonly seasonDial: SeasonDial;
  private seasonProgress = 0;
  private spinAngle = 0;
  private previousFrameTime = 0;
  private readonly earthSection = new EarthSection();
  private readonly orientationGuides = new OrientationGuides();
  private readonly sectionSwitch: SectionSwitch;
  private readonly coriolisSwitch: SectionSwitch;
  private readonly jetsSwitch: SectionSwitch;
  private readonly anticycloneSwitch: SectionSwitch;
  private readonly instrumentControls = document.createElement('div');
  private readonly resetButton = document.createElement('button');
  private readonly cellSelection: CellSelection;
  private selectedCell = -1;
  private sectionEnabled = false;
  private sectionProgress = 0;
  private transitionStarted = 0;
  private transitionFrom = 0;
  private diagramOpacity = 0;
  private diagramFrom = 0;
  private morphDuration = 1400;
  private diagramDuration = 650;
  private transitioning = false;
  private readonly savedCameraPosition = new THREE.Vector3();
  private readonly cameraStart = new THREE.Vector3();
  private readonly cameraDestination = new THREE.Vector3();
  private readonly targetStart = new THREE.Vector3();
  private readonly targetDestination = new THREE.Vector3();
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.append(this.renderer.domElement);

    this.cameraRig = createCameraRig(this.renderer.domElement);
    this.sectionSwitch = new SectionSwitch(this.setSectionEnabled);
    this.coriolisSwitch = new SectionSwitch(
      (enabled) => this.particles.setCoriolisEnabled(enabled),
      { label: 'Coriolis' },
    );
    this.jetsSwitch = new SectionSwitch(
      (enabled) => {
        this.particles.setJetsEnabled(enabled);
        this.earthSection.setJetsEnabled(enabled);
      },
      { label: 'Jet-streams' },
    );
    this.anticycloneSwitch = new SectionSwitch(
      (enabled) => this.particles.setAnticycloneEnabled(enabled),
      { label: 'Highs' },
    );
    this.anticycloneSwitch.element.setAttribute('aria-label', 'Subtropical highs');
    this.instrumentControls.className = 'instrument-controls';
    this.resetButton.type = 'button';
    this.resetButton.className = 'section-switch reset-button';
    this.resetButton.setAttribute('aria-label', 'Reset view');
    this.resetButton.textContent = 'Reset';
    this.resetButton.addEventListener('click', this.resetView);
    this.instrumentControls.append(
      this.sectionSwitch.element,
      this.coriolisSwitch.element,
      this.jetsSwitch.element,
      this.anticycloneSwitch.element,
      this.resetButton,
    );
    this.configureScene();
    this.seasonDial = new SeasonDial({
      anchor: this.study.seasonAnchor,
      canvas: this.renderer.domElement,
      camera: this.cameraRig.camera,
      navigation: this.cameraRig.controls,
      occluder: this.globe,
      canInteract: () => this.running && !this.sectionEnabled && !this.transitioning,
      onChange: (progress) => {
        this.seasonProgress = progress;
      },
    });
    this.instrumentControls.append(this.seasonDial.element);
    this.deskControls = new DeskControls(
      container,
      this.instrumentControls,
      this.study.controlAnchor,
      this.renderer.domElement,
      this.cameraRig.camera,
    );
    this.cellSelection = new CellSelection(
      this.renderer.domElement,
      this.cameraRig.camera,
      this.globe,
      () => this.sectionEnabled,
      () => this.running && !this.transitioning,
      (cell) => {
        this.selectedCell = cell === this.selectedCell ? -1 : cell;
        this.particles.setSelectedCell(this.selectedCell);
      },
    );
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
    await this.renderer.setAnimationLoop(this.animate);
  }

  dispose(): void {
    this.running = false;
    if (this.renderer.hasInitialized()) void this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);
    this.cameraRig.controls.dispose();
    this.cellSelection.dispose();
    this.sectionSwitch.dispose();
    this.coriolisSwitch.dispose();
    this.jetsSwitch.dispose();
    this.anticycloneSwitch.dispose();
    this.resetButton.removeEventListener('click', this.resetView);
    this.instrumentControls.remove();
    this.deskControls.dispose();
    this.seasonDial.dispose();
    this.study.dispose();
    this.earth.dispose();
    this.earthSection.dispose();
    this.particles.dispose();
    this.scene.traverse((object) => {
      if (object === this.particles || object === this.particles.trails) return;
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
    this.scene.add(this.study);
    this.scene.background = new THREE.Color(0x030706);
    this.scene.fog = new THREE.FogExp2(0x030706, 0.045);

    // Faint library-room fill: preserve readable land on the night side.
    const ambient = new THREE.AmbientLight(0xaba18b, 0.22);
    const sun = new THREE.DirectionalLight(0xffd6a1, 2.8);
    // Fixed solar proxy is horizontal at globe height; the local lamp pool
    // remains at the actual bulb, providing artistic room illumination.
    sun.position.set(...solarKeyPosition());
    sun.target.position.y = CONFIG.presentation.globeHeight;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 18;
    sun.shadow.normalBias = 0.025;
    sun.shadow.intensity = 0.7;
    sun.shadow.radius = 3;
    const lampPool = new THREE.PointLight(0xffc47c, 14, 12, 2);
    lampPool.position.copy(this.study.lampPosition);
    this.scene.add(ambient, sun, sun.target, lampPool);
    for (const light of [ambient, sun, lampPool]) {
      this.roomLights.push({ light, intensity: light.intensity });
    }

    this.globe.scale.setScalar(CONFIG.presentation.globeScale);
    this.globe.position.y = CONFIG.presentation.globeHeight;
    this.globe.rotation.z = (CONFIG.earth.axialTiltDegrees * Math.PI) / 180;
    this.globe.rotation.y = seasonYaw(0);
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
    this.orientationGuides.setSpinAngle(this.spinAngle);
    this.particles.setSpinAngle(this.spinAngle);
    this.particles.compute(this.renderer);
    this.updateSectionTransition();
    this.updateSeason();
    // The scripted transition owns the camera until both phases finish.
    // OrbitControls would otherwise clamp the front-facing camera as soon
    // as the reverse toggle restores the globe's polar-angle limit.
    if (!this.transitioning) this.cameraRig.controls.update();
    this.deskControls.render();
    this.renderer.render(this.scene, this.cameraRig.camera);
  };

  private updateSeason(): void {
    const yaw = seasonYaw(this.seasonProgress);
    const shortYaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    // The abstract meridional chart keeps its canonical readable orientation.
    // Reclosing restores the chosen three-dimensional instrument setting.
    this.globe.rotation.y = shortYaw * (1 - THREE.MathUtils.smoothstep(this.sectionProgress, 0, 1));
    this.seasonDial.setEnabled(!this.sectionEnabled && !this.transitioning);
  }

  private setSectionEnabled = (enabled: boolean): void => {
    const { camera, controls } = this.cameraRig;
    if (enabled && !this.sectionEnabled) this.savedCameraPosition.copy(camera.position);
    this.sectionEnabled = enabled;
    this.transitionFrom = this.sectionProgress;
    this.diagramFrom = this.diagramOpacity;
    this.transitionStarted = performance.now();
    this.cameraStart.copy(camera.position);
    this.targetStart.copy(controls.target);
    const destination = enabled ? this.sectionCameraFrame : defaultCameraFrame(camera.aspect);
    this.targetDestination.copy(destination.target);
    this.cameraDestination.copy(enabled ? destination.position : this.savedCameraPosition);
    this.morphDuration =
      Math.abs(this.transitionFrom - (enabled ? 1 : 0)) > 0.0001 ||
      this.cameraStart.distanceTo(this.cameraDestination) > 0.0001 ||
      this.targetStart.distanceTo(this.targetDestination) > 0.0001
        ? 1400
        : 0;
    this.diagramDuration = Math.abs(this.diagramFrom - (enabled ? 1 : 0)) > 0.0001 ? 650 : 0;
    controls.autoRotate = false;
    controls.maxPolarAngle = enabled ? Math.PI / 2 : 1.45;
    controls.maxDistance = enabled
      ? Math.max(CONFIG.camera.maxDistance, this.sectionCameraDistance * 1.5)
      : Math.max(CONFIG.camera.maxDistance, this.cameraDestination.length() * 1.5);
    controls.enabled = false;
    this.transitioning = true;
  };

  private resetView = (): void => {
    this.selectedCell = -1;
    this.particles.setSelectedCell(-1);
    // Restore the initial globe view; preserve the atmospheric/Coriolis state.
    this.savedCameraPosition.copy(defaultCameraFrame(this.cameraRig.camera.aspect).position);
    this.sectionSwitch.setEnabled(false);
  };

  private updateSectionTransition(): void {
    if (!this.transitioning) return;
    const elapsed = performance.now() - this.transitionStarted;
    const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
    const phase = (delay: number, duration: number) =>
      duration === 0 ? 1 : THREE.MathUtils.clamp((elapsed - delay) / duration, 0, 1);
    // Open first, then reveal the chart. Reverse that order on the way back.
    // Capture current values on each toggle so interrupted transitions don't jump.
    const eased = smooth(phase(this.sectionEnabled ? 0 : this.diagramDuration, this.morphDuration));
    const diagramEased = smooth(
      phase(this.sectionEnabled ? this.morphDuration : 0, this.diagramDuration),
    );
    this.sectionProgress = THREE.MathUtils.lerp(
      this.transitionFrom,
      this.sectionEnabled ? 1 : 0,
      eased,
    );
    this.particles.setSectionProgress(this.sectionProgress);
    const illumination = 1 - this.sectionProgress;
    for (const { light, intensity } of this.roomLights) light.intensity = intensity * illumination;
    this.study.setIllumination(illumination);
    this.deskControls.setRoomIllumination(illumination);
    this.earth.setSectionProgress(this.sectionProgress);
    this.earthSection.setOpeningProgress(this.sectionProgress);
    this.diagramOpacity = THREE.MathUtils.lerp(
      this.diagramFrom,
      this.sectionEnabled ? 1 : 0,
      diagramEased,
    );
    this.earthSection.setDiagramOpacity(this.diagramOpacity);
    this.orientationGuides.setDiagramOpacity(this.diagramOpacity);
    this.orientationGuides.setGlobeOpacity(1 - smooth(Math.min(1, this.sectionProgress * 2)));
    this.earth.visible = this.sectionProgress < 0.5;
    this.earthSection.visible = !this.earth.visible;
    this.orientationGuides.setSectionVisible(this.earthSection.visible);
    this.cameraRig.camera.position.lerpVectors(this.cameraStart, this.cameraDestination, eased);
    this.cameraRig.controls.target.lerpVectors(this.targetStart, this.targetDestination, eased);
    // OrbitControls is suspended during the scripted move, so update the
    // camera orientation here too rather than snapping it at the last frame.
    this.cameraRig.camera.lookAt(this.cameraRig.controls.target);
    if (elapsed >= this.morphDuration + this.diagramDuration) {
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
      const frame = this.sectionCameraFrame;
      if (!this.transitioning) {
        this.cameraRig.camera.position.copy(frame.position);
        this.cameraRig.controls.target.copy(frame.target);
      }
      this.cameraDestination.copy(frame.position);
      this.targetDestination.copy(frame.target);
      this.cameraRig.controls.maxDistance = Math.max(
        CONFIG.camera.maxDistance,
        this.sectionCameraDistance * 1.5,
      );
    }
  };

  private get sectionCameraFrame() {
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    // Wide views can use the empty upper margin; narrow views must also keep
    // the left-hand desk inscription inside the frame.
    const magnification = 1.04 + 0.11 * THREE.MathUtils.clamp((aspect - 1.2) / 0.5, 0, 1);
    return frameAroundDesk(
      new THREE.Vector3(0, CONFIG.presentation.globeHeight, this.sectionCameraDistance),
      new THREE.Vector3(0, CONFIG.presentation.globeHeight, 0),
      magnification,
    );
  }

  private get sectionCameraDistance(): number {
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    const halfFov = Math.tan(THREE.MathUtils.degToRad(CONFIG.camera.fieldOfView / 2));
    // Keep the near desk instruments in frame in a front-facing projection.
    return Math.max(
      11.8,
      (1.85 * CONFIG.presentation.globeScale) / (halfFov * Math.min(1, aspect)),
      5.1 / (halfFov * Math.max(0.35, aspect)) + 2.35,
    );
  }

  showInitializationError(error: unknown): void {
    this.running = false;
    if (this.renderer.hasInitialized()) void this.renderer.setAnimationLoop(null);
    console.error('Atmospheric globe initialization failed:', error);
    this.showWebGpuError(
      'The globe could not start its WebGPU renderer. Please reload the page or try another WebGPU-capable browser.',
    );
  }

  private showWebGpuError(text = 'This prototype requires a browser with WebGPU enabled.'): void {
    this.renderer.domElement.remove();
    const message = document.createElement('p');
    message.className = 'webgpu-error';
    message.setAttribute('role', 'alert');
    message.textContent = text;
    this.container.append(message);
  }

  private get pixelRatio(): number {
    return Math.min(window.devicePixelRatio, CONFIG.renderer.maxPixelRatio);
  }
}
