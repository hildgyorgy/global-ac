import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import {
  shellThickness,
  particleRadius,
  SURFACE_CLEARANCE,
  radialVelocity,
  geographicLongitude,
  particleLongitude,
} from '../src/atmosphere/geometry.ts';

test('the display shell has configured equatorial and polar thickness and symmetric clearance', () => {
  assert.equal(shellThickness(0), CONFIG.atmosphere.equatorialShellThickness);
  assert.equal(shellThickness(Math.PI / 2), CONFIG.atmosphere.polarShellThickness);
  for (let latitude = 0; latitude <= Math.PI / 2; latitude += 0.05) {
    assert.equal(shellThickness(latitude), shellThickness(-latitude));
    assert.equal(particleRadius(latitude, 0), CONFIG.earth.radius + SURFACE_CLEARANCE);
    assert.ok(particleRadius(latitude, 1) > particleRadius(latitude, 0));
  }
});
test('radial velocity matches a finite difference along a moving parcel', () => {
  for (const latitude of [-1.3, -0.5, 0, 0.5, 1.3])
    for (const altitude of [0.1, 0.5, 0.9]) {
      const v = 0.03,
        w = -0.07,
        step = 1e-5;
      const finiteDifference =
        (particleRadius(latitude + v * step, altitude + w * step) -
          particleRadius(latitude - v * step, altitude - w * step)) /
        (2 * step);
      assert.ok(Math.abs(finiteDifference - radialVelocity(latitude, altitude, v, w)) < 1e-9);
    }
});

test('geographic longitude aligns the particle frame with the rotated Earth texture', () => {
  for (const longitude of [-Math.PI, -0.785, 0, 1.5, Math.PI]) {
    const angle = particleLongitude(longitude);
    assert.ok(Math.abs(geographicLongitude(angle) - longitude) < 1e-15);
    // SphereGeometry: texture u=(longitude+pi)/(2*pi), phi=2*pi*u.
    const phi = longitude + Math.PI;
    const x = -Math.cos(phi),
      z = Math.sin(phi),
      rotation = CONFIG.earth.rotationRadians;
    const textureX = x * Math.cos(rotation) + z * Math.sin(rotation);
    const textureZ = -x * Math.sin(rotation) + z * Math.cos(rotation);
    assert.ok(Math.abs(Math.cos(angle) - textureX) < 1e-14);
    assert.ok(Math.abs(Math.sin(angle) - textureZ) < 1e-14);
  }
});
