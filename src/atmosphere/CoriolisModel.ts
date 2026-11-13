/** Reduced zonal Coriolis response to the prescribed meridional circulation.
 * u is eastward and v northward in Earth-radius units / display second.
 * f = 2 Ω sin(latitude). Ω is deliberately accelerated for this visual model.
 * The prescribed v represents externally maintained circulation: this is not
 * a free parcel solver for both horizontal momentum equations.
 */
export const CORIOLIS_MODEL = {
  displayAngularVelocity: 0.38,
  drag: 0.16,
  switchOffDrag: 1.4,
  minimumCosLatitude: 0.12,
  maxLongitudeRate: 0.22,
} as const;

export function zonalCoriolisAcceleration(latitude: number, northwardSpeed: number): number {
  return 2 * CORIOLIS_MODEL.displayAngularVelocity * Math.sin(latitude) * northwardSpeed;
}
