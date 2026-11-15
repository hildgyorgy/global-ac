/** Prescribed Azores–Bermuda circulation in geographic coordinates.
 * Horizontal velocities use Earth-radius/display-second units; vertical
 * velocity uses normalized shell altitude/display second.
 */
export const ANTICYCLONE_MODEL = {
  latitude: (32 * Math.PI) / 180,
  longitude: (-45 * Math.PI) / 180,
  coreRadius: (11 * Math.PI) / 180,
  outerRadius: (24 * Math.PI) / 180,
  rotationRate: 0.9,
  radialRate: 0.2,
  descentRate: 0.065,
  upperFadeStart: 0.6,
  upperFadeEnd: 0.94,
  switchTimeSeconds: 0.7,
} as const;

export interface AnticycloneWind {
  eastward: number;
  northward: number;
  altitudeVelocity: number;
}

const smoothstep = (value: number, low: number, high: number): number => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

/** A smooth, compact blend with the ambient wind, not a particle orbit.
 * The tangent-plane approximation is confined to a regional footprint.
 */
export function sampleAnticyclone(
  latitude: number,
  longitude: number,
  altitude: number,
  background: AnticycloneWind,
  strength = 1,
): AnticycloneWind & { influence: number } {
  const m = ANTICYCLONE_MODEL;
  const deltaLongitude = Math.atan2(
    Math.sin(longitude - m.longitude),
    Math.cos(longitude - m.longitude),
  );
  const east = deltaLongitude * Math.cos(m.latitude);
  const north = latitude - m.latitude;
  const distance = Math.hypot(east, north);
  const height = Math.min(1, Math.max(0, altitude));
  const influence =
    (1 - smoothstep(distance, m.coreRadius, m.outerRadius)) *
    (1 - smoothstep(height, m.upperFadeStart, m.upperFadeEnd)) *
    Math.min(1, Math.max(0, strength));
  const rotation = m.rotationRate * (1 - 0.55 * height);
  const radial = m.radialRate * Math.cos(Math.PI * height);
  const core = Math.exp(-0.5 * (distance / m.coreRadius) ** 2);
  const target = {
    eastward: rotation * north + radial * east,
    northward: -rotation * east + radial * north,
    altitudeVelocity: -m.descentRate * core * Math.sin(Math.PI * height),
  };
  return {
    eastward: background.eastward + (target.eastward - background.eastward) * influence,
    northward: background.northward + (target.northward - background.northward) * influence,
    altitudeVelocity:
      background.altitudeVelocity +
      (target.altitudeVelocity - background.altitudeVelocity) * influence,
    influence,
  };
}
