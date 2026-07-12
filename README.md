# Bismuth Visualizer

A browser-based real-time visualizer for physically motivated bismuth hopper-crystal growth. Milestone 1 is complete for its scoped single-hopper objective: it includes a deterministic CPU reference, a full-volume TSL/WebGPU phase-field solver, write-once solidification time, developer morphology diagnostics, a grid-refined hopper, and a four-seed fast suite. The recorded paper-transition investigation reproduces cube and hopper but not the fractal and dendritic gates. The public route intentionally remains the Milestone 0C foundation scene until Milestone 2 adds live GPU surface extraction.

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
npm.cmd run validate:morphology:quick
npm.cmd run validate:morphology:reference
npm.cmd run validate:morphology
npm.cmd run validate:morphology:seed:99539473
npm.cmd run validate:morphology:seed:324508639
npm.cmd run validate:morphology:seed:610839776
npm.cmd run validate:morphology:seed:3221344269
npm.cmd run validate:morphology:seeds:compare
npm.cmd run validate:transition:control
npm.cmd run validate:transition:quick
npm.cmd run validate:transition:reference
npm.cmd run validate:transition:compare
npm.cmd run validate:transition:cube
npm.cmd run validate:transition:fractal
npm.cmd run validate:transition:cube:source
npm.cmd run validate:transition:fractal:source
npm.cmd run validate:transition:summarize
npm.cmd run validate:coupling
npm.cmd run test:e2e
npm.cmd run benchmark
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

The production server uses `PORT=3000` by default and exposes `GET /healthz`.

`test:gpu`, the morphology commands, and `benchmark` start a temporary local fixture and wait for a report from the Codex in-app browser. Open the printed fixture URL in that browser. The fixture fails if it cannot obtain a hardware adapter, if Three.js selects a fallback backend, if its numerical or morphology gate fails, or if WebGPU reports an uncaptured error.

- `test:gpu` compares the `9^3` CPU and WebGPU single-crystal fields in addition to the Milestone 0B compute and indirect-draw proofs. Its latest report is `test-results/gpu/latest.json`.
- `validate:morphology:quick` is the routine per-edit solver screen. It runs the deterministic perturbed hopper at `128^3`, `dx = 2`, `dt = 0.01`, and `t = 500`, and it enforces both its calibrated metric envelope and a hard `25000 ms` fixture deadline. Its report is `test-results/gpu/latest-morphology-quick.json`.
- `validate:morphology:reference` runs the paired perturbed `256^3`, `dx = 1` regression gate. It is intentionally outside the quick-loop budget and is required when promoting a scientific solver change. Its report is `test-results/gpu/latest-morphology-reference.json`.
- `validate:morphology` runs the unperturbed published hopper acceptance control at `256^3`, `dx = 1`, and `t = 500`. Its report is `test-results/gpu/latest-morphology-acceptance.json`.
- Each `validate:morphology:seed:*` command runs one retained perturbed `128^3` hopper under the same `25000 ms` deadline and writes a seed-specific report. All four recorded runs complete in `14.85..15.32 s`; `validate:morphology:seeds:compare` verifies their configuration, hopper gates, connectivity, timing, and distinct summaries.
- `validate:transition:control` and `validate:transition:quick` are the calibrated `D_L = 4`, `t = 350` temporal pair at `128^3`, `dx = 2`. They compare `dt = 0.01` with `dt = 0.005`; both enforce a hard `25000 ms` fixture deadline.
- `validate:transition:reference` is the one-time `256^3`, `dx = 1`, `dt = 0.005`, `t = 350` spatial pair for that screen. It is intentionally outside the quick-loop budget.
- `validate:transition:compare` reads the three latest transition reports, checks scale-aware spatial correlation, writes `test-results/gpu/latest-dl4-screen-comparison.json`, and reports whether the temporal signal merits a mature refinement run.
- `validate:transition:cube` and `validate:transition:fractal` are one-time full-domain conservative outcome controls, not per-edit tests. The `:source` variants repeat them with the developer-only author-centered stencil. The fractal commands currently exit nonzero because the recorded candidates miss the fixed complexity gate; `validate:transition:summarize` verifies that retained conclusion without rerunning the expensive controls.
- `validate:coupling` runs the developer-only `D_L = 4` split-explicit versus coupled-backward-Euler CPU experiment on `17^3` and `25^3` octants at both `dt = 0.01` and `dt = 0.005` through `t = 0.2`. It enforces nonlinear residual, per-step field, boundary, and `25000 ms` setup-plus-matrix deadline gates and writes `test-results/cpu/latest-coupling-experiment.json`.
- A physics-perturbed validation run can use the same runner with `--perturbed`; perturbations are smooth deterministic changes to initial or far-field conditions, not changes to the final geometry.

Example perturbed checkpoint:

```powershell
node scripts/run-browser-gpu-test.mjs --morphology --perturbed --expected=hopper --high-resolution --grid=256 --steps=50000 --dt=0.01 --mu=0.04
```

The accepted Step 1 checkpoint and model limits are recorded in `docs/simulation-model.md` and `docs/testing-and-validation.md`. The implemented cubic model is a generic hopper baseline; it does not yet represent bismuth-specific rhombohedral facets, screw-dislocation spirals, twins, or multiple grain orientations.
