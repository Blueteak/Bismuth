# Testing and Validation

## Principles

The visualizer must not be considered correct because one run looks attractive. Solver, extraction, material, lifecycle, and performance require different evidence.

Use deterministic seeds and pinned dependencies. Keep numerical validation independent from subjective image approval.

## Command contract

Once scaffolded, maintain:

| Command                                     | Purpose                                      |
| ------------------------------------------- | -------------------------------------------- |
| `npm run dev`                               | Local Vite server                            |
| `npm test`                                  | Unit tests and CPU-reference numerical tests |
| `npm run test:gpu`                          | Browser WebGPU compute/extraction tests      |
| `npm run validate:morphology:quick`         | Calibrated Step 1 iteration screen           |
| `npm run validate:morphology:reference`     | Paired perturbed `256^3` promotion gate      |
| `npm run validate:morphology`               | Symmetric `256^3` hopper acceptance gate     |
| `npm run validate:morphology:seed:*`        | Explicit-seed `128^3` hopper checks          |
| `npm run validate:morphology:seeds:compare` | Compare the four retained seed reports       |
| `npm run validate:transition:control`       | `D_L = 4` fast temporal control              |
| `npm run validate:transition:quick`         | `D_L = 4` fast temporal candidate            |
| `npm run validate:transition:reference`     | One-time `D_L = 4` spatial reference         |
| `npm run validate:transition:compare`       | Compare transition reports and promotion     |
| `npm run validate:transition:cube`          | One-time conservative cube outcome           |
| `npm run validate:transition:fractal`       | One-time conservative fractal outcome        |
| `npm run validate:transition:*:source`      | One-time author-centered outcome A/B         |
| `npm run validate:transition:summarize`     | Verify the retained transition conclusion    |
| `npm run validate:coupling`                 | Coupled CPU integration experiment           |
| `npm run test:e2e`                          | Playwright lifecycle and screenshot tests    |
| `npm run benchmark`                         | Hardware adapter benchmarks                  |
| `npm run build`                             | Production client/server build               |
| `npm start`                                 | Express production server                    |

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
write-once threshold crossing. The complete suite passed `101` tests in `11`
files for the final recorded Step 1 run.

The 2026-07-11 source-audit follow-up added an opt-in transcription of the
authors' centered gradient/Hessian anisotropy operator. Its CPU/WebGPU maximum
absolute errors were `2.9802322e-7` for phase and `5.3644180e-7` for chemical
potential after one step, and `7.1525574e-7` and `1.5497208e-6` after three
steps. Birth time remained exact. These pass the same staged tolerances; the
conservative operator remains covered by the original checkpoints.

The same tiny-grid comparison also exercises the combined author-centered
operator and octant boundary path. The origin planes use homogeneous Neumann
symmetry for both fields, while the three high faces retain phase Neumann and
the fixed chemical reservoir. This combination is the one used by the
source-matched transition run. Its CPU/WebGPU maximum absolute errors were
`2.3841858e-7` for phase and `2.0861626e-7` for chemical potential after one
step, and `5.9604645e-7` and `7.1525574e-7` after three steps. Birth time
remained exact, and every checkpoint passed its staged tolerance.

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
perturbed refinement case. Named runs write separate convenience reports under
`test-results/gpu/`: `latest-morphology-quick.json`,
`latest-morphology-reference.json`, and
`latest-morphology-acceptance.json`. Generic exploratory runs use
`latest-morphology.json`.
The accepted result passes the current gate: bounded finite phase and birth-time
fields, a nonempty solid and surface, distributed rim-relative recession,
nonzero bounded asymmetry, at least one solid-half-extent of boundary clearance,
and no WebGPU errors.

### Validation tiers and iteration budget

Use `npm run validate:morphology:quick` for routine solver edits. It is a
deterministic regression screen with this fixed configuration:

