import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { shellThickness, particleRadius, SURFACE_CLEARANCE, radialVelocity } from '../src/atmosphere/geometry.ts';

test('the display shell has configured equatorial and polar thickness and symmetric clearance', () => {
  assert.equal(shellThickness(0), CONFIG.atmosphere.equatorialShellThickness);
  assert.equal(shellThickness(Math.PI / 2), CONFIG.atmosphere.polarShellThickness);
  for (let latitude = 0; latitude <= Math.PI / 2; latitude += .05) {
    assert.equal(shellThickness(latitude), shellThickness(-latitude));
    assert.equal(particleRadius(latitude, 0), CONFIG.earth.radius + SURFACE_CLEARANCE);
    assert.ok(particleRadius(latitude, 1) > particleRadius(latitude, 0));
  }
});
test('radial velocity matches a finite difference along a moving parcel', () => {
  for (const latitude of [-1.3, -.5, 0, .5, 1.3]) for (const altitude of [.1, .5, .9]) {
    const v = .03, w = -.07, step = 1e-5;
    const finiteDifference = (particleRadius(latitude + v * step, altitude + w * step)
      - particleRadius(latitude - v * step, altitude - w * step)) / (2 * step);
    assert.ok(Math.abs(finiteDifference - radialVelocity(latitude, altitude, v, w)) < 1e-9);
  }
});
