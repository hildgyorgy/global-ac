import type { Node } from 'three/webgpu';
import { Fn, float, mix, vec2 } from 'three/tsl';
import { JET_STREAMS_MODEL } from './JetStreamsModel';
import { shellThicknessNode, particleRadiusNode } from './GeometryNode';

/** TSL adapter for the renderer-independent prescribed jet model. */
export const jetStreamWeightNode = Fn<[Node<'float'>, Node<'float'>], Node<'float'>>(([latitude, altitude]) => {
  const m = JET_STREAMS_MODEL;
  const latitudeWeight = m.bands.reduce<Node<'float'>>((sum, band) => {
    const d = latitude.abs().sub(band.latitude).div(band.width);
    const height = altitude.sub(band.coreAltitude).div(band.altitudeWidth);
    return sum.add(d.mul(d).add(height.mul(height)).mul(-.5).exp());
  }, float(0));
  return latitudeWeight.mul(altitude.smoothstep(m.lowerAltitude, m.fullAltitude)).clamp(0, 1);
});

export const jetEastwardSpeedNode = Fn<[
  Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>,
], Node<'float'>>(([latitude, altitude, eastward, northward, radial, strength]) => {
  const m = JET_STREAMS_MODEL;
  const weight = jetStreamWeightNode(latitude, altitude).mul(strength.clamp(0, 1));
  const crossFlowSquared = northward.mul(northward).add(radial.mul(radial));
  const reference = eastward.mul(eastward).add(crossFlowSquared).sqrt().max(m.minimumReferenceSpeed);
  const speed = reference.mul(m.coreSpeedMultiplier);
  const target = speed.mul(speed).sub(crossFlowSquared).max(0).sqrt();
  return mix(eastward, target, weight);
});

/** A compact, physically round meridional seed disk. Slot 0/1 = N/S
 * subtropical, 2/3 = N/S polar-front; only the initial sampling is biased.
 */
export const jetTracerSeedNode = Fn<[
  Node<'float'>, Node<'float'>, Node<'float'>,
], Node<'vec2'>>(([slot, angle, diskRadius]) => {
  const [subtropical, polar] = JET_STREAMS_MODEL.bands;
  const polarWeight = slot.greaterThanEqual(2).toFloat();
  const hemisphere = float(1).sub(slot.mod(2).mul(2));
  const latitude = mix(subtropical.latitude, polar.latitude, polarWeight).mul(hemisphere);
  const altitude = mix(subtropical.coreAltitude, polar.coreAltitude, polarWeight);
  const thickness = shellThicknessNode(latitude);
  const radius = particleRadiusNode(latitude, altitude);
  const offset = diskRadius.mul(JET_STREAMS_MODEL.tracerCrossSectionRadius);
  return vec2(latitude.add(angle.cos().mul(offset).div(radius)),
    altitude.add(angle.sin().mul(offset).div(thickness)));
});
