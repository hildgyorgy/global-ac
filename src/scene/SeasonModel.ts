import { CONFIG } from '../config.ts';

export const SEASON_MODEL = {
  trackRadius: 1.18,
  responseSeconds: 0.16,
  lampPosition: [-3.25, 1.75, 0.9] as const,
} as const;

/** Yaw the tilted instrument relative to a fixed, horizontal solar key.
 * December points the north pole away; June points it toward the light.
 */
export function seasonYaw(progress: number): number {
  const alignment = Math.atan2(SEASON_MODEL.lampPosition[2], -SEASON_MODEL.lampPosition[0]);
  return alignment + Math.min(1, Math.max(0, progress)) * Math.PI;
}

export function seasonHandlePosition(progress: number): [number, number] {
  const angle = Math.PI * (1 - Math.min(1, Math.max(0, progress)));
  return [Math.cos(angle) * SEASON_MODEL.trackRadius, Math.sin(angle) * SEASON_MODEL.trackRadius];
}

export function seasonProgressFromPoint(x: number, z: number): number {
  if (Math.hypot(x, z) < 1e-6) return 0.5;
  return 1 - Math.atan2(Math.max(0, z), x) / Math.PI;
}

/** The parallel key is a solar proxy; the lamp's local pool stays at its bulb. */
export function solarKeyPosition(): [number, number, number] {
  return [
    SEASON_MODEL.lampPosition[0],
    CONFIG.presentation.globeHeight,
    SEASON_MODEL.lampPosition[2],
  ];
}
