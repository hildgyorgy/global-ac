/** Renderer-independent prescribed jets in exaggerated display-time units.
 * An idealized wind field, not a numerical weather solver.
 */
export const JET_STREAMS_MODEL = {
  bands: [
    { latitude: Math.PI / 6, width: 3.5 * Math.PI / 180 },
    { latitude: 55 * Math.PI / 180, width: 4.5 * Math.PI / 180 },
  ],
  coreAltitude: .84,
  altitudeWidth: .10,
  lowerAltitude: .55,
  fullAltitude: .70,
  coreSpeedMultiplier: 2,
  // Earth-radius units/display second: prevents dead jets at cell stagnation.
  minimumReferenceSpeed: .06,
  switchTimeSeconds: .55,
} as const;

export interface LocalWind { eastward: number; northward: number; radial: number; }

export function jetStreamWeight(latitude: number, altitude: number): number {
  const m = JET_STREAMS_MODEL;
  const t = Math.min(1, Math.max(0, (altitude - m.lowerAltitude) / (m.fullAltitude - m.lowerAltitude)));
  const latitudeWeight = m.bands.reduce((sum, band) => {
    const d = (Math.abs(latitude) - band.latitude) / band.width;
    return sum + Math.exp(-.5 * d * d);
  }, 0);
  const height = (altitude - m.coreAltitude) / m.altitudeWidth;
  return Math.min(1, latitudeWeight * Math.exp(-.5 * height * height) * t * t * (3 - 2 * t));
}

/** Total eastward wind; northward/radial motion is retained. The same tracers
 * enter and leave smoothly without a separate jet identity.
 */
export function sampleJetEastwardSpeed(latitude: number, altitude: number, wind: LocalWind, strength = 1): number {
  const weight = jetStreamWeight(latitude, altitude) * Math.min(1, Math.max(0, strength));
  const background = Math.hypot(wind.eastward, wind.northward, wind.radial);
  const speed = JET_STREAMS_MODEL.coreSpeedMultiplier * Math.max(background, JET_STREAMS_MODEL.minimumReferenceSpeed);
  const target = Math.sqrt(Math.max(0, speed ** 2 - wind.northward ** 2 - wind.radial ** 2));
  return wind.eastward + (target - wind.eastward) * weight;
}
