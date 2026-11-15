import type { Node } from 'three/webgpu';
import { float, mix, vec3 } from 'three/tsl';

/** Project a 45-degree meridional wedge onto its middle plane. Preserve
 * latitude and radius (altitude), rather than squashing air into the Earth.
 * Inputs/outputs stay Earth-relative; the parent supplies the globe's spin.
 */
export function meridionalProjectionNode(
  position: Node<'vec3'>, spin: Node<'float'>, progress: Node<'float'>,
) {
  const c = spin.cos(), s = spin.sin();
  const x = position.x.mul(c).add(position.z.mul(s));
  const depth = position.z.mul(c).sub(position.x.mul(s));
  const horizontalRadius = position.x.mul(position.x).add(position.z.mul(position.z)).sqrt();
  const angularDepth = depth.abs().div(horizontalRadius.max(0.00001));
  const wedgeVisibility = float(1).sub(angularDepth.smoothstep(
    Math.sin(20 * Math.PI / 180), Math.sin(22.5 * Math.PI / 180),
  ));
  const projectedX = horizontalRadius.mul(x.sign());
  // Rotate back into the spinning parent frame after flattening.
  const projected = vec3(projectedX.mul(c), position.y, projectedX.mul(s));
  return {
    position: mix(position, projected, progress),
    visibility: mix(float(1), wedgeVisibility, progress),
  };
}
