# Oceanic subtropical high prototypes

HIGHS enables five prescribed regional circulations. Their fixed centres are
illustrative, not observed positions or a season-specific climatology:

| High                       | Latitude | Longitude |
| -------------------------- | -------- | --------- |
| Azores–Bermuda             | 32° N    | 45° W     |
| North Pacific              | 32° N    | 145° W    |
| South Atlantic / St Helena | 30° S    | 15° W     |
| South Pacific              | 30° S    | 100° W    |
| South Indian / Mascarene   | 30° S    | 70° E     |

All centres are fixed to geographic longitude on the rotating Earth. Real highs
change position, size and intensity with season and weather. The Azores–Bermuda
entry represents one system; continental winter highs are not included.

## Field and exchange

`AnticycloneModel.ts` defines a renderer-independent CPU reference and parameters;
`AnticycloneNode.ts` is its TSL adapter. East/north offsets are a local tangent-plane
approximation with a compact, smooth outer footprint. Each core blends towards
clockwise circulation north of the equator and counterclockwise circulation
south of it. Lower air spirals outward; a weak,
illustrative convergent upper branch and central descent complete the vertical
pattern. All five share the prototype
parameters; this does not assert equal real-world size or strength. Contributions
are combined in a normalized, bounded blend rather than applied sequentially.
Rotation, descent, height and time scales are exaggerated display units.
There is no pressure, friction, energy or mass-conservation solver here.

The wind is blended with the ambient circulation, not assigned as a closed orbit.
Existing particles can enter, leave and cross the idealized 30° cell boundary in
these regions. Their current latitude band is retained on exit, avoiding a snap
back to their seed cell. Respawns still use the configured original allocation.
No new particles, colours, sizes, special trails or density bias are added.
Descending particles sample the same latitude/altitude temperature field.

The switch eases in and out globally; per-particle evaluation and advection
remain on the GPU. Coriolis supplies the background zonal response; the regional
circulations are independently prescribed, not derived dynamically from that
response. Jets are applied afterward, retaining priority in their upper-air
bands. RESET and projection changes preserve the wind-control states.

## Appearance and limitations

The five equal recessed buttons stay centered under the globe, with RESET last.
The title remains in its own row. The regional spiral is easiest to read in 3D,
viewing an oceanic centre from above. A meridional projection only shows the
part currently inside its longitude wedge; it cannot display a full horizontal
vortex at every rotation angle. The highs do not create clouds or drawn rings.

The qualitative direction and low-level outward spiral follow the
[National Weather Service description](https://www.weather.gov/lmk/basic-fronts)
and [NWCG circulation overview](https://www.nwcg.gov/publications/pms425-1/5-general-circulation).
The vertical return pattern and numerical scales are pedagogical prescriptions,
not a reconstruction of a particular observed anticyclone.

## Verification

The Node tests check hemisphere-dependent rotation, low-level divergence, upper convergence,
descent, off-state identity, compact support, longitude wrapping and an advected
parcel escaping the core. Geometry tests check alignment with the Earth texture.
With the dev server running, `/tests/anticyclone-gpu.html` compares actual GPU
wind and influence values to the CPU reference around all five centres, across altitude and
switch states, including the geographic-to-particle longitude conversion.
See [verification](verification.md) for the shared checks.

The five-basin grouping follows the two northern and three southern oceanic
subtropical highs described in the
[NOAA-hosted circulation study](https://repository.library.noaa.gov/view/noaa/27715/noaa_27715_DS1.pdf).
