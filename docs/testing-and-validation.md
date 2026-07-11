# Testing and Validation

## Principles

The visualizer must not be considered correct because one run looks attractive. Solver, extraction, material, lifecycle, and performance require different evidence.

Use deterministic seeds and pinned dependencies. Keep numerical validation independent from subjective image approval.

## Command contract

Once scaffolded, maintain:

| Command                       | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `npm run dev`                 | Local Vite server                            |
| `npm test`                    | Unit tests and CPU-reference numerical tests |
| `npm run test:gpu`            | Browser WebGPU compute/extraction tests      |
| `npm run validate:morphology` | Full-volume Step 1 hopper checkpoint         |
| `npm run test:e2e`            | Playwright lifecycle and screenshot tests    |
| `npm run benchmark`           | Hardware adapter benchmarks                  |
| `npm run build`               | Production client/server build               |
| `npm start`                   | Express production server                    |

Scripts must work from PowerShell on Windows and from a standard shell on Ubuntu without separate implementations.

Do not create no-op commands merely to satisfy this table. Milestone 0A requires `dev`, `test`, `test:e2e`, `lint`, `format:check`, `typecheck`, `build`, and `start` with meaningful smoke behavior. `test:gpu` and `benchmark` become required in 0B when real WebGPU fixtures exist.

## Unit and CPU-reference tests

Cover:

- Parameter validation and nondimensional configuration derivation.
- Deterministic random generation.
- Run-state transitions.
- Boundary-index mapping and stencil helpers.
- Potential/interpolation functions and analytical derivatives.
- A small, slow CPU implementation of each numerical update.
- Completion-threshold logic.
- Surface-age and oxide-thickness mapping.
- Environment preset validation.

The CPU implementation is a correctness oracle for small grids, not a production fallback.

## GPU numerical tests

The reference hardware-GPU runner uses the local Codex in-app browser on Windows. It must not launch a separate browser or enable SwiftShader or unsafe WebGPU flags. `npm run test:gpu` starts a temporary developer fixture and waits for the in-app browser to submit its report. Before running numerical assertions, the fixture records available adapter information and verifies that Three.js initialized a WebGPU backend rather than a fallback backend.

On the reference Windows machine, missing hardware WebGPU or an unexpected fallback fails `npm run test:gpu` with diagnostics. Generic CI without a GPU may omit the hardware-only command; it must still run unit tests and GPU-independent end-to-end tests using injected capability states. Edge remains a supported product browser and receives manual/production smoke coverage unless a second hardware runner is added later.

Milestone 0B uses a development-only route at `/__dev/webgpu-proof`. The runner receives the result over a local report endpoint, writes `test-results/gpu/latest.json`, and exits nonzero on capability, numerical, indirect-draw, or uncaptured-device errors. The production build tree-shakes the fixture route.

The 0B numerical proof uses two `4 x 4 x 4` `Storage3DTexture` resources, a `2 x 2 x 2` workgroup, and deterministic initialization plus A-to-B and B-to-A steps. It reads back the tiny test grid and requires a maximum absolute error no greater than `1e-6`. The indirect proof computes vertex and draw-argument storage buffers, verifies both buffers by readback, and requires non-black pixels from an offscreen indirect render.

Reference evidence recorded on 2026-07-11 through the Codex in-app browser:

- Browser user agent reported Chromium `150.0.0.0`.
- Three.js revision was `185`; backend was WebGPU with no fallback.
- Adapter information exposed vendor `nvidia` and architecture `blackwell`; device and driver strings were not exposed.
- The ping-pong comparison had maximum absolute error `0`.
- The indirect proof rendered `1032` non-black pixels and reported no uncaptured errors.
- The capability benchmark used 5 warmups and 30 measured iterations. Median synchronized times were approximately `3.0 ms` for the tiny compute step and `3.1 ms` for the indirect render. These are proof-path observations, not solver or extraction budgets.

Milestone 0C evidence recorded on 2026-07-11 through the local Codex in-app browser and production server:

- The public development and production routes reached the foundation state through the WebGPU backend.
- The supplied JPG decoded at `720 x 360` and was assigned equirectangular reflection mapping while the rendered background remained black.
- The empty scene contained one directional light, one perspective camera, no geometry, and no public action.
- The production build emitted the unchanged `61093`-byte source as a content-hashed JPG asset.
- The application shell returned `Cache-Control: no-cache`; the hashed environment returned a one-year immutable cache policy.

