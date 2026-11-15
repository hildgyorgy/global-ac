import { CONFIG } from '../config.ts';

const anchorHeight = -1.775;
const handleHeight = 0.045;

export const SEASON_MODEL = {
  anchorHeight,
  handleHeight,
  // The extended south axis passes through the grip centre on the desk.
  trackRadius:
    (CONFIG.presentation.globeHeight - anchorHeight - handleHeight) *
    Math.tan((Math.abs(CONFIG.earth.axialTiltDegrees) * Math.PI) / 180),
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
  const angle = Math.PI - seasonYaw(progress);
  return [Math.cos(angle) * SEASON_MODEL.trackRadius, Math.sin(angle) * SEASON_MODEL.trackRadius];
}

export function seasonProgressFromPoint(x: number, z: number): number {
  if (Math.hypot(x, z) < 1e-6) return 0.5;
  const yaw = seasonYaw(0);
  const localX = x * Math.cos(yaw) - z * Math.sin(yaw);
  const localZ = x * Math.sin(yaw) + z * Math.cos(yaw);
  return 1 - Math.atan2(Math.max(0, localZ), localX) / Math.PI;
}

/** The parallel key is a solar proxy; the lamp's local pool stays at its bulb. */
export function solarKeyPosition(): [number, number, number] {
  return [
    SEASON_MODEL.lampPosition[0],
    CONFIG.presentation.globeHeight,
    SEASON_MODEL.lampPosition[2],
  ];
}
