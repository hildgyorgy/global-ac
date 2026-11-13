import type { Node } from 'three/webgpu';
import { Fn } from 'three/tsl';
import { CORIOLIS_MODEL } from './CoriolisModel';

export const coriolisVisualScaleNode = Fn<[Node<'float'>], Node<'float'>>(([latitude]) =>
  latitude.abs().smoothstep(CORIOLIS_MODEL.polarTaperStart, CORIOLIS_MODEL.polarTaperEnd)
    .mul(CORIOLIS_MODEL.polarVisualScale - 1).add(1));

/** TSL adapter: du/dt = f v. Positive u is geographically eastward. */
export const zonalCoriolisAccelerationNode = Fn<
  [Node<'float'>, Node<'float'>], Node<'float'>
>(([latitude, northwardSpeed]) => latitude.sin()
  .mul(2 * CORIOLIS_MODEL.displayAngularVelocity).mul(northwardSpeed)
  .mul(coriolisVisualScaleNode(latitude)));