### Step 1 single-crystal evidence

The Step 1 numerical fixture uses a `9 x 9 x 9` grid, `r32float` fields, and a
`4 x 4 x 4` workgroup. It compares complete CPU and GPU phase, chemical
potential, and solidification-time fields at initialization, after one step,
and after three steps. Reference hardware results from Chromium `150.0.0.0`,
Three.js r185, and the NVIDIA Blackwell adapter were:

| Step | Maximum phase absolute error | Maximum `mu` absolute error | Maximum birth-time absolute error |
| ---: | ---------------------------: | --------------------------: | --------------------------------: |
|  `0` |               `5.9604645e-8` |              `1.0430813e-7` |                               `0` |
|  `1` |               `1.1920929e-7` |              `1.5646219e-7` |                               `0` |
|  `3` |               `1.1920929e-7` |              `1.7136335e-7` |                               `0` |

All checkpoints passed their staged absolute/relative tolerances of `1e-6`,
`1e-5`, and `1e-4`. The current unit suite also covers the analytical
functions, anisotropy derivative, explicit stability rejection, boundary
conditions, exact `Delta g` source, deterministic perturbations, metrics, and
write-once threshold crossing. The complete suite passed `43` tests in `9`
files for the recorded Step 1 run.

The developer-only `/__dev/single-crystal` fixture performs a full field
readback only at its fixed diagnostic checkpoint. It renders orthogonal slices
and a voxel-surface preview, then reports field summaries, solid bounds,
symmetry, six face-center recession depths, boundary clearance, solver timing,
and uncaptured WebGPU errors. This readback and voxel preview are not permitted
in the production frame loop.

The unperturbed fixed-domain refinement study used the published hopper
parameters, `dt = 0.01`, and `t = 500`:

| Grid    | `dx` | Physical half-extent | Maximum solid extent | Face-center recession |
| ------- | ---: | -------------------: | -------------------: | --------------------: |
| `128^3` |  `2` |                `127` |                 `94` |                   `6` |
| `256^3` |  `1` |              `127.5` |                 `93` |                   `7` |

The extent changed by one physical unit and both grids retained a resolved
face-center recess. This is sufficient evidence that the accepted hopper is
not unique to one grid spacing. It does not select the eventual production
grid or replace a broader convergence study.

The accepted physics-perturbed checkpoint used `256^3`, `dx = 1`, `dt = 0.01`,
`t = 500`, internal seed `99539473`, seed-radius amplitude/correlation
`0.3 / 8`, initial chemical-potential amplitude/correlation `0.006 / 12`, and
far-field gradient `[0.00018, -0.0001, 0.00014]`. It reported:

- Solid extent `[100, 100, 100]` and `743922` solid voxels.
- Mean robust rim-relative recession `7.8333333`, minimum `6`, and maximum `10`.
- Symmetry error `0.0064696274`.
- Boundary clearance `75`, or `1.5` times the solid half-extent.
- `54603` diagnostic surface voxels.
- `0` non-finite field values and `0` uncaptured WebGPU errors.
- Chemical-potential range `[-0.0135500, 1.5332261]`.
- `100215.9 ms` queue-complete fixture wall time for `50000` explicit steps.

The durable [Step 1 validation record](evidence/step1-validation.md) contains the
reference metrics. The accepted `256^3` result has a durable
[diagnostic image](evidence/step1-physics-perturbed-hopper-256.png) and
[machine-readable report](evidence/step1-perturbed-reference-256.json). The
`128^3`, `dx = 2`
[preview image](evidence/step1-physics-perturbed-hopper-128.png) and
[preview report](evidence/step1-perturbed-preview-128.json) preserve the
perturbed refinement case. The convenience path
`test-results/gpu/latest-morphology.json` is overwritten by each morphology run.
The accepted result passes the current gate: bounded finite phase and birth-time
fields, a nonempty solid and surface, distributed rim-relative recession,
nonzero bounded asymmetry, at least one solid-half-extent of boundary clearance,
and no WebGPU errors.

The morphology reproduces the faceted single-crystal hopper class modeled by
the source paper. The smooth initial and reservoir perturbations produce
measurable asymmetry without post-processing the shape. This is not sufficient
evidence to call the result generally representative of real bismuth crystal
formation: the cubic scalar model cannot produce screw-dislocation spirals,
twins, or differently oriented intergrowths, and it omits bismuth-specific
facet kinetics, free-surface transport, convection, and finite melt effects.

