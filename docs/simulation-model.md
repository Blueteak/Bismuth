# Simulation Model

## Scientific baseline and sources

Step 1 implements the three-dimensional faceted hopper model in Bollada,
Jimack, and Mullis, ["Phase field modelling of hopper crystal growth in
alloys"](https://www.nature.com/articles/s41598-023-38741-2) (2023), checked
against its [supplementary
material](https://static-content.springer.com/esm/art%3A10.1038%2Fs41598-023-38741-2/MediaObjects/41598_2023_38741_MOESM2_ESM.pdf)
and the authors' [reference implementation](https://github.com/prepcb/PhaseField).
It evolves a phase field and a chemical-potential field with strongly faceted
cubic anisotropy.

This is a physically motivated generic hopper model, not a quantitatively
calibrated bismuth process model. Real bismuth is rhombohedral rather than
cubic, and a bismuth-specific study reports facet-selective kinetics,
free-surface effects, and high-angle grain-boundary branching that are absent
here: ["Growth mechanisms of hopper and dendritic morphologies in bismuth
crystals"](https://www.nature.com/articles/s43246-024-00538-9) (2024). Product
copy and developer documentation must preserve that distinction.

## Field convention and governing equations

The phase convention is:

- `phi = 0`: solid.
- `phi = 1`: liquid.

Let `DeltaC = cL - cS`, `mu0` be the equilibrium chemical potential, `M` the
phase mobility, `a` the free-energy curvature, `delta` the diffuse-interface
width, and `lambda` the phase/chemical coupling. The published model is:

```text
dot(phi) / M = div(d(A^2 / 2) / d(grad(phi)))
               - Omega'(phi) / delta^2
               - g'(phi) (mu0 - mu) DeltaC / (lambda delta^2)

dot(mu) = a div(D(phi) grad(mu))
          - a DeltaC g'(phi) dot(phi)
```

with:

```text
Omega(phi)  = 0.5 phi^2 (1 - phi)^2
Omega'(phi) = phi (1 - phi) (1 - 2 phi)

g(phi)  = 3 phi^2 - 2 phi^3
g'(phi) = 6 phi (1 - phi)

D(phi) = phi DL + (1 - phi) DS
lambda = 3 Rc DeltaC^2 / delta
```

For a globally oriented cubic crystal, let `e_i` be the three rotated crystal
axes, `X_i = grad(phi) dot e_i`, and `|grad(phi)|^2 = sum_i X_i^2`. The faceted
surface energy is:

```text
A(grad(phi)) = sum_i sqrt(X_i^2 + epsilon^2 |grad(phi)|^2)
```

The implementation evaluates the analytic derivative
`d(A^2 / 2) / d(grad(phi))`, rotates it back to world coordinates, and takes a
conservative divergence. The last line of the paper's displayed limiting form
repeats `X_3`; the three-dimensional limit is the sum of `X_1`, `X_2`, and
`X_3`, consistent with the preceding equation and the reference code.

### Surface-energy normalization

The paper's displayed equation does not state the normalization used by the
active cubic branch of the authors' code. The browser applies the common scale
`1 / [3 (1 + epsilon)^2]` to the exact derivative of the displayed energy:

```text
N_A = 1 / [3 (1 + epsilon)^2]

dot(phi) = M [N_A div(d(A^2 / 2) / d(grad(phi)))
              - Omega'(phi) / delta^2
              - g'(phi) (mu0 - mu) DeltaC / (lambda delta^2)]
```

For `epsilon = 0.02`, `N_A = 0.3203895937459951`. This is a source-traceable
normalization, not an appearance adjustment. The 2026-07-11
[author-source audit](evidence/step1-source-audit.md) found that the active
Fortran centered-Hessian branch gives its `A0` curvature term one additional
factor of `(1 + epsilon)^-1`; the browser operator is therefore a close
continuum analogue, not an exact transcription of that discrete branch.

## Published constants and presets

The Step 1 configuration transcribes the following nondimensional values:

| Quantity  |    Value | Meaning                             |
| --------- | -------: | ----------------------------------- |
| `M`       |      `1` | Phase mobility                      |
| `cL`      |    `0.9` | Liquid equilibrium concentration    |
| `cS`      |    `0.5` | Solid equilibrium concentration     |
| `DeltaC`  |    `0.4` | Concentration jump                  |
| `mu0`     |      `1` | Equilibrium chemical potential      |
| `a`       |      `4` | Free-energy curvature               |
| `DS / DL` |   `1e-4` | Solid/liquid diffusivity ratio      |
| `Rc`      |     `10` | Critical radius                     |
| `R0`      |     `20` | Initial seed radius                 |
| `delta`   |      `2` | Diffuse-interface width             |
| `epsilon` |   `0.02` | Facet regularization                |
| `mu_inf`  |   `0.04` | Hopper far-field chemical potential |
| `DL`      | `1 / 12` | Hopper liquid diffusivity           |
| `lambda`  |    `2.4` | Derived as `3 Rc DeltaC^2 / delta`  |

The paper's table entry for `lambda` is inconsistent with its defining
equation. The derived value `2.4` agrees with the equation, supplementary
description, and author implementation and is the value used here.

Named configurations also encode the reported diffusivity sweep at
`mu_inf = 0.04`: `DL = 20` for cube, `1 / 12` for hopper, `1 / 2` for fractal,
and `4` for dendritic. The complete Step 1 investigation accepts cube and
hopper as validated browser outcomes. Fractal and dendritic retain the paper's
parameter-set labels but fail the browser morphology gates and must not be
described as reproduced outcomes.

## Initial and boundary conditions

The unperturbed run starts from one centered spherical seed:

```text
r = |x - x_center|
phi(x, 0) = 1 / [1 + exp(-(r - R0) / delta)]
mu(x, 0) = mu0 - phi(x, 0) (mu0 - mu_inf)
```

This gives solid-like `phi` and `mu` at the center and liquid-like values far
from the seed. The product path uses the full three-dimensional domain; it does
not impose octant symmetry.

When a documented perturbation configuration is enabled, two fixed smooth,
bounded sinusoidal fields, `eta_R` and `eta_mu`, alter only the initial
condition, while `G` alters the reservoir. Their component modes are
zero-mean, but one finite-domain realization need not have an exactly zero
sample mean:

```text
R(x) = R0 + A_R eta_R(x)
mu_inf(x) = mu_inf + G dot x

phi(x, 0) = 1 / [1 + exp(-(r - R(x)) / delta)]
mu(x, 0) = mu0 - phi(x, 0) [mu0 - mu_inf(x)]
           + phi(x, 0) A_mu eta_mu(x)
```

The browser discretization makes its boundary choice explicit:

- `phi` uses a homogeneous Neumann condition. Boundary samples copy the
  nearest updated interior value, giving zero normal gradient.
- `mu` uses a Dirichlet reservoir. Each boundary cell is reset every step to
  `mu_inf + G dot x`, where `G = 0` for the published symmetric control.

The fixed `mu` reservoir follows the paper's stated far-field driving
condition. The author code contains boundary machinery whose effective choice
is not as explicit as the paper prose, so the browser choice is documented and
tested rather than inferred silently.

Transition validation may opt into a developer-only `octant` domain. Grid
coordinate zero is the physical origin on all three axes; `phi` and `mu` copy
the nearest interior update on those three symmetry planes. The three high
faces retain phase Neumann conditions and the fixed `mu` reservoir. Octant
mode requires an axis-aligned crystal and rejects every seed, chemical, or
reservoir perturbation that would break mirror symmetry. Production and
perturbed runs remain full-domain.

At `256^3`, `dx = 2`, the octant represents `[0, 510]^3`, whereas the same full
grid represents approximately `[-255, 255]^3`. Metrics interpret the octant as
a mirrored full crystal, exclude symmetry planes from the surface proxy, and
report actual octant voxel counts with mirrored physical extents.

## Browser discretization

The paper uses an adaptive mesh and an implicit BDF2 time integrator. Step 1
deliberately uses a uniform Cartesian grid, explicit Euler time stepping, and
`r32float` ping-pong `Storage3DTexture` fields because that maps predictably to
WebGPU. This numerical departure is accepted only with CPU/GPU comparison,
stability rejection, and grid-refinement evidence.

For the anisotropy operator, each cell face receives one gradient:

- The face-normal component is the one-sided difference across that face.
- Each transverse component is the average of centered differences in the two
  cells adjacent to the face.
- The analytic anisotropy flux is evaluated once at the face.
- Opposing face fluxes are differenced and divided by `dx`.

This conservative face-flux stencil shares one physical flux between adjacent
cells and avoids the odd/even decoupling observed with a cell-centered
central-gradient/central-divergence trial.

The authors' active 3D path instead contracts a cell-centered phase Hessian
with a cubic energy Hessian assembled from the centered gradient. The Step 1
investigation isolates that 27-point operator, time-step sensitivity,
future-state coupling, and uniform refinement. The authors' nonlinear implicit
BDF2 solve, adaptive mesh, multigrid machinery, and Float64 storage remain
unimplemented source differences; they are not compensated with physical
parameter tuning.

The developer configuration can select that spatial contraction with
`phaseOperator = "author-centered"` (runner option
`--operator=author-centered`). It transcribes the active Fortran branch,
including its split normalization of the `A0` and gradient-product terms. The
CPU and WebGPU versions agree on the tiny validation grid. It remains an
experimental diagnostic: at `D_L = 4`, `dx = 2`, and `t = 500`, it reduced the
bounding-box fill from `0.9736` to `0.8804` and increased normalized
`<111>/<100>` reach from `1.0230` to `1.0690`, but did not meet the dendrite
gate. The conservative face-flux operator remains the default.

### Maturity checkpoints

Developer morphology runs may specify a target radius multiple and checkpoint
interval. At each checkpoint the solver reads back only `phi`, measures
axis-equivalent reach along `<100>`, `<110>`, and `<111>`, and stops if the
maximum mean directional reach reaches the requested multiple of `R0`. The
final report records the full reach history and far-boundary clearance. The
runner rejects a target unless the far boundary is at least twice the target
radius.

The source-matched `D_L = 4` octant run used target `10 R0`, a hard guard of
`t = 1000`, and checkpoints every `Delta t = 50`. It reached only `8.3 R0` at
the guard, while retaining a far-boundary clearance ratio `2.0723`. The final
`<111>/<100>` reach ratio was `1.2388`, but bounding-box fill remained
`0.7939`; this is a diagonal-dominant deep hopper rather than the paper's
smooth dendrite.

The phase pass writes `phi^(n+1)` first. The chemical pass then uses
`D(phi^(n+1))` and the old chemical-potential gradient. Chemical diffusion is
also conservative: each face uses the arithmetic mean of the two adjacent
`D(phi^(n+1))` samples. Instead of approximating the phase-change source as
`g'(phi) dot(phi)`, it integrates that term exactly over the split phase
update:

```text
mu^(n+1) = mu^n
           + dt a div(D(phi^(n+1)) grad(mu^n))
           - a DeltaC [g(phi^(n+1)) - g(phi^n)]
```

The exact `Delta g` source preserves the phase-change contribution to the
model's implied concentration under operator splitting. No phase, chemical
potential, or update is clamped to conceal instability.

### Explicit stability guard

The configuration validator rejects a time step above a conservative bound.
At a cubic facet normal, define:

```text
s   = sqrt(1 + epsilon^2)
A_x = s + 2 epsilon
k_n = A_x^2
k_t = A_x [epsilon^2 / s + 1 / epsilon + 2 epsilon]

K_grad = 4 M N_A (k_n + 2 k_t) / dx^2

Delta_mu_max = |mu0 - mu_inf| + max_domain(|G dot x|) + A_mu
K_local = M [1 + 6 Delta_mu_max DeltaC / lambda] / delta^2

dt_phase = 2 / (K_grad + K_local)
dt_mu    = dx^2 / [2 d a max(DL, DS)]          where d = 3

dt_max = min(0.01, 0.9 dt_phase, 0.9 dt_mu)
```

The local term covers the maximum double-well curvature and a conservative
initial/far-field chemical-driving curvature. The `0.9` terms are safety
factors, and `0.01` is the upper end of the stable adaptive-step range reported
by the paper at `dx = 2`. This guard is conservative rather than a proof for
every nonlinear state; phase-range, non-finite, and refinement checks remain
required.

## Solidification time and oxidation input

The separate solidification-time field uses `-1` as its unborn sentinel. Seed
cells at or below `phi = 0.5` receive time zero. Thereafter, an interior cell is
written once when `phi^n > 0.5` and `phi^(n+1) <= 0.5`. Boundary cells remain
unborn. This field never feeds back into either governing equation.

Marching-cubes vertices will later sample or interpolate this field to obtain
surface birth time. Surface age is current simulated time minus birth time and
is a rendering input only.

## Physics-grounded irregularity controls

The symmetric sphere is the numerical control, not the intended final product
distribution. After reproducing that baseline, Step 1 permits deterministic,
smooth perturbations to physical initial or boundary conditions:

- `seedRadiusAmplitude` and `seedRadiusCorrelationLength` represent a
  non-spherical nucleus or heterogeneous initial interface.
- `chemicalPotentialAmplitude` and
  `chemicalPotentialCorrelationLength` represent smooth initial composition
  or chemical-potential heterogeneity on the liquid side.
- `farFieldGradient` represents a persistent macroscopic reservoir gradient.
- The internal seed fixes the correlated fields for repeatable tests.

These perturbations change the initial/boundary-value problem and let the
phase-field instability amplify asymmetry. They can seed same-orientation
branching in a branching regime, but the accepted Step 1 checkpoint validates
only asymmetry and hopper recession. They do not displace the final mesh, stamp
terraces, or add per-cell white noise each step. The accepted Step 1 perturbed
checkpoint uses amplitude/correlation pairs
`0.3 / 8` for seed radius and `0.006 / 12` for chemical potential, plus
`G = [0.00018, -0.0001, 0.00014]`.

Configuration validation keeps these dials in their physical role:

- Seed-radius amplitude cannot exceed one interface width and must preserve a
  positive seed core.
- Both correlation lengths must span the interface and at least two cells, so
  they cannot become per-cell visual noise.
- Initial chemical-potential amplitude is limited to ten percent of the imposed
  chemical driving.
- The combined chemical perturbation and reservoir gradient must remain within
  the paper model's `[-0.6, 1]` chemical-potential range over the domain.

The main morphology controls that remain physically meaningful are:

- `mu_inf`: thermodynamic driving.
- `DL / M`: transport versus interface-kinetic competition.
- `R0 / Rc`: initial seed relative to the critical radius.
- Facet set, orientation, and `epsilon`: interfacial anisotropy.
- `DS / DL`: transport through the solid relative to liquid.
- Smooth initial heterogeneity and far-field gradients: environmental
  nonuniformity.

Grid spacing and time step are numerical choices, not morphology knobs.
Interface width also participates in the physical/numerical calibration and
must not be changed for appearance without renewed convergence checks.

The `[-0.6, 1]` validation range above applies to imposed initial and reservoir
conditions, not to the evolved chemical-potential state. Solidification rejects
the modeled concentration difference through the exact `Delta g` source, so
interfacial `mu` can exceed `mu0 = 1`; the accepted `256^3` checkpoint reached
`1.5332261` without phase overshoot or non-finite values. That maximum is
recorded as a diagnostic, not treated as a calibrated physical prediction. The
completed transition and four-seed studies retain the extrema in their durable
reports.

## Limits of the scalar single-crystal model

The current scalar `phi` plus `mu` model has validated cubic hopper recession
and transport-driven asymmetry. The published model family also contains
terraced and same-orientation branching regimes, but the completed browser
study reproduces only the cube and hopper gates. The scalar model cannot
honestly represent:

- Screw-dislocation-driven growth spirals. That mechanism requires a
  dislocation/topological-defect or explicit step field; see Frank's primary
  mechanism paper, ["The influence of dislocations on crystal
  growth"](https://doi.org/10.1039/DF9490500048).
- Twins, grain boundaries, or differently oriented intergrowths. Those require
  an orientation or multiphase field coupled to shared transport, not
  overlapping meshes.
- Bismuth-specific rhombohedral facets, attachment kinetics, convection,
  thermal/free-surface transport, or finite melt depletion.

These are later physics extensions. They must not be imitated with decorative
spirals, post-processed asymmetry, or unrelated geometry. An orientation-field
extension must be selected and validated before Step 5; one relevant primary
model is [Kobayashi, Warren, and Carter's orientation-field phase-field
formulation](<https://doi.org/10.1016/S1359-6454(03)00388-4>).

## Resolution and convergence

Grid size, domain size, spacing, interface width, and time step form one
numerical configuration. A `256^3` grid is not automatically a graphics
setting. Candidate runs must hold the physical domain and model parameters
consistently and compare solid volume, bounding extent, symmetry, face-center
recession, and boundary distance.

At simulated time `t = 500`, the unperturbed hopper control produced maximum
solid extent `94` and robust rim-relative face recession `6` on a `128^3`,
`dx = 2` grid, versus extent `93` and recession `7` on a `256^3`, `dx = 1`
grid. Both runs used the published `R0 = 20`, `Rc = 10`, `delta = 2`,
`DL = 1 / 12`, `mu_inf = 0.04`, and `dt = 0.01`. This supports the hopper as
a resolved physical-domain outcome rather than a single-grid artifact; it
does not yet select a production resolution.

The deterministic perturbed pair at those same grids is the developer
iteration calibration. The `128^3` case preserves physical extent, recession,
boundary clearance, and scale-adjusted volume/surface proxies closely enough
to serve as a regression screen under a `25000 ms` fixture-wall budget. This
is a validation tier, not a reduced physical model or a production-resolution
choice. Any change to equations, stencil, boundary conditions, time step,
physical scale, or perturbation construction invalidates the calibration until
the paired `128^3` and `256^3` checkpoints are repeated.

Correlation for the hopper case does not establish correlation for another
transport regime. The `D_L = 4` investigation therefore has a separate early
matrix at `t = 350`. Its `128^3`, `dx = 2`, `dt = 0.005` candidate correlates
with a one-time `256^3`, `dx = 1`, `dt = 0.005` spatial reference: physical
volume and surface proxies differ by `1.40%` and `1.89%`, while extent is equal
and directional reaches differ by at most one physical unit. Both reduced
temporal profiles complete below the `25000 ms` fixture budget on the reference
machine.

Against the matching `128^3`, `dx = 2`, `dt = 0.01` control, however, halving
the time step changes solid count by only `0.0185%`, surface count by `0.0804%`,
fill by `+0.000178`, and complexity by `+0.00377`; extent, recession, all
directional reaches, and the diagonal/face ratio are unchanged. The temporal
signal is smaller than the observed spatial mismatch and does not move the
immature morphology toward the source dendrite. The full `256^3`, `dx = 2`,
`dt = 0.005`, `t = 1000` maturity run is therefore not promoted. The three-run
matrix does not prove temporal sensitivity is resolution-independent; a fourth
`256^3`, `dx = 1`, `dt = 0.01` control would be required for that narrower
claim.

The subsequent CPU-only experiment isolates future-state coupling with a
block-Picard backward-Euler reference. It preserves the same author-centered
operator, octant boundaries, Float32 fields, physical parameters, and exact
conserved `Delta g` source. On `17^3` and `25^3`, `dx = 2` domains through
`t = 0.2`, every coupled step converged in `3..5` iterations at both `dt = 0.01`
and `dt = 0.005`. The first full-step chemical fixed-point defect fell by
`1693x` to `5.96046e-8`; the half-step defect fell by `423x` to the same floor.
Three complete four-method matrices reproduced every numerical summary in
`15.79..15.91 s`, with setup-plus-matrix times of `16.58..16.72 s`.

Split-minus-coupled subcell body-diagonal/face ratio differences were
`+2.56335e-6` at `dt = 0.01` and `+1.31454e-6` at `dt = 0.005`. Their `1.9500x`
scaling is consistent with a first-order method difference. The positive sign
on both domains and time steps means the coupled result has the lower ratio,
slightly away from the source dendrite. Thresholded morphology was unchanged.
This does not support a production coupled integrator or mature GPU run. It
bounds the first-order future-state integration difference but does not
reproduce the authors' BDF2 history/order, adaptive mesh, or double precision.
The matched early spatial pair separately bounds uniform interface resolution:
at `t = 350`, refinement from `dx = 2` to `dx = 1` changes diagonal/face reach
from `1.02857` to `1.00000`, away from the source dendrite, while physical
volume and surface proxies remain within `1.40%` and `1.89%`. Neither tested
time integration nor uniform refinement justifies adaptive GPU infrastructure.

## Completed transition investigation

The fixed-gate transition study is complete. With the conservative production
operator, the `D_L = 20` cube passes with fill `0.999995` and zero face
recession. The `D_L = 1 / 2` candidate remains cube-like with fill `0.953535`,
complexity `5.88791`, and diagonal/face reach `1.03774`, so it fails the
fractal fill and complexity gates.

The source-matched author-centered A/B preserves the cube and moves the
fractal candidate strongly toward the paper: fill `0.600643`, complexity
`7.34534`, diagonal/face reach `1.47059`, all eight arms, and one connected
component. It still misses the predeclared complexity gate `8`. The mature
`D_L = 4` octant reaches diagonal/face ratio `1.23881` but remains too filled
at `0.793868` for the dendritic gate `< 0.65`.

This is a partial transition reproduction: cube and hopper pass; fractal and
dendritic do not. The authors' adaptive mesh, implicit variable-step BDF2,
multigrid solve, and Float64 storage are unimplemented and their individual
effects are not claimed to be bounded. They remain explicit fidelity limits
rather than being combined into an unvalidated production variant. Full
reports are in
[`step1-transition-suite-validation.md`](evidence/step1-transition-suite-validation.md).

## Seed-suite result

Four explicit internal seeds were run through the calibrated `128^3` perturbed
hopper profile. All four passed, retained one connected component and mean
face recession `8`, produced distinct summaries, and completed in
`14.851..15.320 s` under the `25000 ms` limit. Solid count varied by `0.60%`
and the physical surface proxy by `0.64%`. The modes randomize phase but retain
fixed wave-vector directions, so this is a bounded robustness sample rather
than a broad stochastic distribution. See
[`step1-hopper-seed-suite-validation.md`](evidence/step1-hopper-seed-suite-validation.md).

## Completion and determinism

The reservoir can continue supplying growth, so product completion is a
presentation boundary rather than thermodynamic equilibrium:

- Stop when occupied bounds reach a calibrated fraction of the domain.
- Include a hard maximum simulated time and slow-growth/failure diagnostic.
- Freeze the latest valid surface when stopped.

Each run has an internal seed. Tests and developer tools may set it explicitly;
the public interface neither displays nor persists it.

## Step 1 completion boundary

Step 1 has completed CPU/GPU agreement, deterministic write-once birth-time
capture, a resolved and grid-refined single hopper, four-seed robustness, and
the recorded cube/hopper/fractal/dendritic investigation. Its scoped milestone
is complete even though the full paper transition series is not reproduced.

Later milestones must still separate solver, extraction, and rendering cost at
candidate production grids. Any bismuth-specific facet, kinetic, defect, or
orientation extension requires new primary evidence and renewed convergence
tests; it is not silently folded into this scalar baseline.
