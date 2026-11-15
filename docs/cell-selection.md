# Cell selection

A short click or tap toggles focus on one of the six hemisphere/cell pairs.
The same cell again, empty space or RESET clears selection. Focus survives
projection and wind-control changes. Selected particles and trails brighten;
other cells remain dimly visible without altering their temperature colours.
The shared intensity factors are in `CellSelectionNode.ts`.

`CellSelection.ts` distinguishes taps from drags, holds and multitouch before
raycasting in globe coordinates. Surface/limb hits identify latitude in 3D;
projection hits use the meridional plane. The common atmospheric geometry
bounds valid hits. Consumed desk-control taps do not select cells.

Particle and historical trail positions use the same cell classifier and
projection. Camera gestures remain available without hover-dependent controls.
See [verification](verification.md) for interaction checks.
