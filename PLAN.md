# Bismuth Visualizer Implementation Plan

## Objective

Create a polished WebGPU visualizer that shows a newly generated bismuth hopper specimen growing live, then leaves the stopped result available for inspection. Establish numerical credibility with the published single-crystal model before extending it to a reference-driven, multi-nucleation hero cluster.

Watching every stage of growth is a primary product feature, not a loading
transition. While a run is active, the render mesh must be promoted
continuously: target at least `30` mesh updates per second on the reference
machine and treat less than `15` per second as a blocking regression. Every
later milestone must preserve this behavior and validate end-to-end mesh
promotion cadence, not only render-frame rate or extraction-kernel latency.

The existing repository history and previous implementations are out of scope. This plan starts from the documented design only.

## Current status and next task

Milestones 0A, 0B, 0C, 1, and 2 are complete as of 2026-07-12. Milestone 1 closes around its scoped single-hopper objective: CPU/WebGPU agreement, deterministic finite fields, write-once birth time, resolved hopper recession, physical-domain refinement, a four-seed fast suite, and the complete recorded transition investigation. The browser reproduces the cube and hopper gates but not the paper's fractal and dendritic outcomes. The remaining adaptive-mesh, BDF2, multigrid, and Float64 differences are explicit fidelity limits, not hidden successes. Milestone 2 now closes with analytic topology and overflow gates, repeated live `128^3` tracking, controller-owned extraction from both solver texture parities into one last-valid mesh, continuous end-to-end mesh promotion, resize and disposal coverage, and a passing facet/terrace visual review. The corrected full run promoted `1021` meshes at `55.193 /s` average with a `31.7 ms` 95th-percentile interval. The earlier ten-checkpoint proof was insufficient and should have blocked closure; it confused render frames and kernel timing with visible mesh-update cadence. The next implementation task is Milestone 3 surface-age-driven bismuth material and presentation, which must preserve the `30 /s` target and `15 /s` blocking floor.

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

Status: **Complete** (2026-07-11) for the scoped single-hopper milestone. The complete published transition series was tested but only partially reproduced, as recorded below.

Reproduce the reference hopper model without production material work.

- Transcribe and cite the phase and chemical-potential equations, anisotropy, constants, initial conditions, and boundary conditions.
- Implement a small CPU reference kernel for deterministic numerical comparison.
- Implement GPU ping-pong updates for phase and chemical potential.
- Start with a centered spherical seed and the published single-orientation anisotropy.
- Record first solidification time in a separate rendering-input field when phase first crosses the documented threshold; this field must not feed back into solver physics.
- Add developer-only slice views, field summaries, NaN detection, symmetry metrics, and queue-complete wall timing. True timestamp-query adapter timing remains part of the benchmark milestone.
- Encode and run the reported cube, hopper, fractal, and dendritic parameter sets. Cube and hopper are validated browser outcomes; fractal and dendritic remain paper-labeled expected classes with recorded failed gates.
- Add grid-refinement checks before selecting a working interactive resolution.

Exit criteria:

- Small-grid CPU and GPU steps agree within documented tolerances.
- Fixed-seed runs remain finite, deterministic, and stable.
- Solidification-time capture is deterministic and write-once for each cell.
- A 3D run produces a recognizable single hopper with face-center depression and terracing.
- Resolution changes have documented convergence behavior rather than unexplained visual drift.

Recorded Step 1 evidence:

