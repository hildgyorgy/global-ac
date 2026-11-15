import type { Node } from 'three/webgpu';
import { Fn, float, mix } from 'three/tsl';
import { JET_STREAMS_MODEL } from './JetStreamsModel';

/** TSL adapter for the renderer-independent prescribed jet model. */
export const jetEastwardSpeedNode = Fn<[
  Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>,
], Node<'float'>>(([latitude, altitude, eastward, northward, radial, strength]) => {
  const m = JET_STREAMS_MODEL;
  const latitudeWeight = m.bands.reduce<Node<'float'>>((sum, band) => {
    const d = latitude.abs().sub(band.latitude).div(band.width);
    return sum.add(d.mul(d).mul(-.5).exp());
  }, float(0));
  const height = altitude.sub(m.coreAltitude).div(m.altitudeWidth);
  const weight = latitudeWeight.mul(height.mul(height).mul(-.5).exp())
    .mul(altitude.smoothstep(m.lowerAltitude, m.fullAltitude)).clamp(0, 1)
    .mul(strength.clamp(0, 1));
  const crossFlowSquared = northward.mul(northward).add(radial.mul(radial));
  const reference = eastward.mul(eastward).add(crossFlowSquared).sqrt().max(m.minimumReferenceSpeed);
  const speed = reference.mul(m.coreSpeedMultiplier);
  const target = speed.mul(speed).sub(crossFlowSquared).max(0).sqrt();
  return mix(eastward, target, weight);
});
