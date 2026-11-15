# Idealized jet streams

The **JET-STREAMS** desk button enables four prescribed upper-air wind bands:
subtropical centres at ±30°, polar-front centres at ±55°. This follows the
broad placement described by [NOAA](https://www.noaa.gov/jetstream/global/jet-stream),
but is an educational analytic field, not a numerical weather simulation.

## One shared wind field

All existing 48,333 tracers sample the same augmented field. There is no
separate population, jet status, respawn rule or particle-count increase.
North–south and vertical circulation continue unchanged, carrying tracers
into and out of the jet regions. Their temperature model, red–blue colours,
size and brightness are unchanged. Every 24th tracer still has a trail:
2,014 trails with the same history interval and length as before.

Jet weight is the sum of two latitude Gaussians (standard deviations 3.5°
and 4.5°), mirrored across the equator, multiplied by a vertical Gaussian
centred at normalized altitude 0.84 with width 0.10. A smooth lower gate
is zero through 0.55 and fully open by 0.70. These heights refer to the
deliberately exaggerated model shell, not kilometres or pressure levels.

At a fully enabled jet core, total Earth-relative wind speed targets twice
the local background magnitude. Only the eastward component is changed:

`u_target = sqrt((2 × max(|V_background|, 0.06))² − v² − w²)`

The positive root enforces west-to-east motion in both hemispheres. A smooth
weight blends the background eastward wind toward this target. The 0.06
Earth-radius/display-second reference floor prevents dead jets near the
idealized cells' stagnation points; speed there can exceed twice the tiny
local background. Thus the 2× ratio is a visualization convention, not a
claim about a fixed ratio in the real atmosphere. The radial metric includes
the latitude-dependent shell thickness derivative.

The existing Coriolis response and its polar cap remain the background.
Its on-state visual damping is preserved (1.336/display second). The switch
now uses explicit TSL `mix(a, b, t)` ordering, so turning Coriolis off damps
residual zonal speed with positive 1.4/display-second drag instead of the
old accidental negative drag. This makes both wind controls reversible.
Jets are applied after that cap, and their switch is independent of the
Coriolis button. They are prescribed winds, not winds dynamically generated
by solving thermal-wind balance or pressure gradients. Their effects do not
feed back on the fixed meridional circulation. There are no meanders,
synoptic eddies, seasons or jet-induced temperature changes in this version.

## GPU and interaction

`JetStreamsModel.ts` contains renderer-independent parameters and a CPU
reference. `JetStreamsNode.ts` evaluates the same model in TSL compute.
Positions, velocities, lifetimes and trail histories remain GPU-resident.
Only a global switch-strength uniform is eased on the CPU, with a 0.55-second
time constant, avoiding abrupt velocity changes on activation/deactivation.

The four equal brass pills remain centred under the globe. The title inlay
is smaller to make room; RESET remains last. Reset and projection changes
preserve both jet and Coriolis state. The strongest directional impression
is in 3D: a meridional projection intentionally collapses east–west motion,
though faster tracers still enter and leave its selected longitude wedge.

## Validation

- `pnpm run test:physics`: six tests cover off-state identity, lower-air
  exclusion, hemisphere symmetry, eastward core flow, the 2× total-speed
  target, the reference floor, and a tracer entering/leaving a jet region.
- `pnpm run build`: TypeScript and production bundle.
- With Vite dev running, `/tests/jet-gpu.html` compares 315 actual WebGPU
  compute results with the CPU reference. Observed maximum absolute error:
  approximately 1.1×10⁻⁷. Positive Coriolis damping in all switch states is
  also checked on the GPU. This test alone reads a tiny result buffer back;
  production particle simulation never does.
- Browser checks: physical pill clicks, both wind switches, projection,
  dark-room controls, reset-state preservation and WebGPU console output.
