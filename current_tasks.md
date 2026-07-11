# Current Tasks

Updated 2026-07-11. This is the handoff for the unfinished portion of Step 1.
Do not inspect deleted branches, caches, or repository history. Work from the
current tree, the primary sources linked below, and the durable evidence in
`docs/evidence/`.

## Current status

The core single-hopper solver is implemented and validated:

- Full 3D CPU reference and Three.js r185 TSL/WebGPU solvers for phase,
  chemical potential, and write-once solidification time.
- Conservative anisotropy and chemical-diffusion fluxes, exact `Delta g`
  source integration, explicit stability rejection, deterministic random
  state, and documented Neumann/Dirichlet boundary conditions.
- Developer-only `/__dev/single-crystal` diagnostics and a hardware-WebGPU
  CPU/GPU comparison integrated into `npm run test:gpu`.
- The published `D_L = 1 / 12`, `mu_inf = 0.04` hopper has a resolved,
  grid-refined face recession. A deterministic physics-perturbed run adds
  measurable asymmetry by changing only the initial and reservoir conditions.
- All current local checks pass: 43 unit tests, lint, formatting, typecheck,
  build, and 2 end-to-end shell tests. The hardware `test:gpu` proof also
  passed on Chromium 150 and an NVIDIA Blackwell WebGPU adapter.

This is complete only for the single-hopper acceptance gate. Do not describe
all of Step 1 as complete yet.

## Realism conclusion

The accepted output is a credible generic faceted hopper baseline, but it is
not generally representative of real bismuth crystal formation. It remains a
mostly regular cubic single crystal. The scalar cubic model does not contain
the state needed for screw-dislocation spirals, twins, differently oriented
intergrowths, or bismuth-specific rhombohedral attachment kinetics.

Physics-grounded irregularity dials now exist for seed-radius amplitude and
correlation length, initial chemical-potential amplitude and correlation
length, and a far-field chemical-potential gradient. They do not deform the
final mesh. Other legitimate morphology controls are `mu_inf`, `D_L / M`,
`R0 / Rc`, facet set/orientation/regularization, and `D_S / D_L`. Do not add
decorative spirals, stamped terraces, mesh noise, or post-processed offshoots.

Future realistic spirals and multi-grain offshoots require new physical state:

- A cited dislocation or explicit step field for screw-growth spirals.
- An orientation or multiphase field for twins, grains, and intergrowths.
- A bismuth-specific facet and attachment-kinetic calibration.
- Later evaluation of free-surface transport, convection, and finite melt
  depletion.

These extensions are recorded in `docs/decisions.md` as deferred decisions
`X-009` and `X-010`.

## Main unresolved Step 1 discrepancy

The full published cube/hopper/fractal/dendritic transition suite is not
validated. The 2023 paper reports that, at `mu_inf = 0.04`, changing only
liquid diffusivity gives a hopper at `D_L = 1 / 12`, a fractal-looking
eight-vertex dendrite at `D_L = 1 / 2`, and a smooth `<111>` eight-pronged
dendrite at `D_L = 4`. Its mature examples grow a radius-20 nucleus to roughly
ten times its initial size and use runs below `t = 1000`.

The latest exploratory hardware run deliberately used that larger scale:

```powershell
node scripts/run-browser-gpu-test.mjs --morphology --baseline --high-resolution --grid=256 --spacing=2 --steps=50000 --dt=0.01 --dl=4 --mu=0.04
```

At `t = 500` it produced:

- Grid `256^3`, `dx = 2`, physical half-extent `255`.
- Solid extent `[178, 178, 178]`, `709752` solid voxels.
- Approximate bounding-box fill `709752 / 90^3 = 0.974`.
- Robust face-recession metric `2`, exactly one grid cell.
- Symmetry error `0`, boundary clearance `166`, and no non-finite values or
  WebGPU errors.
- Chemical-potential range `[0.04, 0.9998964]`.
- Queue-complete fixture time `107508.9 ms`.

The durable report and screenshot are:

- `docs/evidence/step1-dl4-t500-256dx2.json`
- `docs/evidence/step1-dl4-t500-256dx2.png`

The result is nearly a filled cube, not the paper's expected `<111>` dendrite.
It also shows that the current hopper pass threshold is too permissive for
non-hopper cases: a one-cell recession let this cube pass. Do not tune visual
parameters around this mismatch. First find the model or discretization
difference.

## Recommended next investigation

