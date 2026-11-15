import type { Node } from 'three/webgpu';
import { Fn } from 'three/tsl';
import { CORIOLIS_MODEL } from './CoriolisModel';

/** TSL adapter: du/dt = f v. Positive u is geographically eastward. */
export const zonalCoriolisAccelerationNode = Fn<
  [Node<'float'>, Node<'float'>], Node<'float'>
>(([latitude, northwardSpeed]) => latitude.sin()
  .mul(2 * CORIOLIS_MODEL.displayAngularVelocity).mul(northwardSpeed));
