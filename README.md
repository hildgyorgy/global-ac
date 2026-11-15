# global-ac

A WebGPU atmospheric circulation globe in a dark library study, built with
Three.js, TypeScript and Vite. GPU particles show idealized Hadley, Ferrel and
polar cells, optional Coriolis deflection, jet streams and five oceanic subtropical highs. A meridional
projection reveals the vertical circulation. A brass [season dial](docs/season-dial.md)
turns the tilted globe between December and June under a fixed lamp.

[Open the live globe](https://hildgyorgy.github.io/global-ac/).

## Development

Use Node.js 22.13 or newer and pnpm 10 (the version used in CI).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The browser must support WebGPU. Safari and Chrome on Apple Silicon are the
primary targets; there is no WebGL fallback.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:physics
pnpm build
pnpm preview
```

With the development server running, `/tests/jet-gpu.html` checks the actual
GPU circulation, Coriolis, geometry and jet calculations against CPU references. The companion `/tests/anticyclone-gpu.html` checks the
regional highs and their geographic anchoring.
GitHub Actions runs the physics tests and build, then deploys `dist/` to Pages.

## Project files

- `src/atmosphere/`: renderer-independent models, TSL adapters, GPU simulation and trails.
- `src/earth/`: Earth surface, geographic guides and projection annotations.
- `src/camera/`, `src/ui/`: camera interaction, selection and desk controls.
- `src/scene/`: the procedural library and desk.
- `src/config.ts`: shared display and particle configuration.
- `docs/`: model assumptions, visual exaggerations and feature notes.

The circulation is an educational analytic model, not a weather simulation.
Atmospheric thickness, motion speeds and particle sampling are exaggerated for
legibility; see the feature documents for the specific conventions.

## Generated local files

`node_modules/` contains installed development dependencies. `dist/` contains
the generated website, and `*.tsbuildinfo` caches TypeScript build information.
All are excluded from Git and can be regenerated. Keep `pnpm-lock.yaml`: it
records the dependency versions needed to reproduce the build.

To reclaim dependency storage temporarily, remove `node_modules/`, then run
`pnpm install --frozen-lockfile` before developing again. The deployed site does
not depend on this local folder. Visitors receive the built application and
assets, not the development dependency directory.

Read [model assumptions](docs/model.md) and [verification instructions](docs/verification.md)
for scientific limitations and reproducible checks.

Formatting uses Prettier; `pnpm format` applies it. ESLint checks unused symbols,
explicit `any`, control-flow mistakes and strict equality without imposing a large
framework-specific rule set. These tools are development dependencies only.