1. Compare the active equations against the authors' current 3D Fortran path,
   especially `phi_stencil.f90`, `mp_stencils_terms.f90`, and the toy-model
   branches in `mp_problem.f90`:

   - Confirm the cubic surface-energy normalization in the exact branch used
     by the paper, rather than assuming all author-code branches use the same
     factor.
   - Confirm nondimensional time scaling, mobility/diffusivity scaling,
     `lambda`, anisotropy signs, and the diffusion/source split.
   - Confirm how octant symmetry and the far-field chemical boundary are
     imposed.
   - Compare the uniform explicit stencil against the paper's adaptive mesh
     and implicit BDF2 method. Record every deliberate numerical departure.

2. Add transition descriptors before running more expensive cases:

   - Bounding-box fill fraction. The latest cube is about `0.974`; the accepted
     perturbed hopper is about `0.722` at `dx = 1`.
   - Surface-to-volume ratio.
   - Radial reach along the six face, twelve edge, and eight body-diagonal
     directions.
   - Concavity/recession that requires at least three grid cells, not one.
   - Connectedness and branch/arm occupancy along `<111>` directions.

3. Add an explicit expected morphology to the runner and fixture, for example
   `--expected=cube|hopper|fractal|dendritic`. A cube or dendrite must not be
   judged by the hopper gate. Reject invalid or conflicting options and assert
   that the report matches every requested grid and physical parameter.

4. Only after the source comparison, run the remaining symmetric cases on the
   same physical domain and maturity criterion:

```powershell
# Fractal candidate
node scripts/run-browser-gpu-test.mjs --morphology --baseline --high-resolution --grid=256 --spacing=2 --steps=50000 --dt=0.01 --dl=0.5 --mu=0.04

# Equilibrium-cube control. D_L = 20 requires the smaller stable step.
node scripts/run-browser-gpu-test.mjs --morphology --baseline --high-resolution --grid=256 --spacing=2 --steps=100000 --dt=0.005 --dl=20 --mu=0.04
```

Do not start both expensive runs until the source comparison explains why the
`D_L = 4` result remained cubic.

5. Expand the deterministic perturbation seed suite. The current accepted
   physics-perturbed evidence uses one seed only, and its four correlated modes
   randomize phases but not wave-vector directions. Either describe that narrow
   sampling honestly or seed the mode directions and revalidate CPU/GPU parity.

## Durable accepted evidence

- `docs/evidence/step1-validation.md` - concise validation record.
- `docs/evidence/step1-perturbed-reference-256.json` - accepted `256^3`
  perturbed hopper report.
- `docs/evidence/step1-physics-perturbed-hopper-256.png` - accepted diagnostic
  image; this is voxel-surface evidence, not the Step 2 marching-cubes render.
- `docs/evidence/step1-perturbed-preview-128.json` and
  `step1-physics-perturbed-hopper-128.png` - coarse perturbed refinement case.

The accepted `256^3`, `dx = 1`, `t = 500` perturbed hopper has extent `100`,
mean robust face recession `7.8333` with range `6..10`, symmetry error
`0.0064696`, boundary clearance `75`, and no non-finite values or WebGPU
errors. Its evolved chemical potential reaches `1.5332261`; the paper
explicitly reports `mu > mu0` inside low-diffusivity hopper/dendritic solids,
so this is recorded as an interfacial diagnostic rather than rejected as a
phase-range violation.

## Primary sources

- Bollada, Jimack, and Mullis (2023), phase-field hopper model:
  https://www.nature.com/articles/s41598-023-38741-2
- Supplementary material:
  https://static-content.springer.com/esm/art%3A10.1038%2Fs41598-023-38741-2/MediaObjects/41598_2023_38741_MOESM2_ESM.pdf
- Authors' reference implementation:
  https://github.com/prepcb/PhaseField
- Bismuth-specific morphology study (2024):
  https://www.nature.com/articles/s43246-024-00538-9
- Frank's screw-dislocation growth mechanism:
  https://doi.org/10.1039/DF9490500048
- Orientation-field phase-field example:
  https://doi.org/10.1016/S1359-6454(03)00388-4

## Worktree and validation notes

- All Step 1 work is currently uncommitted and unstaged. Preserve unrelated
  user work and do not reset the tree.
- `npm run test:e2e` deletes ignored `test-results/`; durable evidence belongs
  under `docs/evidence/`.
- The public route intentionally remains the Milestone 0C empty foundation
  scene. The solver is exposed only through developer routes until Step 2
  supplies GPU marching-cubes extraction.
- Browser tabs and temporary local servers were closed at this stopping point.
