import test from 'node:test';
import assert from 'node:assert/strict';
import { JET_STREAMS_MODEL as model, jetStreamWeight, sampleJetEastwardSpeed } from '../src/atmosphere/JetStreamsModel.ts';
import { sampleHadleyModel } from '../src/atmosphere/HadleyModel.ts';

test('disabled jets reproduce the background exactly across the atmosphere', () => {
  for (let degrees = -90; degrees <= 90; degrees += 5) {
    for (const altitude of [0, .3, .55, .7, .84, 1]) {
      for (const eastward of [-.3, 0, .3]) {
        assert.equal(sampleJetEastwardSpeed(degrees * Math.PI / 180, altitude,
          { eastward, northward: .04, radial: -.02 }, 0), eastward);
      }
    }
  }
});

test('jets are absent in the lower atmosphere, even under each core', () => {
  for (const band of model.bands) {
    for (const sign of [-1, 1]) {
      for (const height of [0, .2, .4, model.lowerAltitude]) {
        assert.equal(jetStreamWeight(sign * band.latitude, height), 0);
        assert.equal(sampleJetEastwardSpeed(sign * band.latitude, height,
          { eastward: -.12, northward: .03, radial: .01 }), -.12);
      }
    }
  }
});

test('all four cores are eastward and double the full background speed', () => {
  for (const band of model.bands) for (const sign of [-1, 1]) {
    assert.equal(jetStreamWeight(sign * band.latitude, model.coreAltitude), 1);
    for (const eastward of [-.3, -.08, .08, .3]) {
      const wind = { eastward, northward: .04, radial: -.02 };
      const before = { ...wind };
      const jet = sampleJetEastwardSpeed(sign * band.latitude, model.coreAltitude, wind);
      assert.ok(jet > 0);
      const ratio = Math.hypot(jet, wind.northward, wind.radial)
        / Math.hypot(eastward, wind.northward, wind.radial);
      assert.ok(Math.abs(ratio - 2) < 1e-12);
      assert.deepEqual(wind, before);
    }
  }
});

test('the reference floor carries tracers through idealized stagnation points', () => {
  const eastward = sampleJetEastwardSpeed(model.bands[0].latitude, model.coreAltitude,
    { eastward: 0, northward: 0, radial: 0 });
  assert.equal(eastward, model.coreSpeedMultiplier * model.minimumReferenceSpeed);
});

test('jet weights are symmetric, bounded and smoothly weaken outside their cores', () => {
  for (let degrees = 0; degrees <= 90; degrees += .5) for (let h = 0; h <= 1; h += .025) {
    const latitude = degrees * Math.PI / 180;
    const weight = jetStreamWeight(latitude, h);
    assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1);
    assert.equal(weight, jetStreamWeight(-latitude, h));
  }
  for (const band of model.bands) {
    assert.ok(jetStreamWeight(band.latitude + band.width, model.coreAltitude) < .7);
    assert.ok(jetStreamWeight(band.latitude, model.coreAltitude - model.altitudeWidth) < .7);
  }
});

test('an advected upper-cell tracer enters and later leaves the jet region', () => {
  let latitude = 10 * Math.PI / 180, altitude = .93;
  let peak = 0, leftAfterPeak = false;
  assert.ok(jetStreamWeight(latitude, altitude) < .001);
  for (let i = 0; i < 4000; i++) {
    const field = sampleHadleyModel(latitude, altitude);
    latitude += field.latitudeVelocity * .02;
    altitude = Math.min(.96, Math.max(.04, altitude + field.altitudeVelocity * .02));
    const weight = jetStreamWeight(latitude, altitude);
    peak = Math.max(peak, weight);
    if (peak > .15 && weight < .01) leftAfterPeak = true;
  }
  assert.ok(peak > .15);
  assert.ok(leftAfterPeak);
});
