/**
 * Renderer-independent definition of the idealized Hadley circulation model.
 * GPU and future CPU/test adapters consume the same parameters and equations.
 */
export const HADLEY_MODEL = {
  cellEdgeRadians: Math.PI / 6,
  meridionalSpeed: 0.075,
  verticalSpeed: 0.145,
  equatorialSurfaceKelvin: 304,
  altitudeCoolingKelvin: 43,
  latitudeCoolingKelvin: 17,
  minimumKelvin: 216,
  temperatureRangeKelvin: 88,
} as const;

export interface HadleySample {
  latitudeVelocity: number;
  longitudeVelocity: number;
  altitudeVelocity: number;
  temperatureKelvin: number;
}

/** Reference implementation for tests, documentation, and non-GPU consumers. */
export function sampleHadleyModel(
  latitude: number,
  normalizedAltitude: number,
): HadleySample {
  const altitude = Math.min(1, Math.max(0, normalizedAltitude));
  const hemisphere = latitude < 0 ? -1 : 1;
  const absoluteLatitude = Math.min(Math.PI / 2 - 1e-6, Math.abs(latitude));
  const cellIndex = Math.floor(absoluteLatitude / HADLEY_MODEL.cellEdgeRadians);
  const cellPosition = absoluteLatitude / HADLEY_MODEL.cellEdgeRadians - cellIndex;
  const direction = cellIndex === 1 ? -1 : 1;

  return {
    latitudeVelocity:
      -hemisphere * direction *
      HADLEY_MODEL.meridionalSpeed *
      Math.sin(Math.PI * cellPosition) *
      Math.cos(Math.PI * altitude),
    longitudeVelocity: 0,
    altitudeVelocity:
      direction * HADLEY_MODEL.verticalSpeed *
      Math.cos(Math.PI * cellPosition) *
      Math.sin(Math.PI * altitude),
    temperatureKelvin:
      HADLEY_MODEL.equatorialSurfaceKelvin -
      HADLEY_MODEL.altitudeCoolingKelvin * altitude -
      HADLEY_MODEL.latitudeCoolingKelvin * (absoluteLatitude / HADLEY_MODEL.cellEdgeRadians),
  };
}
