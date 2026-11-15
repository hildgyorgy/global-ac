# Particle motion trails

`GpuParticleTrails.ts` draws short histories for every 24th particle: 2,014 of the current 48,333 particles. Each cell budget is half the preceding version: Hadley 25,000, Ferrel 16,667, polar 6,666 (both hemispheres combined). Selection is stable and spans all cell budgets. Heads retain the same size and temperature color as every other particle.

Each trail stores 24 actual position/temperature samples in GPU storage, sampled approximately every 75 ms: a maximum of 1.8 seconds of simulated display time. A live head segment joins the current particle to the newest stored sample. Older segments fade smoothly to zero. Histories use the rotating Earth frame so they show wind relative to the surface and its meridians, rather than combining wind with the global visual spin. These are sampled paths, not velocity-extrapolated arrows or predefined streamlines.

One compute invocation owns each trail and shifts its history in descending order, avoiding cross-invocation read/write races. A separate GPU lifetime buffer detects respawns every frame. Respawns collapse the entire old history to the new position before rendering, even between sample ticks, preventing teleport streaks. Initial histories are likewise collapsed. The history update runs after particle advection.

Line vertices fetch history directly from GPU storage using `vertexIndex`. CPU code updates only the global sampling uniform; no per-particle updates or GPU readbacks occur. History storage is approximately 773 KB, plus lifetime state and static zero-position topology. Lines use normal Earth depth occlusion, additive blending, and no depth writes. Temperature and age fade interpolate along each segment. The same spin-aware slab filter as the particle renderer is evaluated on interpolated trail positions, clipping trails to the fixed meridional section.

TSL APIs follow the official [Three.js TSL reference](https://threejs.org/docs/pages/TSL.html).