| Parameter              | `validate:morphology:quick` |       `validate:morphology:reference` |
| ---------------------- | --------------------------: | ------------------------------------: |
| Mode                   |                   perturbed |                             perturbed |
| Expected morphology    |                      hopper |                                hopper |
| Phase operator         |           conservative flux |                     conservative flux |
| Domain                 |                        full |                                  full |
| Grid                   |                     `128^3` |                               `256^3` |
| Workgroup / precision  |       `4 x 4 x 4 / float32` |                 `4 x 4 x 4 / float32` |
| Spacing                |                         `2` |                                   `1` |
| Physical half-extent   |                       `127` |                               `127.5` |
| Time step              |                      `0.01` |                                `0.01` |
| Steps / simulated time |               `50000 / 500` |                         `50000 / 500` |
| `Rc / R0 / delta`      |               `10 / 20 / 2` |                         `10 / 20 / 2` |
| `D_L / mu_inf`         |             `1 / 12 / 0.04` |                       `1 / 12 / 0.04` |
| Fixture wall budget    |                  `25000 ms` | promotion evidence, no quick-loop cap |

Both profiles use surface-energy normalization `0.3203895937459951`, internal
seed `99539473`, seed-radius amplitude/correlation `0.3 / 8`, initial
chemical-potential amplitude/correlation `0.006 / 12`, and far-field gradient
`[0.00018, -0.0001, 0.00014]`. The named profile result records and asserts the
mode, length scale, operator, domain, physical parameters, and full
perturbation signature so the command and saved artifact cannot drift
silently.

The named `hopper-quick` profile also fails when its scale-calibrated result
leaves these deliberately narrow regression envelopes:

| Metric                     |                  Required quick-profile envelope |
| -------------------------- | -----------------------------------------------: |
| Solid extent, each axis    |                                        `98..102` |
| Solid voxel count          |                                   `91000..94500` |
| Mean / per-face recession  |                                  `6..10 / 4..12` |
| Boundary-clearance ratio   |                                       `1.4..1.6` |
| Surface voxel count        |                                   `13000..14000` |
| Bounding-box fill          |                                     `0.68..0.72` |
| Symmetry error             |                                   `0.006..0.009` |
| Connectivity               | one component, at least `0.999` largest fraction |
| Chemical-potential extrema |         minimum `-0.02..0`, maximum `1.45..1.58` |

All three fields must remain finite, the hopper expectation must pass, and the
fixture must remain within its wall budget. These envelopes are regression
alarms, not universal scientific acceptance thresholds. An intentional solver
change that crosses one requires review and paired-reference recalibration,
not a silent tolerance expansion.

The paired `hopper-reference` profile applies corresponding `256^3` envelopes:
extent `98..102`, solid voxels `733000..755000`, mean/per-face recession
`6.5..9 / 5..12`, clearance ratio `1.43..1.57`, surface voxels
`53000..56500`, fill `0.70..0.74`, symmetry `0.005..0.008`, one connected
component, and chemical-potential extrema within `-0.02..0` and `1.45..1.60`.
It is an expensive promotion regression, not part of the routine loop.

The fixed-domain pair is the scale-up calibration. At `t = 500`, quick versus
reference results were:

| Metric                   | `128^3`, `dx = 2` | `256^3`, `dx = 1` | Scale-aware difference |
| ------------------------ | ----------------: | ----------------: | ---------------------: |
| Solid extent             |             `100` |             `100` |                   `0%` |
| Solid-volume proxy       |       `92799 * 8` |          `743922` |               `-0.21%` |
| Mean face recession      |               `8` |          `7.8333` |               `+2.13%` |
| Recession range          |           `6..10` |           `6..10` |                  equal |
| Boundary-clearance ratio |            `1.48` |            `1.50` |               `-1.33%` |
| Surface proxy            |       `13466 * 4` |           `54603` |               `-1.35%` |

On the 2026-07-11 Chromium 150, Three.js r185, NVIDIA Blackwell reference
adapter, five repeated budgeted runs produced identical field and morphology
summaries. They reported `13956.3..15160.5 ms` of queue-complete solver time and
`14512.7..15871.1 ms` of fixture wall time. Fixture wall time
starts before WebGPU/session
initialization and ends after the final field readback, CPU morphology metrics,
and first completed diagnostic render. It excludes the manual delay before the
printed URL is opened and the final local report transfer. Report mode omits
display-refresh animation yields; the numerical update order is unchanged. A
matching fixture navigation request arms a separate runner-side `25000 ms`
deadline before page/module loading, and the loaded page confirms the start
before simulation. A hung load, initialization, dispatch, readback, or report
therefore cannot fall back to the general ten-minute browser-open timeout. The
manual delay before navigating to the printed URL remains outside the budget.
The measurements and pair comparison are preserved in the
[quick-profile validation record](evidence/step1-quick-profile-validation.md)
and its [machine-readable final report](evidence/step1-quick-profile-128.json).

