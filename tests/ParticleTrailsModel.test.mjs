import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { JET_STREAMS_MODEL } from '../src/atmosphere/JetStreamsModel.ts';
import { createTrailParticleIndices, TRAILS_MODEL } from '../src/atmosphere/ParticleTrailsModel.ts';

test('trail selection covers every jet group at the circulation sampling ratio', () => {
  const baseCount = CONFIG.atmosphere.particleCount;
  const extraCount = JET_STREAMS_MODEL.extraTracerCount;
  const groups = JET_STREAMS_MODEL.bands.length * 2;
  const indices = createTrailParticleIndices(baseCount, extraCount);
  const selectedPerGroup = Array(groups).fill(0);
  const populationPerGroup = Array(groups).fill(0);
  for (let i = 0; i < extraCount; i++) populationPerGroup[i % groups]++;
  for (const index of indices) {
    if (index >= baseCount) selectedPerGroup[(index - baseCount) % groups]++;
  }
  selectedPerGroup.forEach((count, group) => {
    assert.ok(count > 0, `Jet group ${group} must have trails`);
    assert.equal(count, Math.ceil(populationPerGroup[group] / TRAILS_MODEL.stride));
  });
  assert.ok(Math.max(...selectedPerGroup) - Math.min(...selectedPerGroup) <= 1);
});

test('static trail indices are unique, valid and retain the ordinary selection', () => {
  for (const baseCount of [0, 1, 23, 24, 25, CONFIG.atmosphere.particleCount]) {
    for (const extraCount of [0, 1, 3, 4, 25, 96, 97, JET_STREAMS_MODEL.extraTracerCount]) {
      const indices = [...createTrailParticleIndices(baseCount, extraCount)];
      assert.equal(new Set(indices).size, indices.length);
      assert.ok(indices.every((index) => index >= 0 && index < baseCount + extraCount));
      assert.deepEqual(
        indices.filter((index) => index < baseCount),
        Array.from(
          { length: Math.ceil(baseCount / TRAILS_MODEL.stride) },
          (_, i) => i * TRAILS_MODEL.stride,
        ),
      );
    }
  }
});
