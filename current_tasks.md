# Current Tasks

Updated 2026-07-12. Milestone 1 is complete. Milestone 2 live GPU surface
extraction is in progress.

Do not inspect deleted branches, caches, or repository history. Work from the
current tree, the primary sources in `docs/`, and the durable local evidence in
`docs/evidence/`.

## Current status

Milestones 0A, 0B, 0C, and 1 are complete.

The Step 1 single-crystal implementation now includes:

- Full 3D CPU and Three.js r185 TSL/WebGPU phase-field solvers for phase,
  chemical potential, and write-once solidification time.
- Conservative fluxes, an opt-in source-matched author-centered operator,
  explicit stability rejection, deterministic perturbations, full and octant
  boundaries, maturity checkpoints, and transition-specific metrics.
- Tiny-grid CPU/WebGPU parity for conservative, author-centered, and
  author-centered-octant paths.
- A resolved, fixed-domain grid-refined hopper and an accepted perturbed
  `256^3` checkpoint.
- Calibrated `128^3` hopper and `D_L = 4` regression loops under a hard
  `25000 ms` fixture deadline.
- A four-seed hopper suite, uniform-resolution and time-step screens, a
  coupled backward-Euler CPU experiment, and the complete recorded
  cube/hopper/fractal/dendritic investigation.

The public route intentionally remains the Milestone 0C empty foundation
scene. The simulation is exposed only through developer routes until Step 2
supplies a GPU-resident surface.

Milestone 2 now has GPU classification, hierarchical prefix scans, active-cell
compaction, bounded vertex emission, phase-gradient normals, surface age,
indirect promotion, overflow retention, analytic topology references, and a
live solver-to-mesh fixture. Five `128^3` checkpoints at `t = 100..500`
promoted and visibly rendered five distinct meshes without phase-volume or
mesh readback. The developer fixture holds each checkpoint for `500 ms` so the
growth sequence remains observable even on the reference GPU. The four warm
extraction samples measured `1.2..3.9 ms` with a `2.55 ms` median on the
reference browser and adapter.

## Step 1 completion review

All five Step 1 exit criteria in `PLAN.md` are satisfied:

| Gate                           | Evidence                                          | Status |
| ------------------------------ | ------------------------------------------------- | ------ |
| CPU/WebGPU numerical agreement | Three operator/domain paths through three steps   | pass   |
| Finite deterministic fields    | Unit, hardware, repeated-profile, and seed checks | pass   |
| Write-once birth time          | CPU tests and complete-field GPU comparison       | pass   |
| Recognizable 3D hopper         | Resolved multi-face recession at `t = 500`        | pass   |
| Documented convergence         | Fixed-domain `128^3`/`256^3` hopper pair          | pass   |

The implementation-list requirement to encode, run, and record the complete
transition suite is also complete. It is a partial reproduction, not four
successes:

| Paper label | Browser conclusion                                                        |
| ----------- | ------------------------------------------------------------------------- |
| Cube        | validated with conservative and author-centered operators                 |
| Hopper      | validated and grid refined                                                |
| Fractal     | recorded but not reproduced; source stencil remains below complexity gate |
| Dendritic   | recorded but not reproduced; mature source run remains too filled         |

Step 1 is therefore `100%` complete for its documented scope. This percentage
does not claim a calibrated bismuth process or a complete reproduction of the
paper's qualitative transition series.

## Fast validation loops

For browser-independent code iteration, start with:

```powershell
npm.cmd run check:fast
```

Before handoff, run the browser-free baseline gate:

```powershell
npm.cmd run check:baseline
```

Add `test:e2e` only for UI or capability-shell work and `test:gpu` for GPU
compute, extraction, solver, or rendering work. Neither browser command is part
of the baseline gate. Solver equation or numerical-configuration edits also
require the morphology screen below.

Routine solver edits start with:

```powershell
npm.cmd run validate:morphology:quick
```

This fixed perturbed hopper uses `128^3`, `dx = 2`, `dt = 0.01`, `t = 500`,
and seed `99539473`. Five retained runs produced identical summaries and
completed in `14.513..15.871 s`. Its paired `256^3`, `dx = 1` promotion gate is:

```powershell
npm.cmd run validate:morphology:reference
```

The separate `D_L = 4`, `t = 350` screen is:

```powershell
npm.cmd run validate:transition:control
npm.cmd run validate:transition:quick
npm.cmd run validate:transition:compare
```

