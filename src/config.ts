const cellParticleCounts = { hadley: 25_000, ferrel: 16_667, polar: 6_666 } as const;

export const CONFIG = {
  earth: {
    radius: 1,
    axialTiltDegrees: -23.4,
    rotationRadians: -0.32,
    // Same angular pace as the former OrbitControls autoRotateSpeed = 0.18.
    spinRadiansPerSecond: (Math.PI * 2 / 60) * 0.18,
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
    distance: 3.35 / 0.95,
    minDistance: 2.35,
    maxDistance: 5.8,
  },
  renderer: {
    maxPixelRatio: 1.75,
    background: 0x020406,
  },
} as const;