- A `9^3` `r32float` CPU/WebGPU comparison passed at initialization, one step, and three steps. Maximum observed absolute errors were `1.1920929e-7` for phase, `1.7136335e-7` for chemical potential, and `0` for solidification time.
- At `t = 500`, the unperturbed physical-domain comparison measured maximum extent/robust rim-relative recession `94 / 6` on `128^3` at `dx = 2` and `93 / 7` on `256^3` at `dx = 1`.
- The deterministic perturbed `128^3`, `dx = 2` iteration profile reproduced the paired `256^3`, `dx = 1` extent exactly and matched scale-adjusted volume within `0.21%`; five repeated runs produced identical numerical summaries and completed the budgeted browser fixture in `14512.7..15871.1 ms` against a hard `25000 ms` deadline.
- The separate `D_L = 4`, `t = 350` screen completed its `128^3` temporal control and candidate in `9.12..9.23 s` and `17.58..17.88 s` fixture time. The candidate matched its one-time `256^3` spatial reference within `1.40%` physical volume and `1.89%` physical surface, while halving `dt` changed no directional reach and only `0.0185%` of the solid count; mature refinement was not promoted.
- The CPU-only coupled backward-Euler experiment reduced the first chemical fixed-point defect by `1693x`, converged every step in `3..5` iterations, and completed split/coupled pairs at two time steps and two domains in `16.58..16.72 s` setup-plus-matrix time. The directional difference shrank by `1.9500x` when `dt` was halved but retained its away-from-dendrite sign, so neither a production coupled integrator nor a mature GPU run was promoted.
- Uniform interface refinement in the matched `D_L = 4`, `t = 350` spatial pair changed the diagonal/face reach ratio from `1.02857` at `dx = 2` to `1.00000` at `dx = 1`, away from the missing dendrite. This bounds the tested uniform-grid effect without motivating adaptive GPU infrastructure.
- Four deterministic perturbed hopper seeds all passed at `128^3`, retained one connected component and mean recession `8`, produced four distinct summaries, and completed in `14.851..15.320 s` against the `25000 ms` deadline. Solid count varied by `0.60%` and the physical surface proxy by `0.64%`.
- The conservative full-domain transition controls accepted the cube (`fill = 0.999995`) and rejected the fractal (`fill = 0.953535`, complexity `5.88791`). The author-centered A/B accepted the cube and moved the fractal strongly toward the source (`fill = 0.600643`, complexity `7.34534`, diagonal/face reach `1.47059`) but still missed the fixed complexity gate `8`. The mature author-centered dendrite remained a deeply recessed hopper and failed its fill gate.
- The accepted deterministic perturbed `256^3` checkpoint measured extent `100`, mean robust face recession `7.833` (minimum `6`, maximum `10`), symmetry error `0.0064696`, and boundary-clearance ratio `1.5`, with no non-finite values or WebGPU errors.
- The scalar cubic model is a generic hopper baseline, not a calibrated bismuth model. Screw-growth spirals, twins, and differently oriented intergrowths remain out of scope until defect/orientation physics is added.

Milestone 1 closure boundary:

- All literal exit criteria and implementation-list evidence are complete. See `docs/evidence/step1-transition-suite-validation.md` and `docs/evidence/step1-hopper-seed-suite-validation.md`.
- The full paper transition series is not reproduced. Do not call fractal or dendritic validated browser outcomes, and do not tune their gates after the fact.
- Adaptive mesh, implicit variable-step BDF2, multigrid, and Float64 storage remain unimplemented source differences. Reopening them is a separate fidelity investigation, not a prerequisite for Milestone 2.

### 2. Live GPU surface extraction

Turn the phase field into a renderable surface without production readback.

- Implement marching-cubes cell classification at `phase = 0.5`.
- Compact active cells and triangle counts through GPU prefix sums.
- Emit positions, phase-gradient normals, surface-age attributes, and indirect draw arguments.
- Enforce capacity and overflow reporting; retain the last valid mesh on failure.
- Validate extraction on analytic planes, spheres, and faceted scalar fields.
- Measure extraction cadence independently from render cadence.
- Evaluate facet and terrace quality; use dual contouring only if marching cubes fails the documented visual gate.

Recorded Milestone 2 evidence:

