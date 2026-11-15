import type { Node } from 'three/webgpu';
import { Fn, atan, float, vec3, vec4 } from 'three/tsl';
import { ANTICYCLONE_MODEL } from './AnticycloneModel';

/** Geographic east-positive longitude; background/output x=east, y=north,
 * z=normalized altitude velocity, output w=local influence.
 */
export const sampleAnticycloneNode = Fn<
  [Node<'float'>, Node<'float'>, Node<'float'>, Node<'vec3'>, Node<'float'>],
  Node<'vec4'>
>(([latitude, longitude, altitude, background, strength]) => {
  const m = ANTICYCLONE_MODEL;
  const height = altitude.clamp(0, 1);
  const heightWeight = float(1)
    .sub(height.smoothstep(m.upperFadeStart, m.upperFadeEnd))
    .mul(strength.clamp(0, 1));
  const radial = height.mul(Math.PI).cos().mul(m.radialRate);
  const weighted = vec3(0).toVar();
  const totalWeight = float(0).toVar();
  for (const centre of m.centres) {
    const delta = longitude.sub(centre.longitude);
    const wrapped = atan(delta.sin(), delta.cos());
    const east = wrapped.mul(Math.cos(centre.latitude));
    const north = latitude.sub(centre.latitude);
    const distance = east.mul(east).add(north.mul(north)).sqrt();
    const weight = float(1).sub(distance.smoothstep(m.coreRadius, m.outerRadius)).mul(heightWeight);
    const rotation = float(1)
      .sub(height.mul(0.55))
      .mul(m.rotationRate * Math.sign(centre.latitude));
    const core = distance.div(m.coreRadius).pow(2).mul(-0.5).exp();
    const target = vec3(
      rotation.mul(north).add(radial.mul(east)),
      rotation.mul(east).negate().add(radial.mul(north)),
      core.mul(height.mul(Math.PI).sin()).mul(-m.descentRate),
    );
    weighted.addAssign(target.mul(weight));
    totalWeight.addAssign(weight);
  }
  const influence = totalWeight.min(1);
  return vec4(
    background.mul(float(1).sub(influence)).add(weighted.div(totalWeight.max(1))),
    influence,
  );
});
