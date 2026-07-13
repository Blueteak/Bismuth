# Bismuth Visualizer

A browser-based WebGPU study of physically motivated bismuth hopper-crystal
growth. The intended product shows continuous growth into a metallic,
thin-film-iridescent specimen rather than revealing a prebuilt mesh.

The public root is intentionally still a neutral foundation scene. The active
scientific task is a bismuth-specific one-nucleus model; the existing cubic
hopper is useful regression scaffolding but is not accepted product geometry.
Candidate 1's rhombohedral remapping was rejected. Candidate 2A's variational
thermal/free-surface model had a stable but non-hopper first 3D screen.
Candidate 2B validates a generic nonlocal rim-feeding signal but is deferred.
A frozen exact-seed pulse and resolved force projection now show why another
smooth Candidate 2A retune is not the answer: the surface contrast is not
rim-localized, and variational smoothing overwhelms its opening drive.
Candidate 2C's faceted outer-source/inward-step path now couples the
phase-specific surface heat supply, a closed three-dimensional thermal
capacity, and exact swept-volume latent return. Its reduced thermal and
observational scalar-carrier gates pass without asking Candidate 2A to carry
terraces. Its fixed screen and half-time-step arm now also pass the predeclared
temporal comparison and aligned GPU extraction gates. It remains the active
explicit-ledge path, but spatial and seed robustness are still open, its
coefficients are uncalibrated, and no Candidate 2 morphology is accepted. See
`current_tasks.md` for the current gate and next action.

## Product contract

- Desktop Chrome or Edge with hardware WebGPU; no silent fallback.
- The first generation starts after required resources are ready.
- The sole primary action is bottom-center: `Stop` while growing and
  `Regenerate` after stopping or completion. A stopped run cannot resume.
- The user may orbit and zoom a frozen or growing specimen.
- No public export, persistence, seed, parameter, resolution, timeline, or
  sharing controls.
- Rendering uses GPU marching cubes, metallic PBR, the repository-root
  `hdri.jpg`, and surface-age-driven oxide iridescence against black.

## Setup

Requires Node.js `24.x` and npm.

```powershell
npm.cmd install
npm.cmd run dev
```

`review.cmd` starts the development server and opens `/__dev/material`, the
single retained integrated review surface. Its model-neutral development
bridge can upload a CPU scalar snapshot through the production GPU
marching-cubes extractor. By default it compares the fixed `1600`-step
Candidate 2C screen with its half-time-step `3200`-step arm, then uploads the
refined scalar at the same 17 physical checkpoint times only if the
authoritative comparison passes. Add `?mode=material` to retain the generic
oxide-material fixture. Neither mode is approved product morphology.

Production-shaped local serving:

```powershell
npm.cmd run build
npm.cmd start
```

## Checks

```powershell
npm.cmd test                 # fast deterministic unit tests
npm.cmd run check:fast       # tests and TypeScript
npm.cmd run check:baseline   # full browser-free handoff gate
```

The automated suite does not launch a browser or require a GPU. Use the review
surface for relevant visual or GPU-pipeline changes; collect hardware-specific
measurements only when performance or adapter behavior is the task.

## Repository map

- `src/simulation`: generic runtime plus isolated Candidate 2A/2B/2C work.
- `src/extraction`: GPU marching cubes and CPU-checkable layout helpers.
- `src/rendering`: environment, material, oxide, and WebGPU capability code.
- `src/visualizer`: imperative live controller and scheduling.
- `server`: minimal Express static server and `/healthz`.
- `PLAN.md` and `current_tasks.md`: milestone sequence and immediate handoff.
- `docs/`: focused architecture, simulation, validation, and reference notes.

The scientific constraints and next implementation gate are in
[`docs/simulation-model.md`](docs/simulation-model.md) and
[`current_tasks.md`](current_tasks.md).
