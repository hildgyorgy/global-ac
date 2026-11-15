# Azores–Bermuda high prototype

AZORES HIGH enables a prescribed regional circulation centered at an illustrative
32° N, 45° W. This represents one idealized North Atlantic subtropical high,
not two simultaneous systems or the high's current observed position. The centre
is fixed to geographic longitude on the rotating Earth. The real system changes
position, size and intensity with season and weather.

## Field and exchange

`AnticycloneModel.ts` defines a renderer-independent CPU reference and parameters;
`AnticycloneNode.ts` is its TSL adapter. East/north offsets are a local tangent-plane
approximation with a compact, smooth outer footprint. The core blends towards
clockwise northern-hemisphere circulation. Lower air spirals outward; a weak,
illustrative convergent upper branch and central descent complete the vertical
pattern. Rotation, descent, height and time scales are exaggerated display units.
There is no pressure, friction, energy or mass-conservation solver here.

The wind is blended with the ambient circulation, not assigned as a closed orbit.
Existing particles can enter, leave and cross the idealized 30° cell boundary in
this region. Their current latitude band is retained on exit, avoiding a snap
back to their seed cell. Respawns still use the configured original allocation.
No new particles, colours, sizes, special trails or density bias are added.
Descending particles sample the same latitude/altitude temperature field.

The switch eases in and out globally; per-particle evaluation and advection
remain on the GPU. Coriolis supplies the background zonal response; this regional
clockwise flow is independently prescribed, not derived dynamically from that
response. Jets are applied afterward, retaining priority in their upper-air
bands. RESET and projection changes preserve the wind-control states.

## Appearance and limitations

The five equal recessed buttons stay centered under the globe, with RESET last.
The title remains in its own row. The regional spiral is easiest to read in 3D,
viewing the North Atlantic from above. A meridional projection only shows the
part currently inside its longitude wedge; it cannot display a full horizontal
vortex at every rotation angle. The high does not create clouds or a drawn ring.

The qualitative direction and low-level outward spiral follow the
[National Weather Service description](https://www.weather.gov/lmk/basic-fronts)
and [NWCG circulation overview](https://www.nwcg.gov/publications/pms425-1/5-general-circulation).
The vertical return pattern and numerical scales are pedagogical prescriptions,
not a reconstruction of a particular observed anticyclone.

## Verification

The Node tests check clockwise rotation, low-level divergence, upper convergence,
descent, off-state identity, compact support, longitude wrapping and an advected
parcel escaping the core. Geometry tests check alignment with the Earth texture.
With the dev server running, `/tests/anticyclone-gpu.html` compares actual GPU
wind and influence values to the CPU reference across location, altitude and
switch states, including the geographic-to-particle longitude conversion.
See [verification](verification.md) for the shared checks.
