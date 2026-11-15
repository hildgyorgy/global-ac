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

## Orientation annotations

Projection mode includes quiet copper-toned labels for the Equator, Tropics
of Cancer/Capricorn (±23.4°), Arctic/Antarctic Circles (±66.6°), and rotation
axis. Small labels run parallel to the tilted latitude chords. Geographic
names align right just left of the axis; horse-latitude names align left
just right of it. The rotation-axis tag sits outside the globe beside the
exposed upper shaft, connected by a short leader.

Each latitude label straddles its marked parallel: the name is above the
line and the degree value below. The Arctic Circle reverses that ordering
to keep its longer name inside the globe. Horse-latitude labels similarly
straddle their soft band centres.

The projection has no gold surface-outline ring. A neutral, faint haze begins
at the actual surface radius and fades outward across 0.17 model units. This
is a graphical bridge across the existing clearance, not a pressure, density
or temperature field; particle altitude is unchanged and the haze is absent
from the globe view.
Its peak opacity is only 0.06, keeping the inner surface edge barely suggested.
The rotation axis uses dash–dot marks only in projection; the globe retains
a continuous gold axis. Tropics and polar circles use short dashes in both
views. Equator and meridians retain continuous lines. Horse-latitude
bands are unchanged.

Short left-hand leader tags identify Hadley, Ferrel and Polar cells in both
hemispheres. Leaders point near each model cell's middle latitude and altitude
(±15°, ±45°, ±75°), while labels stay outside the particle cloud. They fade
with the rest of the projection diagram and add no dynamical geometry.

## Framing and staged transitions

Both camera presets dolly toward the near desk edge, keeping the instrument
row at its previous screen height while filling more of the upper image.
Magnification is constrained in narrow layouts to retain the title; wide
projection views receive 15% magnification. Geometry and particle physics
are not scaled or distorted by this camera adjustment.

Opening consists of a 1.4-second particle/camera morph followed immediately
by a 0.65-second fade-in of axis, parallels, labels and horse-latitude bands.
Closing first fades that diagram out, then reverses the morph. Globe guides
fade away during opening and return during closing. Reversals start from
current shape, camera and opacity values, so toggling mid-transition does
not reset them. Scripted camera movement temporarily suspends OrbitControls
updates to prevent polar-limit clamping during the fade-only phase.
Camera orientation is explicitly updated toward the interpolated target on
every transition frame, so resuming OrbitControls does not produce a vertical
snap after moving the camera position.

## Reading-lamp blackout

During the morph, room illumination follows `1 - sectionProgress`: the key,
local lamp pool, ambient fill, bulb, shade underside and room emissive details
dim together. The title inlay dims too; the three instrument buttons retain
independent emission, including a subdued readable off state in darkness.
At full projection the room is dark and the luminous particles/chart remain.
Closing reverses the same lighting curve after the chart has faded away.

The textured opaque Earth darkens completely by 45% opening, before the
existing 50% visibility exchange with the opaque projection face. The face
starts at background colour; its subtle face tone and surface haze fade in
from 55% opening onward. This hides the surface exchange without making
continents transparent to particles or changing their physical trajectories.

Horse latitudes are shown separately as soft illustrative 25–35° bands,
labelled ≈30° N/S. These indicate the subtropical high-pressure regions near
the descending Hadley branches, not fixed geographic boundaries or a
computed pressure field. Their widths are a display convention; real belts
vary with longitude, season and weather. The bands and labels appear only
in projection mode and do not affect particle positions or dynamics.
