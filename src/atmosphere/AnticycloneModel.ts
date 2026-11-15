/** Prescribed oceanic subtropical highs in geographic coordinates.
 * Horizontal velocities use Earth-radius/display-second units; vertical
 * velocity uses normalized shell altitude/display second.
 */
export const ANTICYCLONE_MODEL = {
  centres: [
    {
      name: 'Azores–Bermuda High',
      latitude: (32 * Math.PI) / 180,
      longitude: (-45 * Math.PI) / 180,
    },
    {
      name: 'North Pacific High',
      latitude: (32 * Math.PI) / 180,
      longitude: (-145 * Math.PI) / 180,
    },
    {
      name: 'South Atlantic High',
      latitude: (-30 * Math.PI) / 180,
      longitude: (-15 * Math.PI) / 180,
    },
    {
      name: 'South Pacific High',
      latitude: (-30 * Math.PI) / 180,
      longitude: (-100 * Math.PI) / 180,
    },
    { name: 'Mascarene High', latitude: (-30 * Math.PI) / 180, longitude: (70 * Math.PI) / 180 },
  ],
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
  const height = Math.min(1, Math.max(0, altitude));
  const heightWeight =
    (1 - smoothstep(height, m.upperFadeStart, m.upperFadeEnd)) * Math.min(1, Math.max(0, strength));
  const radial = m.radialRate * Math.cos(Math.PI * height);
  const weighted = { eastward: 0, northward: 0, altitudeVelocity: 0 };
  let totalWeight = 0;
  for (const centre of m.centres) {
    const deltaLongitude = Math.atan2(
      Math.sin(longitude - centre.longitude),
      Math.cos(longitude - centre.longitude),
    );
    const east = deltaLongitude * Math.cos(centre.latitude);
    const north = latitude - centre.latitude;
    const distance = Math.hypot(east, north);
    const weight = (1 - smoothstep(distance, m.coreRadius, m.outerRadius)) * heightWeight;
    const rotation = m.rotationRate * (1 - 0.55 * height) * Math.sign(centre.latitude);
    const core = Math.exp(-0.5 * (distance / m.coreRadius) ** 2);
    weighted.eastward += (rotation * north + radial * east) * weight;
    weighted.northward += (-rotation * east + radial * north) * weight;
    weighted.altitudeVelocity += -m.descentRate * core * Math.sin(Math.PI * height) * weight;
    totalWeight += weight;
  }
  // A normalized blend stays bounded even if future regional footprints overlap.
  const influence = Math.min(1, totalWeight);
  const divisor = Math.max(1, totalWeight);
  return {
    eastward: background.eastward * (1 - influence) + weighted.eastward / divisor,
    northward: background.northward * (1 - influence) + weighted.northward / divisor,
    altitudeVelocity:
      background.altitudeVelocity * (1 - influence) + weighted.altitudeVelocity / divisor,
    influence,
  };
}
