const cellParticleCounts = { hadley: 25_000, ferrel: 16_667, polar: 6_666 } as const;

export const CONFIG = {
  presentation: {
    globeScale: 2,
    // Keep the lower atmospheric edge floating above the existing brass disc.
    globeHeight: 1.2,
  },
  earth: {
    radius: 1,
    axialTiltDegrees: -23.4,
    rotationRadians: -0.32,
    // One full rotation in about 4 minutes 27 seconds.
    spinRadiansPerSecond: (Math.PI * 2 / 60) * 0.225,
  },
  atmosphere: {
    cellParticleCounts,
    particleCount: cellParticleCounts.hadley + cellParticleCounts.ferrel + cellParticleCounts.polar,
    equatorialShellThickness: 0.30,
    polarShellThickness: 0.15,
    particleSize: 0.0045,
    flowSpeed: 1,
  },
  camera: {
    fieldOfView: 40,
    near: 0.05,
    far: 100,
    distance: 10.4,
    height: 3.4,
    targetHeight: 0.6,
    minDistance: 5.6,
    maxDistance: 15,
  },
  renderer: {
    maxPixelRatio: 1.75,
    background: 0x020406,
  },
} as const;
