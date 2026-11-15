# Jet-stream rendering

JET-STREAMS independently enables the prescribed bands described in
[the model](model.md). `JetStreamsModel.ts` owns band positions, widths, speed
scaling and extra-marker budget; `JetStreamsNode.ts` evaluates the field in TSL.

Ordinary particles enter and leave the bands through the unchanged meridional
circulation. Extra markers seed in compact meridional disks at the four cores,
spread over longitude. Their age, exit fade and reseeding run on the GPU.
All extra markers are hidden when jets are disabled. Switch strength eases
globally on the CPU; per-particle simulation remains GPU-resident.

The core target is eastward in both hemispheres. The radial speed metric
includes latitude-dependent shell thickness, using the shared geometry adapter.
Temperature colours, particle size and trail stride are common to both populations.

In projection, horizontal SUBTROPICAL JET and POLAR-FRONT JET tags identify the
left-limb cores in both hemispheres. Radial leaders and small centre rings use
the model's latitude and altitude. Tags follow the diagram transition and are
visible only when jets are enabled. The clearest eastward-motion impression
is in globe mode, because projection collapses longitude within its wedge.

See [verification](verification.md) for CPU and actual WebGPU checks.