The quick profile does not establish final morphology acceptance, convergence,
or a production resolution. Run `validate:morphology:reference` before
promoting a scientific-behavior change and run the symmetric
`validate:morphology` acceptance control at milestone gates. Recalibrate the
pair after changes to equations, discretization, boundary conditions, time
step, physical scale, or perturbation construction. The hopper correlation
must not be assumed to transfer to another transport regime.

#### Four-seed quick suite

The developer runner accepts `--seed=<uint32>` only for perturbed morphology
runs, verifies the reported seed, and writes a seed-specific result file. Four
retained `128^3`, `dx = 2`, `t = 500` seeds all passed the hopper gate:

|         Seed |   Solid extent    | Solid voxels | Surface voxels |       Fill | Fixture wall |
| -----------: | :---------------: | -----------: | -------------: | ---------: | -----------: |
|   `99539473` | `100 / 100 / 100` |      `92799` |        `13466` | `0.699573` |  `15.2521 s` |
|  `324508639` | `100 / 100 / 100` |      `93353` |        `13490` | `0.703749` |  `15.3202 s` |
|  `610839776` | `100 / 102 / 98`  |      `93310` |        `13486` | `0.703695` |  `15.2491 s` |
| `3221344269` | `98 / 102 / 102`  |      `92932` |        `13404` | `0.687367` |  `14.8510 s` |

Every run retained one connected component, mean recession `8`, finite fields,
and zero WebGPU errors. Solid count varied by `0.60%`; the physical surface
proxy varied by `0.64%`. The modes vary phase with the seed but keep fixed
wave-vector directions, so this is a bounded robustness sample rather than a
broad random distribution. See
[`step1-hopper-seed-suite-validation.md`](evidence/step1-hopper-seed-suite-validation.md).

#### `D_L = 4` fast temporal screen

The transition investigation has its own calibrated profiles; the hopper
profile must not be used as a proxy for this transport regime.

| Parameter                     |                  Control |          Quick candidate |                    Spatial reference |
| ----------------------------- | -----------------------: | -----------------------: | -----------------------------------: |
| Command suffix                |     `transition:control` |       `transition:quick` |               `transition:reference` |
| Profile                       |     `dl4-screen-control` |       `dl4-screen-quick` |               `dl4-screen-reference` |
| Mode / diagnostic expectation |     baseline / dendritic |     baseline / dendritic |                 baseline / dendritic |
| Operator / domain             | author-centered / octant | author-centered / octant |             author-centered / octant |
| Grid / spacing                |              `128^3 / 2` |              `128^3 / 2` |                          `256^3 / 1` |
| Physical high-face coordinate |                    `254` |                    `254` |                                `255` |
| Workgroup / precision         |    `4 x 4 x 4 / float32` |    `4 x 4 x 4 / float32` |                `4 x 4 x 4 / float32` |
| Time step                     |                   `0.01` |                  `0.005` |                              `0.005` |
| Steps / simulated time        |            `35000 / 350` |            `70000 / 350` |                        `70000 / 350` |
| `Rc / R0 / delta`             |            `10 / 20 / 2` |            `10 / 20 / 2` |                        `10 / 20 / 2` |
| `D_L / mu_inf`                |               `4 / 0.04` |               `4 / 0.04` |                           `4 / 0.04` |
| Fixture wall budget           |               `25000 ms` |               `25000 ms` | one-time evidence, no quick-loop cap |

All three use surface-energy normalization `0.3203895937459951`, internal seed
`99539473`, and zero seed-radius, initial-chemical-potential, and reservoir
gradient perturbations. The named profile verifies this entire signature.
Because `t = 350` is intentionally immature, the dendritic expectation is
recorded as a diagnostic but is not a profile gate. The screen instead requires
finite fields, phase in `-0.02..1.02`, exact octant structural symmetry, one
connected component with at least `0.999` of the solid, all eight diagonal
arms, and at least one solid half-extent of boundary clearance.

Each profile also has a calibrated regression envelope: extent is within
`2 dx`, recession and each reach within `dx`, solid count within `2%`, surface
count within `4%`, fill within `0.02`, surface complexity within `0.15`,
directional-reach ratio within `0.03`, clearance ratio within `0.1`, and each
chemical-potential extremum within the larger of `0.01` or `2%`. The control
and quick candidate must additionally pass the `25000 ms` wall budget. These
are same-profile regression alarms, not morphology acceptance thresholds.