- The initial `4^3` analytic-plane WebGPU proof classified all `3^3` cells exactly. Each x-row produced cases `[255, 153, 0]`, the nine intersected cells matched the CPU reference, and the device reported no uncaptured errors.
- The expanded `8^3` analytic-plane proof exercised `343` cells across three `128`-value scan blocks and two hierarchy levels. All case indices, active flags, triangle counts, active offsets, triangle offsets, and compacted active-cell indices matched the CPU reference. It produced `49` active cells and `98` triangles with no uncaptured WebGPU errors.
- The same plane emitted `294` bounded vertices at `x = 3.5` with y/z bounds `0..7`, zero position mismatches at tolerance `1e-6`, and zero outward-winding mismatches across all `98` triangles. A `291`-vertex capacity reported summary `[294, 291, 1, 98]` without an out-of-bounds write or WebGPU error.
- The plane also produced zero phase-gradient-normal and surface-age mismatches: every normal was `[1, 0, 0]`, and a solid birth time `2` opposite a liquid sentinel at simulated time `10` yielded interpolated age `4`. Complete promotion wrote indirect arguments `[294, 1, 0, 0]`; the subsequent overflow candidate left those arguments and all promoted positions unchanged.
- CPU references for a sphere and max-norm faceted cube produced one connected closed surface, exactly two uses of every mesh edge, outward winding on every triangle, and the expected smooth/symmetric or exact faceted bounds.
- The live solver fixture extracted a `128^3`, `t = 500` perturbed hopper directly from current GPU textures into `32068` triangles and `96204` promoted vertices with no overflow or WebGPU errors. Its durable screenshot preserves a recognizable recessed and terraced hopper; `535.8 ms` is the cold compile-plus-extraction checkpoint, not the pending steady-state cadence result.
- The repeated fixture promoted and rendered distinct meshes at `t = 100`, `200`, `300`, `400`, and `500`, growing from `23808` to `96204` vertices without overflow. Each developer checkpoint remains visible for `500 ms`; this dwell is excluded from extraction timing. After excluding the first sample, warm queue-complete extraction measured `1.2..3.9 ms` with a `2.55 ms` median; this is extraction-only fixture timing, not render cadence or an end-to-end frame budget.
- The corrected imperative controller completed `50000` steps using 49-step presentation batches and promoted a new shared last-valid mesh after every batch. It produced `1021` promotions at `55.193 /s` average, `17.0 ms` median, `31.7 ms` 95th-percentile, and `39.0 ms` maximum interval. Parity update counts were `511 / 510`, the renderer submitted `1115` frames, and no browser or WebGPU errors occurred.
- The earlier ten-checkpoint controller proof did not satisfy continuous growth. Render-frame count, five-checkpoint display dwell, and `2.55 ms` extraction-kernel timing were incorrectly treated as adequate evidence even though most frames reused a stale mesh. The end-to-end numeric cadence gate was added before closure.
- The retained live views pass the facet-quality gate: broad facets remain flat, major edges continuous, hopper recesses readable, and nested terraces visible without grid-pattern noise. Marching cubes remains the selected extractor; dual contouring is not justified by this gate.
- Unit coverage fixes the standard corner and edge orders, the solid-side convention `phase <= 0.5`, threshold inclusion, canonical triangle counts, outward winding, physical interpolation, sentinel-aware surface age, cell-count derivation, uint32 scan validation, stable compaction, triangle-aligned capacity, indirect promotion, last-valid retention, and malformed-input rejection.

Exit criteria:

- The live mesh tracks the simulation without full-field CPU readback, targets
  at least `30` promotions per second on the reference machine, and never
  falls below the blocking `15 /s` average or a `66.67 ms` 95th-percentile
  interval.
- Analytic-field topology, bounds, winding, normals, and overflow tests pass.
- Extracted hopper geometry preserves recognizable facets and terraces while
  passing the numeric continuous-growth cadence gate.

Milestone 2 is complete. See
`docs/evidence/milestone2-controller-integration.md` and its adjacent JSON
summary for the final controller and visual-gate record.

### 3. Bismuth material and presentation

Add the intended final appearance while retaining deterministic visual tests.

- Interpolate surface age onto extracted vertices.
- Map surface age through a documented, monotonic oxide-thickness curve with bounded spatial variation.
- Drive Three.js physical-node iridescence from oxide thickness over a metallic bismuth substrate.
- Tune roughness, base reflectance, anti-aliasing, tone mapping, and exposure against lab-grown specimen references.
- Use the HDRI only for lighting/reflections; keep the background black.
- Add one directional light aligned with the chosen environment for self-shadowing.
- Implement the fixed camera distance, fixed target, orbit/zoom input, and gentle auto-orbit that stops after interaction.
- Preserve continuous mesh promotion while material and camera work is active;
  material compilation or shading must not reduce cadence below `15 /s`.

Recorded initial Milestone 3 evidence:

- The promoted `normalAge.w` attribute drives a Three.js r185 physical node
  material through a literal monotonic `40..600 nm` oxide curve and
  research-bounded provisional film IOR `2.1`.
- Storage-backed rendering paths now transform object-space extracted normals
  into the view-space basis required by `normalNode`. This corrected the
  shading basis but did not remove the moving age-following border.
