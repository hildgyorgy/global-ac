/** Reduced zonal Coriolis response to the prescribed meridional circulation.
 * u is eastward and v northward in Earth-radius units / display second.
 * f = 2 Ω sin(latitude). Ω is deliberately accelerated for this visual model.
 * The prescribed v represents externally maintained circulation: this is not
 * a free parcel solver for both horizontal momentum equations.
 */
export const CORIOLIS_MODEL = {
  // Visual time scaling: doubled from 0.57 for stronger lateral drift.
  displayAngularVelocity: 1.14,
  drag: 0.16,
  switchOffDrag: 1.4,
  minimumCosLatitude: 0.12,
  maxLongitudeRate: 0.44,
  polarTaperStart: Math.PI / 3,
  polarTaperEnd: Math.PI / 2,
  polarVisualScale: 0.5,
} as const;

/** Visual correction only; the physical sin(latitude) factor stays intact. */
export function coriolisVisualScale(latitude: number): number {
  const t = Math.min(1, Math.max(0,
    (Math.abs(latitude) - CORIOLIS_MODEL.polarTaperStart) /
    (CORIOLIS_MODEL.polarTaperEnd - CORIOLIS_MODEL.polarTaperStart),
  ));
  return 1 - (1 - CORIOLIS_MODEL.polarVisualScale) * t * t * (3 - 2 * t);
}

export function zonalCoriolisAcceleration(latitude: number, northwardSpeed: number): number {
  return 2 * CORIOLIS_MODEL.displayAngularVelocity * Math.sin(latitude) * northwardSpeed
    * coriolisVisualScale(latitude);
}