The 2026-07-11 reference-machine results were:

| Metric                       |        Control | Quick candidate | Spatial reference |
| ---------------------------- | -------------: | --------------: | ----------------: |
| Solid extent                 |          `144` |           `144` |             `144` |
| Solid voxels                 |        `48604` |         `48613` |          `383523` |
| Physical volume proxy        |       `388832` |        `388904` |          `383523` |
| Face recession               |            `2` |             `2` |               `1` |
| Surface voxels               |         `3730` |          `3733` |           `15219` |
| Physical surface proxy       |        `14920` |         `14932` |           `15219` |
| Bounding-box fill            |    `0.9595483` |     `0.9597260` |       `0.9858772` |
| Surface complexity           |      `5.92119` |       `5.92496` |         `5.92872` |
| Face / edge / diagonal reach | `70 / 70 / 72` |  `70 / 70 / 72` |    `71 / 71 / 71` |
| Diagonal / face reach        |      `1.02857` |       `1.02857` |         `1.00000` |
| Boundary-clearance ratio     |      `2.52778` |       `2.52778` |         `2.54167` |

Three control and three quick runs produced identical numerical and morphology
summaries. Control solver/wall times were `8.53..8.76 s / 9.12..9.23 s`; quick
times were `17.07..17.37 s / 17.58..17.88 s`. The one-time spatial reference
took `113.49 s / 114.56 s` and is not part of the per-edit loop.

`npm run validate:transition:compare` requires the spatial pair to agree within
one physical unit of domain maximum, `4` units of extent, reach, and recession,
`5%` physical volume, `10%` physical surface, `0.03` fill, `0.3` complexity,
`0.03` directional-reach ratio, and `0.15` clearance ratio. It passed: quick
versus reference differed by `1.40%` in physical volume, `1.89%` in physical
surface, `0.0262` in fill, and no more than one unit in extent/reach/recession.

Halving the time step changed the `128^3` solid count by only `9` voxels
(`0.0185%`), surface count by `3` (`0.0804%`), fill by `+0.000178`, and
complexity by `+0.00377`; extent, recession, all three reaches, and their ratio
were unchanged. That signal is smaller than the spatial mismatch and does not
move an early descriptor toward the source dendrite, so the mature
`dt = 0.005`, `t = 1000` run is not promoted. This three-run matrix does not
prove resolution-independent temporal sensitivity; that narrower claim would
require a fourth `256^3`, `dx = 1`, `dt = 0.01` control.

The full record and machine-readable reports are preserved in
[`step1-dl4-screen-validation.md`](evidence/step1-dl4-screen-validation.md),
[`step1-dl4-screen-comparison.json`](evidence/step1-dl4-screen-comparison.json),
and the three adjacent `step1-dl4-screen-*.json` reports.

#### Coupled CPU integration experiment

`npm run validate:coupling` isolates the remaining first-order future-state
integration difference without changing the GPU solver. It holds the `D_L = 4`
author-centered octant physics, exact conserved `Delta g` source, `dx = 2`,
Float32 storage, and initial/boundary conditions fixed. Split explicit and
coupled backward-Euler methods run on both `17^3` and `25^3` domains at
`dt = 0.01` and `dt = 0.005` through `t = 0.2`.

All 120 coupled macro-steps per matrix converged in `3..5` iterations. At
`dt = 0.01`, the first chemical fixed-point defect fell from `1.00911e-4` to
`5.96046e-8`, a `1693x` reduction; at `dt = 0.005`, it fell from `2.52128e-5`
to `5.96046e-8`, a `423x` reduction. Boundary defects were zero for phase and
below `9e-10` for the Float32 reservoir. Per-step field checks remained finite
and bounded. Three complete matrices reproduced every numerical summary;
matrix times were `15793.0..15914.5 ms` and setup-plus-matrix times were
`16577.4..16722.5 ms` against the `25000 ms` deadline.

On `25^3`, split-minus-coupled subcell diagonal/face ratio differences were
`+2.56335e-6` at `dt = 0.01` and `+1.31454e-6` at `dt = 0.005`. Their `1.9500x`
scaling is consistent with a first-order method difference, and the positive
sign on both domains and time steps means backward Euler has the lower ratio:
it moves away from the source dendrite. Thresholded solid count, fill, integer
reach, connectivity, and complexity were unchanged. This does not justify a
mature GPU run or a production coupled integrator.

