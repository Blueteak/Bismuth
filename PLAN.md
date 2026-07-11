# Bismuth Visualizer Implementation Plan

## Objective

Create a polished WebGPU visualizer that shows a newly generated bismuth hopper specimen growing live, then leaves the stopped result available for inspection. Establish numerical credibility with the published single-crystal model before extending it to a reference-driven, multi-nucleation hero cluster.

The existing repository history and previous implementations are out of scope. This plan starts from the documented design only.

## Current status and next task

Milestones 0A, 0B, and 0C are complete as of 2026-07-11. The foundation stops here for review. Milestone 1, the published single-crystal solver, is the next planned task and must not begin without explicit user direction.

## Milestone sequence

### 0A. Project scaffolding

Status: **Complete** (2026-07-11).

Create the project structure, toolchain, non-GPU shell, and production-server skeleton.

- Follow the exact scope and delegated choices in `docs/scaffolding.md`.
- Select and pin latest stable, non-prerelease toolchain versions except Three.js, which is fixed at `0.185.0` (r185).
- Scaffold React, strict TypeScript, Vite, Vitest, Playwright, lint/format tooling, and Express.
- Establish typed module boundaries and an imperative visualizer-controller stub outside React reconciliation.
- Implement loading and unsupported shell states using injected or mocked capability state.
- Add meaningful non-GPU scripts and smoke tests; do not create no-op GPU or benchmark scripts.
- Verify that user-provided repository-root `hdri.jpg` exists, but do not integrate or modify it yet.

Exit criteria:

- All milestone 0A exit criteria in `docs/scaffolding.md` pass on Windows.
- No WebGPU compute, proof geometry, fake growth, solver, or production run lifecycle is implemented.
- Stop for user review before 0B.

### 0B. WebGPU capability proof

Status: **Complete** (2026-07-11).

Prove the selected Three.js r185 compute and indirect-draw path in developer-only fixtures.

- Require `navigator.gpu` and a successfully created adapter/device before renderer initialization.
- Initialize `WebGPURenderer` and fail clearly if the active backend is not WebGPU; do not accept an automatic WebGL fallback.
- Prove TSL compute with ping-pong `Storage3DTexture` resources and a tiny readback comparison.
- Prove storage-buffer-driven indirect geometry with a trivial compute-generated mesh.
- Keep proof geometry on a developer-only fixture route or harness; never present it as a crystal.
- Add real `npm run test:gpu` and `npm run benchmark` commands.
- Use the local Codex in-app browser for the reference Windows hardware-GPU test. Do not launch a separate browser or force SwiftShader or unsafe WebGPU flags.
- Fail `test:gpu` with adapter diagnostics when the reference hardware test cannot create the required WebGPU backend. Generic CI may omit this hardware-only command.

Exit criteria:

- Runtime capability checks distinguish supported WebGPU from unsupported or fallback rendering.
- Deterministic ping-pong compute and indirect draw tests pass on the reference Windows GPU.
- The GPU test reports browser, Three.js revision, adapter information, driver information when exposed, and workgroup/resource configuration.

### 0C. Environment and end-to-end shell proof

Status: **Complete** (2026-07-11).

Integrate the provided environment and finish the foundation shell without faking crystal behavior.

- Integrate repository-root `hdri.jpg` into the build without renaming, replacing, or downloading another environment.
- Use it for environment reflections while rendering a black background.
- Confirm a directional light, camera, and empty scene render through the WebGPU backend.
- Complete the minimal Express production-serving smoke test and asset caching shape.
- Keep the public shell in loading/unsupported/foundation states; automatic crystal start and Stop/Regenerate arrive only with the real solver lifecycle.

Exit criteria:

- The environment, empty WebGPU scene, black background, and production server pass browser smoke tests.
- No proof mesh or fake growth appears in the public shell.
- Stop for user review before the scientific solver.

### 1. Published single-crystal solver

Reproduce the reference hopper model without production material work.

- Transcribe and cite the phase and chemical-potential equations, anisotropy, constants, initial conditions, and boundary conditions.
- Implement a small CPU reference kernel for deterministic numerical comparison.
- Implement GPU ping-pong updates for phase and chemical potential.
- Start with a centered spherical seed and the published single-orientation anisotropy.
- Record first solidification time in a separate rendering-input field when phase first crosses the documented threshold; this field must not feed back into solver physics.
- Add developer-only slice views, field summaries, NaN detection, symmetry metrics, and adapter timing.
- Compare representative parameter sets and morphology against the paper, including the reported cube/hopper/dendritic transitions.
- Add grid-refinement checks before selecting a working interactive resolution.

Exit criteria:

- Small-grid CPU and GPU steps agree within documented tolerances.
- Fixed-seed runs remain finite, deterministic, and stable.
- Solidification-time capture is deterministic and write-once for each cell.
- A 3D run produces a recognizable single hopper with face-center depression and terracing.
- Resolution changes have documented convergence behavior rather than unexplained visual drift.

### 2. Live GPU surface extraction

Turn the phase field into a renderable surface without production readback.

- Implement marching-cubes cell classification at `phase = 0.5`.
- Compact active cells and triangle counts through GPU prefix sums.
- Emit positions, phase-gradient normals, surface-age attributes, and indirect draw arguments.
- Enforce capacity and overflow reporting; retain the last valid mesh on failure.
- Validate extraction on analytic planes, spheres, and faceted scalar fields.
- Measure extraction cadence independently from render cadence.
- Evaluate facet and terrace quality; use dual contouring only if marching cubes fails the documented visual gate.

