# Particle trails

`ParticleTrailsModel.ts` selects every stride-th circulation particle and every
stride-th marker independently within each jet group. This avoids aliasing
between the trail stride and the interleaved northern/southern jet allocation.
Each group rounds up its trail count, so all four jets receive the same sampling
ratio, with at most one tracer of rounding difference. History length and sample
interval are defined in the same model. The index map is uploaded once;
`GpuParticleTrails.ts` uses it for both GPU history updates and line rendering.

One GPU invocation owns a complete trail. Samples shift in descending order
after advection, avoiding cross-invocation races. A life increase clears the
history on respawn, preventing a line connecting unrelated positions. Initial
histories are collapsed at their particle positions.

Vertices fetch history from GPU storage. The CPU supplies static topology and
a global sampling uniform; it never reads production particle history back.
Segments use Earth depth occlusion, additive blending and no depth writes.
Age and life fades combine with the common temperature ramp, jet-marker fade,
cell focus and meridional projection. The shared appearance functions live in
`ParticleAppearanceNode.ts`.

See [the model conventions](model.md) for the meaning of temperature and sampling.