The experiment bounds future-state coupling under first-order backward Euler;
it does not reproduce the authors' variable-step BDF2 history, multigrid,
adaptive mesh, or double precision. Full parameters and evidence are in
[`step1-coupled-cpu-validation.md`](evidence/step1-coupled-cpu-validation.md)
and
[`step1-coupled-cpu-experiment.json`](evidence/step1-coupled-cpu-experiment.json).

Transition-suite runs now require
`--expected=cube|hopper|fractal|dendritic`. The report records bounding-box
fill, surface/volume and surface-complexity proxies, centered `<100>`, `<110>`,
and `<111>` reach, diagonal arm occupancy, connected components, and the
largest-component fraction. Hopper recession must span at least three grid
cells on at least four faces. The runner rejects invalid expected/operator
options and verifies its requested grid, step count, spacing, time step,
diffusivity, chemical potential, and surface scale against the returned
report.

The repeated `D_L = 4`, `t = 500`, `256^3`, `dx = 2` conservative checkpoint
failed the expected-dendrite gate with fill `0.9735967` and normalized
`<111>/<100>` reach `1.0229885`. The author-centered A/B also failed, with fill
`0.8804434` and reach ratio `1.0689655`. Both were connected, finite, and free
of WebGPU errors. Reports are preserved in
`evidence/step1-dl4-t500-transition-metrics.json` and
`evidence/step1-dl4-t500-author-centered.json`.

The subsequent source-matched run used the author-centered operator, a
`256^3`, `dx = 2` octant, a `10 R0` reach target, `t = 1000` hard limit, and
checkpoints every `Delta t = 50`. It stopped at the hard limit with radius
multiple `8.3`. Mirroring the domain for physical metrics gave extent
`[332, 332, 332]`; face, edge, and body-diagonal reach were `134`, `154`, and
`166`, so `<111>/<100>` was `1.238806`. The result had face recession `28`,
fill `0.7938684`, surface complexity `6.5393`, one connected component, and no
non-finite values or WebGPU errors. It therefore passes the directional signal
but fails the dendritic fill requirement `< 0.65`; it is a deeply recessed,
diagonal-dominant hopper rather than the paper's smooth eight-pronged
dendrite. The checkpoint history and complete report are preserved in
[`step1-dl4-octant-t1000.json`](evidence/step1-dl4-octant-t1000.json).

#### Completed transition outcome table

The final one-time controls complete the required record without changing any
gate after observing the results:

| Case                               | Operator        | Result |       Fill | Complexity | Diagonal/face reach | Fixture wall |
| ---------------------------------- | --------------- | ------ | ---------: | ---------: | ------------------: | -----------: |
| Cube, `D_L = 20`                   | conservative    | pass   | `0.999995` |  `5.89832` |          `0.982906` |  `207.523 s` |
| Fractal, `D_L = 1 / 2`             | conservative    | fail   | `0.953535` |  `5.88791` |           `1.03774` |  `105.527 s` |
| Cube, `D_L = 20`                   | author-centered | pass   | `0.989412` |  `5.84298` |           `1.00000` |  `171.401 s` |
| Fractal, `D_L = 1 / 2`             | author-centered | fail   | `0.600643` |  `7.34534` |           `1.47059` |   `86.772 s` |
| Dendritic, `D_L = 4` mature octant | author-centered | fail   | `0.793868` |  `6.53931` |           `1.23881` |  `167.757 s` |

The author-centered fractal passes its fill, arm, connectivity, and
directional signals but misses the predeclared complexity gate `8`. The
dendritic candidate passes the directional signal but misses the fill gate
`< 0.65`. The transition conclusion is therefore cube and hopper reproduced,
fractal and dendritic recorded but not reproduced. The summary command checks
those exact expected statuses and that every retained field is finite and free
of WebGPU errors. See
[`step1-transition-suite-validation.md`](evidence/step1-transition-suite-validation.md)
and
[`step1-transition-suite-summary.json`](evidence/step1-transition-suite-summary.json).

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

The paper's qualitative cube/hopper/fractal/dendritic parameter investigation
is complete for Step 1. Cube and hopper are validated browser outcomes.
Fractal and dendritic fail fixed gates and must remain expected/paper preset
labels rather than reproduced-outcome claims.

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
