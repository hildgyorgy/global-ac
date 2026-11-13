import type { Node } from 'three/webgpu';
import { Fn, float, vec4 } from 'three/tsl';
import { HADLEY_MODEL } from './HadleyModel';

/** TSL compute adapter for the renderer-independent Hadley model. */
export const sampleHadleyField = Fn<
  [Node<'float'>, Node<'float'>],
  Node<'vec4'>
>(([latitude, normalizedAltitude]) => {
  const cellEdge = float(HADLEY_MODEL.cellEdgeRadians);
  const hemisphere = latitude.sign();
  const latitudeInCells = latitude.abs().div(cellEdge).min(2.99999);
  const cellIndex = latitudeInCells.floor();
  const cellPosition = latitudeInCells.sub(cellIndex);
  const direction = cellIndex.mul(Math.PI).cos();
  const altitude = normalizedAltitude.clamp(0, 1);

  const latitudeVelocity = hemisphere
    .negate()
    .mul(direction)
    .mul(HADLEY_MODEL.meridionalSpeed)
    .mul(cellPosition.mul(Math.PI).sin())
    .mul(altitude.mul(Math.PI).cos());
  const altitudeVelocity = cellPosition
    .mul(Math.PI)
    .cos()
    .mul(altitude.mul(Math.PI).sin())
    .mul(HADLEY_MODEL.verticalSpeed);
  const signedAltitudeVelocity = altitudeVelocity.mul(direction);
  const longitudeVelocity = float(0);

  const kelvin = float(HADLEY_MODEL.equatorialSurfaceKelvin)
    .sub(altitude.mul(HADLEY_MODEL.altitudeCoolingKelvin))
    .sub(latitudeInCells.mul(HADLEY_MODEL.latitudeCoolingKelvin));
  const temperature = kelvin
    .sub(HADLEY_MODEL.minimumKelvin)
    .div(HADLEY_MODEL.temperatureRangeKelvin)
    .clamp(0, 1);

  return vec4(latitudeVelocity, longitudeVelocity, signedAltitudeVelocity, temperature);
});
