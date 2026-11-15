# Coriolis display scaling

The equations and physical limitations are described in [the model](model.md).
`CoriolisModel.ts` owns the response parameters and CPU reference;
`CoriolisNode.ts` adapts them to TSL.

The visual taper is unity through the configured start latitude and decreases
smoothly to `polarVisualScale` at the pole. It scales both zonal acceleration
and the longitude-rate safety limit. The sine-of-latitude physical factor is
retained. Damping is positive in both control states.

Reference tests cover hemisphere symmetry, drift direction and damping.
The browser GPU fixture compares the actual adapter with the CPU equations.
See [verification](verification.md) for commands and manual checks.