Control takes `9.12..9.23 s`; quick takes `17.58..17.88 s`. Both enforce the
hard `25000 ms` deadline. Their one-time spatial reference takes about
`114.56 s` and is not part of the per-edit loop.

The four retained explicit-seed hopper checks each take `14.85..15.32 s`:

```powershell
npm.cmd run validate:morphology:seed:99539473
npm.cmd run validate:morphology:seed:324508639
npm.cmd run validate:morphology:seed:610839776
npm.cmd run validate:morphology:seed:3221344269
npm.cmd run validate:morphology:seeds:compare
```

Do not add the full-resolution transition controls to a routine edit loop.

## Completed scientific investigation

The uniform `D_L = 4` spatial pair is the interface-resolution bound. Holding
domain, physical time, operator, and time step fixed while refining `dx = 2`
to `dx = 1` changes diagonal/face reach from `1.02857` to `1.00000`, away from
the missing dendrite. Physical volume and surface differ by only `1.40%` and
`1.89%`.

Halving `dt` changes no directional reach. The converged coupled
backward-Euler experiment changes the subcell diagonal/face ratio by only
`2.56e-6` at `dt = 0.01`, again away from the source dendrite. Do not promote
a production coupled integrator or mature time-step refinement.

The author-centered source stencil is the only tested departure with a large
source-directed signal. At `D_L = 1 / 2`, it changes fill from `0.953535` to
`0.600643`, complexity from `5.88791` to `7.34534`, and diagonal/face reach
from `1.03774` to `1.47059`. It still misses the fixed complexity gate `8`.
Do not lower that gate after observing the run.

The authors' adaptive mesh, variable-step implicit BDF2 history, multigrid
solve, and Float64 storage remain unimplemented. Their individual effects are
not claimed to be bounded. Reopening them is a separate scientific-fidelity
task, not a prerequisite for Milestone 2.

## Model interpretation boundary

The accepted output is a credible generic faceted single-crystal hopper. It
is not a calibrated model of real bismuth crystal formation. The scalar cubic
model cannot represent screw-dislocation spirals, twins, differently oriented
intergrowths, or bismuth-specific rhombohedral attachment kinetics.

Do not add decorative spirals, stamped terraces, mesh noise, or post-processed
offshoots. Those features require cited defect, orientation, multiphase, or
bismuth-specific kinetic physics and are deferred in `docs/decisions.md`.

## Current task: finish Milestone 2 surface extraction

The extraction core and repeated live tracking are implemented. Durable
evidence is in `docs/evidence/milestone2-live-solver-extraction.md` and
`docs/evidence/milestone2-live-tracking-summary.json`.

The next implementation slice is:

1. Integrate the solver and extractor into the imperative visualizer
   controller without moving per-frame state into React.
2. Handle both solver ping-pong texture parities while sharing one promoted
   last-valid render mesh.
3. Schedule solver, extraction, and rendering independently so warm extraction
   cadence is not treated as frame cadence.
4. Add controller-level lifecycle and resize coverage for the live mesh.
5. Record the final facet/terrace visual gate before closing Milestone 2;
   consider dual contouring only if marching cubes fails that gate.

React must not own extraction or per-frame simulation state. The imperative
visualizer controller owns the render loop and run-scoped GPU resources; the
extraction layer owns classification, compaction, emission, capacity, and
indirect draw state.

## Durable Step 1 evidence

- `docs/evidence/step1-validation.md`
- `docs/evidence/step1-quick-profile-validation.md`
- `docs/evidence/step1-hopper-seed-suite-validation.md`
- `docs/evidence/step1-transition-suite-validation.md`
- `docs/evidence/step1-dl4-screen-validation.md`
- `docs/evidence/step1-coupled-cpu-validation.md`
- `docs/evidence/step1-source-audit.md`

The adjacent JSON and PNG files contain the machine reports and diagnostic
images. These images are voxel-surface developer evidence, not the Step 2
marching-cubes render.

## Worktree and validation notes

- All current milestone work is uncommitted and unstaged. Preserve unrelated
  user changes and do not reset the tree.
- `npm run test:e2e` writes its transient output under
  `test-results/playwright/`; GPU and CPU convenience reports remain under
  their sibling directories. Durable evidence still belongs under
  `docs/evidence/`.
- Hardware tests use the Codex in-app browser and the real WebGPU adapter. Do
  not substitute SwiftShader or unsafe browser flags.
- Keep agent-facing Markdown ASCII-only.
