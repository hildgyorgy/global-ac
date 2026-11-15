# Verification

Use Node.js 22.13+ and pnpm 10, then run:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:physics
pnpm build
```

The Node suite checks circulation branch directions and shared boundaries,
temperature normalization, Coriolis signs and taper, geometric metrics,
jet speed/exclusion/symmetry, tracer passage through a jet, and startup
success/failure routing. These are model checks, not validation against weather data.

## Actual GPU calculations

Run `pnpm dev`, then open `/tests/jet-gpu.html` in a WebGPU-capable browser.
The page reports PASS or the first mismatch. It compares circulation velocity,
normalized temperature, Coriolis acceleration/taper, shell geometry and jet speed
against CPU references, including both hemispheres, boundaries and polar cases.
It also checks jet seed positions and positive switch damping. Case counts
are derived from the fixture loops and configured marker budget.

Only this diagnostic reads small GPU result buffers back to the CPU. Production
simulation does not. The fixture is a development page and is not shipped in
the Vite production entry. It must be run manually; the Pages workflow runs
the format/lint checks, Node tests and build, not a GPU-enabled browser.

## Visual and interaction checks

Use the production preview and inspect the browser's WebGPU console:

- Globe particles, temperature colours and short fading trails remain visible;
  run long enough for several respawns and check for teleport streaks.
- Toggle Coriolis, jets and AZORES HIGH in both views; verify active button states, jet tags
  and that RESET preserves wind settings while clearing cell focus.
- Open projection: particles unfold before chart labels appear, while the room
  dims. Reverse the transition, including toggling midway, and check for jumps.
- Tap a cell, toggle it off, tap empty space, drag/orbit, zoom and reset. Long
  holds and multitouch must remain navigation rather than selection.
- Check wide and portrait framing, keyboard controls and physical touch hardware
  when available. Desktop viewport emulation does not validate a real tablet.

Startup failures should display a readable alert instead of leaving a black
canvas. Unsupported WebGPU and failed renderer/compute initialization have
separate messages; diagnostic details are logged to the console.

For a real startup-path fault-injection check, open `/tests/startup-error.html`
and `/tests/startup-error.html?stage=compute` on the development server. These
development-only fixtures temporarily reject renderer or particle initialization
and verify that the real error handler replaces the canvas with an alert.
The simulated failure is expected in the console; the page must report PASS
without an unhandled rejection.

For the regional high, open `/tests/anticyclone-gpu.html` and require PASS. In
globe view, enable AZORES HIGH and inspect the North Atlantic: trajectories
should turn clockwise, broaden outward near the surface, and blend back into
the ambient flow. Check coexistence with jets and cell selection, plus the
five-button row in wide and portrait viewports.
