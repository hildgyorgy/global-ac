import test from 'node:test';
import assert from 'node:assert/strict';
import { particleRadius } from '../src/atmosphere/geometry.ts';
import { ANTICYCLONE_MODEL as m, sampleAnticyclone } from '../src/atmosphere/AnticycloneModel.ts';

const background = { eastward: 0.04, northward: -0.03, altitudeVelocity: 0.02 };
const calm = { eastward: 0, northward: 0, altitudeVelocity: 0 };
const point = (east, north) => [m.latitude + north, m.longitude + east / Math.cos(m.latitude)];

test('disabled, distant and uppermost flow reproduce the ambient wind exactly', () => {
  for (const [latitude, longitude, altitude, strength] of [
    [m.latitude, m.longitude, 0.2, 0],
    [m.latitude, m.longitude + Math.PI, 0.2, 1],
    [m.latitude + m.outerRadius + 0.01, m.longitude, 0.2, 1],
    [m.latitude, m.longitude, 1, 1],
  ]) {
    const wind = sampleAnticyclone(latitude, longitude, altitude, background, strength);
    assert.deepEqual(wind, { ...background, influence: 0 });
  }
});

test('surface flow turns clockwise and spirals outward on every side of the northern high', () => {
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    const east = 0.12 * Math.cos(angle),
      north = 0.12 * Math.sin(angle);
    const wind = sampleAnticyclone(...point(east, north), 0.1, calm);
    assert.ok(east * wind.northward - north * wind.eastward < 0, 'clockwise circulation');
    assert.ok(east * wind.eastward + north * wind.northward > 0, 'surface divergence');
  }
});

test('upper flow converges and the core descends without crossing the surface', () => {
  const wind = sampleAnticyclone(...point(0.12, 0.04), 0.75, calm);
  assert.ok(0.12 * wind.eastward + 0.04 * wind.northward < 0);
  for (const altitude of [0.1, 0.4, 0.8]) {
    assert.ok(sampleAnticyclone(m.latitude, m.longitude, altitude, calm).altitudeVelocity < 0);
  }
  assert.equal(sampleAnticyclone(m.latitude, m.longitude, 0, calm).altitudeVelocity, 0);
});

test('longitude wrapping and regional fade are continuous and finite', () => {
  for (const longitude of [-Math.PI, -1, 0, 1, Math.PI]) {
    const a = sampleAnticyclone(m.latitude, longitude, 0.2, background);
    const b = sampleAnticyclone(m.latitude, longitude + 2 * Math.PI, 0.2, background);
    for (const key of Object.keys(a)) assert.ok(Math.abs(a[key] - b[key]) < 1e-12);
  }
  const inside = sampleAnticyclone(...point(m.outerRadius - 1e-6, 0), 0.2, background);
  const outside = sampleAnticyclone(...point(m.outerRadius + 1e-6, 0), 0.2, background);
  for (const key of Object.keys(inside)) {
    assert.ok(Number.isFinite(inside[key]));
    assert.ok(Math.abs(inside[key] - outside[key]) < 1e-9);
  }
});

test('advected surface tracers expand out of the core instead of following closed circles', () => {
  let east = 0.07,
    north = 0.02;
  const initialRadius = Math.hypot(east, north);
  let turns = 0,
    previousAngle = Math.atan2(north, east);
  for (let i = 0; i < 600; i++) {
    const wind = sampleAnticyclone(...point(east, north), 0.08, calm);
    east += wind.eastward * 0.02;
    north += wind.northward * 0.02;
    const angle = Math.atan2(north, east);
    turns += Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
    previousAngle = angle;
  }
  assert.ok(Math.hypot(east, north) > initialRadius * 2);
  assert.ok(turns < -Math.PI, 'parcel visibly rotates while escaping the core');
});

test('an ambient tracer enters the regional flow and leaves it again', () => {
  let latitude = m.latitude,
    longitude = m.longitude - 0.5 / Math.cos(m.latitude),
    altitude = 0.15;
  let peakInfluence = 0,
    leftAfterEntry = false;
  const ambient = { eastward: 0.08, northward: 0, altitudeVelocity: 0 };
  assert.equal(sampleAnticyclone(latitude, longitude, altitude, ambient).influence, 0);
  for (let i = 0; i < 3000; i++) {
    const wind = sampleAnticyclone(latitude, longitude, altitude, ambient);
    const radius = particleRadius(latitude, altitude);
    latitude += (wind.northward / radius) * 0.02;
    longitude += (wind.eastward / (radius * Math.cos(latitude))) * 0.02;
    altitude = Math.max(0.04, altitude + wind.altitudeVelocity * 0.02);
    peakInfluence = Math.max(peakInfluence, wind.influence);
    if (peakInfluence > 0.3 && wind.influence < 0.001) {
      leftAfterEntry = true;
      break;
    }
  }
  assert.ok(peakInfluence > 0.3);
  assert.ok(leftAfterEntry);
});