Exit criteria:

- The live mesh tracks the simulation without full-field CPU readback.
- Analytic-field topology, bounds, winding, normals, and overflow tests pass.
- Extracted hopper geometry preserves recognizable facets and terraces at an acceptable cadence.

### 3. Bismuth material and presentation

Add the intended final appearance while retaining deterministic visual tests.

- Interpolate surface age onto extracted vertices.
- Map surface age through a documented, monotonic oxide-thickness curve with bounded spatial variation.
- Drive Three.js physical-node iridescence from oxide thickness over a metallic bismuth substrate.
- Tune roughness, base reflectance, anti-aliasing, tone mapping, and exposure against lab-grown specimen references.
- Use the HDRI only for lighting/reflections; keep the background black.
- Add one directional light aligned with the chosen environment for self-shadowing.
- Implement the fixed camera distance, fixed target, orbit/zoom input, and gentle auto-orbit that stops after interaction.

Exit criteria:

- Newly grown regions and older regions exhibit coherent age-based color variation.
- The crystal reads as reflective metal rather than painted rainbow geometry.
- Fixed-seed, fixed-camera screenshots are stable on the reference Windows test machine.

### 4. Public run lifecycle

Implement the agreed minimal experience.

- Begin the first run automatically after WebGPU, pipelines, and HDRI are ready.
- Show a minimal loading state before readiness.
- Place the primary action at bottom center.
- Show `Stop` during growth and `Regenerate` in stopped/completed states.
- Manual stop prevents additional solver steps, performs one final extraction of the latest valid field, then freezes the mesh; there is no resume path.
- Regenerate disposes or resets run-scoped GPU state and begins a new internally seeded run.
- Automatically stop when configured growth bounds reach a calibrated fraction of the domain, with a hard simulated-time guard.
- Fade controls while inactive and restore them on pointer or keyboard activity.
- Keep developer diagnostics separate from the public interface.

Exit criteria:

- Page load, automatic start, manual stop, automatic completion, regeneration, camera interaction, resize, and device-loss handling pass browser tests.
- Repeated regeneration does not leak GPU resources or degrade timing.

### 5. Reference-driven hero cluster

Extend only after the single-crystal baseline is trustworthy.

- Curate a licensed visual reference set of lab-grown bismuth hopper specimens.
- Record visible morphology traits: dominant grains, secondary orientations, scale distribution, terracing, hollows, intergrowth, and asymmetry.
- Research and document a multiphase or orientation-field extension with a shared transport field.
- Add one dominant nucleus and a small, bounded population of secondary nuclei with controlled positions, orientations, and nucleation times.
- Preserve deterministic run seeds while keeping them hidden from the public UI.
- Compare cluster metrics and expert visual review against the reference set.
- Permit both single-dominant and clustered outcomes if the reference set supports both.

Exit criteria:

- Differently oriented grains compete and intergrow through the simulation rather than overlap cosmetically.
- Results commonly resemble the selected lab-grown reference class.
- Added grain state fits established GPU memory and frame budgets.

### 6. Performance and resolution selection

Resolve the intentionally deferred fidelity-versus-duration decision using evidence.

- Benchmark solver steps, extraction, rendering, memory use, and end-to-end duration at candidate grid sizes such as `128^3`, `192^3`, and `256^3`.
- Run the benchmark on the RTX 5080 reference machine and record adapter/driver/browser details.
- Select a default only after morphology and convergence comparisons.
- Measure the target 25-60 second growth window without treating it as guaranteed until data exists.
- If the target is missed, present measured alternatives before changing equations, resolution, or experience duration.

Exit criteria:

- A documented default configuration has numerical, visual, memory, and timing evidence.
- Performance regressions have automated thresholds or clearly reported benchmark deltas.

### 7. Production deployment

- Build the static Vite client and a minimal Express production server.
- Serve hashed assets and HDRI files with long-lived caching; keep the application shell revalidatable.
- Add a health endpoint, production error handling, structured startup logs, and graceful shutdown.
- Run Node under `systemd` on Ubuntu EC2.
- Terminate HTTPS in front of Express; remote WebGPU must never depend on insecure HTTP.
- Validate the deployed adapter path, caching, SPA fallback, and unsupported-browser experience.

Exit criteria:

- A clean Ubuntu EC2 instance can build or receive, start, health-check, and restart the application.
- The public HTTPS origin initializes WebGPU and completes the browser smoke test.

## Cross-cutting quality gates

- No production full-volume or full-mesh CPU readback.
- No silent WebGPU fallback.
- No public feature additions outside `docs/product-spec.md` without a recorded decision.
- No multi-grain implementation before the single-crystal acceptance gate.
- No public resolution selector until convergence and performance are understood.
- No visual approval based solely on one attractive random run; use fixed seeds, metrics, and a reference set.

## Explicitly deferred decisions

- Default grid size and time-step budget.
- Response if the full solver misses the 25-60 second target.
- Exact oxide-age curve and calibrated thickness range.
- Public morphology controls.
- HDRI selector and additional environment presets.
- Final number and distribution of secondary nuclei.
- EC2 HTTPS termination choice and deployment automation mechanism.
