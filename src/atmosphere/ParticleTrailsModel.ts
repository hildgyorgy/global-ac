import { JET_STREAMS_MODEL } from './JetStreamsModel.ts';

export const TRAILS_MODEL = {
  stride: 24,
  samples: 24,
  sampleInterval: 0.075,
} as const;

/** Static selection only: every stride-th circulation tracer and every
 * stride-th marker within each jet group. Jet groups interleave in storage,
 * so a stride divisible by their count must not be applied globally.
 */
export function createTrailParticleIndices(baseCount: number, extraCount: number): Uint32Array {
  const indices: number[] = [];
  for (let index = 0; index < baseCount; index += TRAILS_MODEL.stride) indices.push(index);

  const groupCount = JET_STREAMS_MODEL.bands.length * 2;
  for (let group = 0; group < groupCount; group++) {
    for (let index = group; index < extraCount; index += TRAILS_MODEL.stride * groupCount) {
      indices.push(baseCount + index);
    }
  }
  return new Uint32Array(indices);
}
