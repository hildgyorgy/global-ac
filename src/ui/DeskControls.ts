import * as THREE from 'three/webgpu';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

/** DOM buttons projected onto a real desk panel. CSS keeps native focus,
 * touch and screen-reader semantics; WebGPU draws the surrounding brass. */
export class DeskControls {
  private readonly renderer = new CSS3DRenderer();
  private readonly scene = new THREE.Scene();
  private readonly object: CSS3DObject;

  constructor(container: HTMLElement, element: HTMLElement, anchor: THREE.Group) {
    this.renderer.domElement.className = 'desk-controls-layer';
    container.append(this.renderer.domElement);
    this.object = new CSS3DObject(element);
    this.object.position.copy(anchor.position);
    this.object.rotation.copy(anchor.rotation);
    // CSS elements are measured in pixels; map them into scene units.
    this.object.scale.setScalar(0.0058);
    this.object.translateZ(0.058);
    this.scene.add(this.object);
    this.resize(container.clientWidth, container.clientHeight);
  }

  render(camera: THREE.PerspectiveCamera): void {
    this.renderer.render(this.scene, camera);
  }

  resize(width: number, height: number): void { this.renderer.setSize(width, height); }

  dispose(): void {
    this.object.removeFromParent();
    this.renderer.domElement.remove();
  }
}
