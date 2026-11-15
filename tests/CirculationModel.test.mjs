import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleHadleyModel,
  HADLEY_MODEL,
  normalizeTemperatureKelvin,
} from '../src/atmosphere/HadleyModel.ts';
import {
  coriolisVisualScale,
  zonalCoriolisAcceleration,
  CORIOLIS_MODEL,
} from '../src/atmosphere/CoriolisModel.ts';

const rad = (degrees) => (degrees * Math.PI) / 180;
test('surface and upper branches reverse in Ferrel cells in both hemispheres', () => {
  for (const hemisphere of [-1, 1])
    for (const [degrees, surfaceDirection] of [
      [15, -1],
      [45, 1],
      [75, -1],
    ]) {
      assert.equal(
        Math.sign(sampleHadleyModel(rad(degrees * hemisphere), 0.1).latitudeVelocity),
        surfaceDirection * hemisphere,
      );
      assert.equal(
        Math.sign(sampleHadleyModel(rad(degrees * hemisphere), 0.9).latitudeVelocity),
        -surfaceDirection * hemisphere,
      );
    }
});
test('shared boundaries rise at the equator and polar front, sink at subtropics and poles', () => {
  for (const hemisphere of [-1, 1])
    for (const [degrees, direction] of [
      [0, 1],
      [30, -1],
      [60, 1],
      [90, -1],
    ]) {
      assert.equal(
        Math.sign(sampleHadleyModel(rad(degrees * hemisphere), 0.5).altitudeVelocity),
        direction,
      );
    }
});
test('temperature decreases with ascent and returns to the same value on descent', () => {
  const surface = sampleHadleyModel(rad(15), 0).temperatureKelvin;
  const upper = sampleHadleyModel(rad(15), 1).temperatureKelvin;
  assert.equal(surface - upper, HADLEY_MODEL.altitudeCoolingKelvin);
  assert.equal(normalizeTemperatureKelvin(HADLEY_MODEL.minimumKelvin), 0);
  assert.equal(
    normalizeTemperatureKelvin(HADLEY_MODEL.minimumKelvin + HADLEY_MODEL.temperatureRangeKelvin),
    1,
  );
  assert.equal(normalizeTemperatureKelvin(-100), 0);
  assert.equal(normalizeTemperatureKelvin(1000), 1);
});
test('Coriolis turns equatorward air west and poleward air east in both hemispheres', () => {
  for (const hemisphere of [-1, 1]) {
    assert.ok(zonalCoriolisAcceleration(rad(30 * hemisphere), -0.1 * hemisphere) < 0);
    assert.ok(zonalCoriolisAcceleration(rad(30 * hemisphere), 0.1 * hemisphere) > 0);
  }
  assert.equal(zonalCoriolisAcceleration(0, 0.1), 0);
});
test('polar visual taper is symmetric, bounded and retains positive damping', () => {
  for (let degrees = 0; degrees <= 90; degrees++) {
    const scale = coriolisVisualScale(rad(degrees));
    assert.equal(scale, coriolisVisualScale(rad(-degrees)));
    assert.ok(scale >= CORIOLIS_MODEL.polarVisualScale && scale <= 1);
  }
  assert.ok(CORIOLIS_MODEL.drag > 0 && CORIOLIS_MODEL.switchOffDrag > 0);
});
