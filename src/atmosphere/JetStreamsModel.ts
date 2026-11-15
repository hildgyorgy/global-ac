/** Renderer-independent prescribed jets in exaggerated display-time units.
 * An idealized wind field, not a numerical weather solver.
 */
export const JET_STREAMS_MODEL = {
  bands: [
    { latitude: Math.PI / 6, width: 3.5 * Math.PI / 180, coreAltitude: .86, altitudeWidth: .095 },
    { latitude: Math.PI / 3, width: 4.5 * Math.PI / 180, coreAltitude: .78, altitudeWidth: .12 },
  ],
  lowerAltitude: .55,
  fullAltitude: .70,
  coreSpeedMultiplier: 2,
  // Earth-radius units/display second: prevents dead jets at cell stagnation.
  minimumReferenceSpeed: .06,
  switchTimeSeconds: .55,
  extraTracerCount: 1500,
  tracerCrossSectionRadius: .024,
  tracerFadeSeconds: .55,
  tracerExitWeight: .40,
} as const;

export interface LocalWind { eastward: number; northward: number; radial: number; }

export function jetStreamWeight(latitude: number, altitude: number): number {
  const m = JET_STREAMS_MODEL;
  const t = Math.min(1, Math.max(0, (altitude - m.lowerAltitude) / (m.fullAltitude - m.lowerAltitude)));
  const latitudeWeight = m.bands.reduce((sum, band) => {
    const d = (Math.abs(latitude) - band.latitude) / band.width;
    const height = (altitude - band.coreAltitude) / band.altitudeWidth;
    return sum + Math.exp(-.5 * (d * d + height * height));
  }, 0);
  return Math.min(1, latitudeWeight * t * t * (3 - 2 * t));
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
