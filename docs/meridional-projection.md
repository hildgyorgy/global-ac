# Meridional projection

The illuminated **PROJECTION** button replaces the former thin physical slice
with a meridional projection. It includes particles within ±22.5° of either
half of the fixed meridian plane, with a soft edge from 20° to 22.5°.
Both particles and their stored trail samples use the same GPU projection.

The display preserves latitude and distance from Earth's centre, so altitude
and temperature remain meaningful. Longitude within the wedge is collapsed
onto the middle plane. This is a projection, not a physical cross-section:
east–west motion is hidden, although it still influences which particles
enter and leave the wedge. The simulation and GPU histories remain 3D.

The globe mode, circulation, temperature model and particle budgets are
unchanged. Projection brightness is 1.6× globe brightness (formerly the
thin slice needed 2.4×); the broader sample supplies the extra density.
