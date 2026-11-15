import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import {
  SEASON_MODEL,
  seasonYaw,
  seasonHandlePosition,
  seasonProgressFromPoint,
  solarKeyPosition,
} from '../src/scene/SeasonModel.ts';

test('the fixed solar key gives December, equinox and June without changing obliquity', () => {
  const tilt = (CONFIG.earth.axialTiltDegrees * Math.PI) / 180;
  const light = solarKeyPosition();
  light[1] -= CONFIG.presentation.globeHeight;
  const length = Math.hypot(...light);
  for (const [progress, expectedDeclination] of [
    [0, -Math.abs(tilt)],
    [0.5, 0],
    [1, Math.abs(tilt)],
  ]) {
    const yaw = seasonYaw(progress);
    // Euler XYZ with zero X: Ry(yaw) Rz(tilt) applied to the north axis.
    const north = [-Math.sin(tilt) * Math.cos(yaw), Math.cos(tilt), Math.sin(tilt) * Math.sin(yaw)];
    assert.ok(Math.abs(Math.acos(north[1]) - Math.abs(tilt)) < 1e-12);
    const dot = north.reduce((sum, value, i) => sum + (value * light[i]) / length, 0);
    assert.ok(Math.abs(Math.asin(dot) - expectedDeclination) < 1e-12);
  }
  assert.ok(Math.abs(seasonYaw(1) - seasonYaw(0) - Math.PI) < 1e-12);
});

test('the fader follows a front semicircle and maps ray hits back to its value', () => {
  for (let i = 0; i <= 100; i++) {
    const progress = i / 100;
    const [x, z] = seasonHandlePosition(progress);
    assert.ok(z >= 0);
    assert.ok(Math.abs(Math.hypot(x, z) - SEASON_MODEL.trackRadius) < 1e-12);
    assert.ok(Math.abs(seasonProgressFromPoint(x, z) - progress) < 1e-12);
  }
  assert.ok(seasonHandlePosition(0)[0] < 0);
  assert.ok(seasonHandlePosition(1)[0] > 0);
  assert.equal(seasonProgressFromPoint(0, 0), 0.5);
  assert.equal(seasonProgressFromPoint(-2, -1), 0);
  assert.equal(seasonProgressFromPoint(2, -1), 1);
});
