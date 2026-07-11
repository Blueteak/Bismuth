# Bismuth Visualizer

A browser-based real-time visualizer for physically motivated bismuth hopper-crystal growth. The core Milestone 1 single-crystal solver is implemented: it includes a deterministic CPU reference, a full-volume TSL/WebGPU phase-field solver, write-once solidification time, developer morphology diagnostics, and a validated single-hopper checkpoint. The public route intentionally remains the Milestone 0C foundation scene until live GPU surface extraction and lifecycle work are implemented.

## Prerequisites

- Node.js 24.12.0 (see `.nvmrc`)
- npm 11.6.2
- The Codex in-app browser with hardware WebGPU for GPU tests and benchmarks
- The user-provided `hdri.jpg` at the repository root (integrated in 0C without modifying the source file)

## Install and run

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the local URL printed by Vite.

## Validation commands

```powershell
npm.cmd test
npm.cmd run test:gpu
npm.cmd run validate:morphology
npm.cmd run test:e2e
npm.cmd run benchmark
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

The production server uses `PORT=3000` by default and exposes `GET /healthz`.

`test:gpu`, `validate:morphology`, and `benchmark` start a temporary local fixture and wait for a report from the Codex in-app browser. Open the printed fixture URL in that browser. The fixture fails if it cannot obtain a hardware adapter, if Three.js selects a fallback backend, if its numerical or morphology gate fails, or if WebGPU reports an uncaptured error.

- `test:gpu` compares the `9^3` CPU and WebGPU single-crystal fields in addition to the Milestone 0B compute and indirect-draw proofs. Its latest report is `test-results/gpu/latest.json`.
- `validate:morphology` runs the unperturbed published hopper control at `256^3`, `dx = 1`, and `t = 500` through the developer-only `/__dev/single-crystal` route. Its latest report is `test-results/gpu/latest-morphology.json`.
- A physics-perturbed validation run can use the same runner with `--perturbed`; perturbations are smooth deterministic changes to initial or far-field conditions, not changes to the final geometry.

Example perturbed checkpoint:

```powershell
node scripts/run-browser-gpu-test.mjs --morphology --perturbed --high-resolution --grid=256 --steps=50000 --dt=0.01 --mu=0.04
```

The accepted Step 1 checkpoint and model limits are recorded in `docs/simulation-model.md` and `docs/testing-and-validation.md`. The implemented cubic model is a generic hopper baseline; it does not yet represent bismuth-specific rhombohedral facets, screw-dislocation spirals, twins, or multiple grain orientations.
