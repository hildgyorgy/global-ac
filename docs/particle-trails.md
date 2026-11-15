# Particle trails

`GpuParticleTrails.ts` selects every `STRIDE`th particle, including supplementary
jet markers. Trail count is `ceil(totalParticleCount / STRIDE)`; history length
and sampling interval are defined beside that stride. Counts derive from
`CONFIG.atmosphere` and `JET_STREAMS_MODEL`, rather than a separate fixed budget.

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
