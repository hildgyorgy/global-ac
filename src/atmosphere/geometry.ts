import { CONFIG } from '../config.ts';

/** Display geometry in Earth-radius units; altitude is normalized to the shell. */
export const SURFACE_CLEARANCE = 0.018;
export const SHELL_THICKNESS_DIFFERENCE =
  CONFIG.atmosphere.equatorialShellThickness - CONFIG.atmosphere.polarShellThickness;

export function shellThickness(latitude: number): number {
  return (
    CONFIG.atmosphere.polarShellThickness + SHELL_THICKNESS_DIFFERENCE * Math.cos(latitude) ** 2
  );
}

export function particleRadius(latitude: number, altitude: number): number {
  return CONFIG.earth.radius + SURFACE_CLEARANCE + altitude * shellThickness(latitude);
}

/** dr/dt includes the changing shell thickness as a parcel moves in latitude. */
export function radialVelocity(
  latitude: number,
  altitude: number,
  latitudeVelocity: number,
  altitudeVelocity: number,
): number {
  return (
    altitudeVelocity * shellThickness(latitude) -
    altitude *
      2 *
      SHELL_THICKNESS_DIFFERENCE *
      Math.cos(latitude) *
      Math.sin(latitude) *
      latitudeVelocity
  );
}