- Liquid birth-time sentinels resolve to current simulated time before
  isosurface edge interpolation. This preserves continuous surface-age
  interpolation rather than assigning the captured solid voxel's full age to
  the crossing; rendering-normal widening experiments were reverted.
- The hardware analytic-plane regression emitted age `4.0000019073` at all
  `294` vertices against expected age `4`, within a dedicated `4e-6` float32
  interpolation tolerance.
- The final fixed-camera `1280 x 720` run removed the moving hard age boundary
  and promoted `1021` meshes at `53.692 /s` with a `31.9 ms`
  95th-percentile interval, both texture parities active, and no WebGPU errors.

Exit criteria:

- Newly grown regions and older regions exhibit coherent age-based color variation.
- The crystal reads as reflective metal rather than painted rainbow geometry.
- Fixed-seed, fixed-camera screenshots are stable on the reference Windows test machine.
- The material-enabled growth run retains the continuous-update cadence gate.

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
- Keep the growing mesh visibly continuous through automatic start, Stop, and
  Regenerate; UI state changes must not introduce sparse growth checkpoints.

Exit criteria:

- Page load, automatic start, manual stop, automatic completion, regeneration, camera interaction, resize, and device-loss handling pass browser tests.
- Repeated regeneration does not leak GPU resources or degrade timing.
- Active runs pass the `15 /s` mesh-promotion floor before and after repeated
  regeneration.

### 5. Reference-driven hero cluster

Extend only after the single-crystal baseline is trustworthy.

- Curate a licensed visual reference set of lab-grown bismuth hopper specimens.
- Record visible morphology traits: dominant grains, secondary orientations, scale distribution, terracing, hollows, intergrowth, and asymmetry.
- Research and document a multiphase or orientation-field extension with a shared transport field.
- Add one dominant nucleus and a small, bounded population of secondary nuclei with controlled positions, orientations, and nucleation times.
- Preserve deterministic run seeds while keeping them hidden from the public UI.
- Compare cluster metrics and expert visual review against the reference set.
- Permit both single-dominant and clustered outcomes if the reference set supports both.
- Preserve continuous visible nucleation, competition, and intergrowth rather
  than revealing cluster changes at sparse checkpoints.

Exit criteria:

- Differently oriented grains compete and intergrow through the simulation rather than overlap cosmetically.
- Results commonly resemble the selected lab-grown reference class.
- Added grain state fits established GPU memory and frame budgets.
- Cluster growth retains the continuous mesh-promotion floor.

### 6. Performance and resolution selection

Resolve the intentionally deferred fidelity-versus-duration decision using evidence.

- Benchmark solver steps, extraction, rendering, memory use, and end-to-end duration at candidate grid sizes such as `128^3`, `192^3`, and `256^3`.
- Run the benchmark on the RTX 5080 reference machine and record adapter/driver/browser details.
- Select a default only after morphology and convergence comparisons.
- Measure the target 25-60 second growth window without treating it as guaranteed until data exists.
- Measure end-to-end mesh-promotion cadence under the final solver, material,
  camera, shadow, and post-processing load.
- If the target is missed, present measured alternatives before changing equations, resolution, or experience duration.

Exit criteria:

- A documented default configuration has numerical, visual, memory, and timing evidence.
- Performance regressions have automated thresholds or clearly reported benchmark deltas.
- The selected default targets `30 /s` and never falls below the `15 /s`
  continuous-growth floor on the reference machine.

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
- The deployed production path preserves continuous growth and reports the
  same end-to-end cadence gate as local reference validation.

## Cross-cutting quality gates

- No production full-volume or full-mesh CPU readback.
- No silent WebGPU fallback.
- No public feature additions outside `docs/product-spec.md` without a recorded decision.
- No multi-grain implementation before the single-crystal acceptance gate.
- No public resolution selector until convergence and performance are understood.
- No visual approval based solely on one attractive random run; use fixed seeds, metrics, and a reference set.
- No milestone may replace continuous visible growth with sparse checkpoints,
  precomputed reveals, or a high render-frame count over a stale mesh.

## Explicitly deferred decisions

- Default grid size and time-step budget.
- Response if the full solver misses the 25-60 second target.
- Exact oxide-age curve and calibrated thickness range.
- Public morphology controls.
- HDRI selector and additional environment presets.
- Final number and distribution of secondary nuclei.
- EC2 HTTPS termination choice and deployment automation mechanism.