Run the same tiny fields through CPU and TSL/WebGPU kernels, then compare with explicit absolute/relative tolerances.

Required cases:

- Uniform fields that should remain invariant.
- Symmetric centered seed.
- Boundary-adjacent samples.
- One phase update.
- One chemical-potential update using the correct phase rate/state.
- Multiple ping-pong steps.
- Non-finite and overflow diagnostics.
- Repeatability with a fixed seed.

Record browser, Three.js revision, adapter, driver, grid dimensions, workgroup size, and precision in failure artifacts.

## Surface-extraction tests

Use analytic scalar fields rather than only simulation output:

- Empty and full domains.
- Axis-aligned plane.
- Sphere.
- Faceted cube-like field.
- Saddle/ambiguous configurations relevant to marching cubes.
- Shapes touching or approaching domain boundaries.

Assert bounds, triangle capacity, winding, finite vertices, normal direction, indirect draw count, and deterministic output summaries. Include an explicit overflow fixture.

## Morphology validation

For fixed solver configurations, track:

- Solid volume and growth curve.
- Bounding extent per axis.
- Symmetry error for the baseline seed.
- Face-center advancement relative to edges and corners.
- Hopper depression depth.
- Surface area or a stable proxy.
- Terrace/facet descriptors where robustly measurable.

Validate the paper's qualitative cube/hopper/fractal/dendritic parameter
transitions before art tuning. The named configurations are encoded, but as of
2026-07-11 only the hopper has completed full-domain morphology and refinement
validation. Do not report the other transition labels as reproduced yet.

Run the published symmetric control separately from perturbation studies. The
control tests stencil symmetry and the paper baseline. Perturbation runs may
use only documented, deterministic changes to initial or boundary conditions:
smooth seed-radius heterogeneity, smooth initial liquid chemical-potential
heterogeneity, and a macroscopic far-field gradient. Never add final-geometry
warping, decorative spirals, or uncorrelated per-step noise to satisfy a visual
reference.

For the cluster phase, compare distributions across a fixed seed suite rather than selecting only favorable outputs.

## Visual regression tests

Use Playwright with fixed viewport, device scale, camera, HDRI, seed, simulation checkpoint, browser revision, and Windows reference machine.

Capture at least:

- Loading state.
- Early growth.
- Recognizable hopper stage.
- Final single crystal.
- Stopped state with `Regenerate`.
- Unsupported WebGPU state through capability injection/mocking where feasible.
- Representative oxide ages and camera angles.

GPU screenshots are environment-sensitive. Review and update baselines only on the documented reference configuration; do not use loose thresholds to conceal real changes.

## End-to-end lifecycle tests

- Page load automatically starts the first generation.
- Active primary action is `Stop`.
- Stop prevents further simulation advancement and changes the action to `Regenerate`.
- A stopped run remains orbitable and renderable.
- Regenerate resets run state and begins a distinct internally seeded run.
- Automatic completion enters the same stopped state.
- Resize preserves a valid canvas and camera projection.
- Repeated runs dispose/reset resources without increasing active GPU allocations or listeners.
- Device loss and initialization failure show an honest error state.

## Performance benchmarks

Separate timings for:

- Phase update.
- Chemical-potential update.
- Completion/morphology reductions.
- Marching-cubes classification.
- Prefix sum.
- Vertex emission.
- Shadow and main rendering.
- End-to-end visible generation duration.

Benchmark candidate grids, initially including `128^3`, `192^3`, and `256^3` when memory permits. Report memory estimates and actual adapter limits.

The 25-60 second duration is a target, not a pass/fail threshold, until the single-crystal solver is validated and measured. Do not optimize by changing scientific behavior without separate validation.

## Manual reference review

Maintain a curated, licensed set of lab-grown bismuth specimen photographs with source metadata. Review generated runs for:

- Overall silhouette and composition.
- Hopper depth and terraces.
- Dominant versus secondary grains.
- Orientation and intergrowth plausibility.
- Metallic response and oxidation color distribution.
- Repetition, symmetry, or noise that appears algorithmic.

Document observations and chosen calibration ranges; do not copy source images into the repository without confirmed usage rights.
