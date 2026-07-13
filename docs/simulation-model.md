# Simulation Model

## Product boundary

The goal is a physically motivated, single-site bismuth hopper with a deep open
recession, nested terraces, coherent bismuth facets, and plausible asymmetry.
The accepted model must generate those traits during growth. Mesh carving,
stamped terraces, decorative spirals/noise, or overlapping cosmetic crystals
cannot satisfy the gate.

The code currently contains four separate scientific tracks:

- A completed generic cubic alloy hopper used only as runtime and extraction
  scaffolding.
- Candidate 2A, closed as a terrace carrier but retained for its sourced
  free-surface heat boundary and conservative thermal definitions.
- Candidate 2B, a deferred sharp-surface incorporation isolation.
- Candidate 2C, the active faceted thermal-step track with an observational 3D
  scalar carrier, not yet calibrated or accepted as bismuth morphology.

Candidate 1's direct rhombohedral remapping is rejected and removed. It used
lattice translations as surface-energy generators, selected the wrong facet
family, retained cubic calibration, and produced boundary-limited elongation.
Do not restore or retune it.

## Generic cubic scaffold

The baseline follows Bollada, Jimack, and Mullis (2023). Its convention is
`phi = 0` solid and `phi = 1` liquid. The retained local functions are:

```text
Omega(phi) = 1/2 phi^2 (1 - phi)^2
g(phi) = 3 phi^2 - 2 phi^3
D(phi) = phi D_L + (1 - phi) D_S
```

The browser uses explicit phase and chemical-potential updates, a regularized
cubic anisotropy, shared conservative face fluxes, exact `Delta g` source
integration, deterministic smooth initial/far-field perturbations, and a
write-once solidification-time texture. The active regression preset uses
`D_L = 1/12`, `D_S / D_L = 1e-4`, `epsilon = 0.02`, `mu_infinity = 0.04`, and
the source-code normalization `1 / [3 (1 + epsilon)^2]`.

This implementation deliberately omits the source solver's adaptive mesh,
Float64 storage, implicit variable-step BDF2 history, and multigrid solve. The
paper's wider cube/fractal/dendritic transition study is closed for this
project: cube and hopper were reproduced, while fractal and dendritic were
not. Those outcomes are not product gates and their experiment harnesses are
not retained.

## Candidate 2A thermal model

Candidate 2A starts from Karma and Rappel's pure-melt thermal phase field. Its
convention is `psi = +1` solid, `psi = -1` liquid, with dimensionless
temperature `u = (T - T_M) / (L / c_p)`:

```text
tau(n) dot(psi) = W(n)^2 laplacian(psi)
                  + [psi - lambda u (1 - psi^2)] (1 - psi^2)
dot(u) = D laplacian(u) + dot(psi) / 2
```

The thin-interface isolation uses:

```text
a1 = 0.8839
a2 = 0.6267
d0 = a1 W / lambda
beta = a1 [tau / (lambda W) - a2 W / D]
```

The fixed melt-air plane applies a finite-volume Robin heat-removal boundary:

```text
Bi(psi) = Bi_liquid + h(psi) (Bi_solid - Bi_liquid)
partial_n u = -Bi(psi) (u - u_air)
u_ghost = u_surface - dx Bi(psi) (u_surface - u_air)
```

Here `h(psi) = 1/2 + 3 psi / 4 - psi^3 / 4`. Omitting `Bi_solid` makes it equal
to `Bi_liquid` and exactly preserves the former boundary. Distinct values
represent the source-backed solid-air versus liquid-air heat-flux jump. This
boundary changes heat flux; it never stamps or multiplies local phase growth.
Turning the boundary off removes its excess contact-line signal in the
isolated deterministic case. A fixed uncalibrated contrast passes equal-value
null, contrast reversal, boundary-enthalpy balance, and grid-refinement checks;
it is not enabled in the fixed 3D screen.

Candidate 2A defines surface energy `gamma(n)` independently from attachment
kinetics `beta(n)`. Its slow directions use the observed `{1-102}` hexagonal
family, equivalent to `{110}` in the rhombohedral cell, derived as reciprocal
plane normals from the corrected 298 K lattice constants. Current contrast
values are dimensionless discriminators, not calibrated bismuth properties.

The former hard maximum over facet alignments was not differentiable where two
facet branches tied. Candidate 2A now uses the smooth even family response

```text
S(n) = sum_k (n . m_k)^6 / sum_k (m_0 . m_k)^6
a(n) = gamma(n) / gamma_ref = 1 - epsilon_gamma S(n)
W(n) = W0 a(n)
```

The reference scale is explicit; it is not replaced by an angular average.
For `p = grad(psi)`, `n = p / |p|`, and
`A(p) = |p| a(p / |p|)`, the implemented gradient energy and its complete
variational flux are

```text
F_grad = W0^2 A(p)^2 / 2
Q(p) = partial F_grad / partial p
     = W0^2 [a^2 p + |p| a (I - n n^T) grad_n a]
```

`Q(0) = 0`. The discrete operator takes a forward gradient and its exact
backward-adjoint divergence, so its phase update is the discrete energy
gradient rather than an anisotropy multiplier applied to a separate
Laplacian. The directional relaxation time is solved from Karma and Rappel's
finite-width kinetic relation:

```text
tau(n) = lambda W(n) [beta(n) / a1 + a2 W(n) / D]
```

The fixed isolation law has a positive numerical energy-Hessian envelope with
maximum normalized stiffness `Lambda_A <= 1.3`. With `d` active dimensions,
spacing `dx`, `|psi| <= 1`, and a declared temperature envelope `|u| <= U`,
the explicit phase limit is

```text
L_R = 2 + 8 lambda U / (3 sqrt(3))
dt_phase = 2 tau_min / [4 d W0^2 Lambda_A / dx^2 + L_R]
```

The heat limit also includes the Robin boundary eigenvalue. Configuration uses
`0.8 min(dt_phase, dt_heat)` and rejects a larger time step before a run.

The reference capillary length and stationary three-dimensional critical
Wulff scale are

```text
d0_ref = a1 W0 / lambda
R_gamma,* = 2 d0_ref / Delta
```

A surface-attached Candidate 2 seed begins as an anisotropically diffuse
hemisphere on `y = 0`, then relaxes at zero thermal drive with the same phase
energy. A Lagrange multiplier preserves the diffuse solid-volume functional
`h(psi) = 1/2 + 3 psi / 4 - psi^3 / 4`. The no-through phase flux supplies the
model's neutral contact condition; a different contact angle would require a
sourced surface free energy. This is Candidate 2 initialization, not the
generic cubic seed calibration.

Flux differentiation, the stiffness envelope, seed energy/volume behavior,
and rotated planar-front grid/time refinement now pass deterministic checks.
A cheap 3D screen may therefore test whether one initial site stays connected,
clear of the five non-free-surface boundaries, and develops an increasingly
deep dominant opening. A screen pass is only permission to promote; it is not
final morphology acceptance.

The first fixed screen failed as `non-hopper`. The converged seed and coupled
fields stayed finite; the solid remained one connected surface-attached
component, final far-boundary clearance was `4.5`, and diffuse maturity reached
`1.1259`. However, opening depth was zero at every 100-step checkpoint. At the
final checkpoint the central height was `10.6472` and the rim height was
`8.2587`, so the center advanced faster than the rim. Local `gamma(n)`, local
`beta(n)`, and Robin heat removal are therefore insufficient in this isolation
to produce the required recession. The next model change must first explain
that directional incorporation failure outside the 3D screen.

### Frozen thermal pulse and resolved opening force

The failed 3D screen left two different possible defects: the phase-specific
surface heat flux could point the wrong way, or the smooth phase field could
erase a correctly driven terrace. The mechanism discriminator separates them
without evolving or displaying a supplied hollow.

It first reuses the exact converged 3D seed, freezes `psi`, resets `u = 0`, and
advances only heat diffusion for `t = 0.5`. The three symmetric Robin pairs are

```text
equal:    Bi_liquid = 1.125, Bi_solid = 1.125
forward:  Bi_liquid = 0.25,  Bi_solid = 2
reverse:  Bi_liquid = 2,     Bi_solid = 0.25
```

Signed distance to the seed's `h(psi) = 0.5` free-surface contour defines the
same contact, solid-rim, liquid-exterior, and core samples in every arm. The
equal arm is the exact null. Forward and reverse surface temperature jumps
have the expected opposite signs, and the maximum normalized heat-ledger
residual is `1.16e-7`. However, the forward surface localization measure
`U_core - U_rim` is `-0.0631`; the core is colder than the rim. The reverse arm
changes it to `+0.1331`. The fixed pulse is therefore classified
`contrast-not-rim-localized`, not promoted.

The second discriminator injects one diagnostic outer ring into the same seed.
Its height is `2 W`, and its radial support has a `W` rise, `2 W` plateau, and
`W` fall. A resolved core tangent is subtracted so the opening mode `m` is
first-order neutral under the diffuse solid-volume functional:

```text
m = partial_H psi_ring - alpha partial_H psi_core
sum h'(psi_terrace) m = 0

P_X = sum [m F_X / tau] / sum m^2
F_total = F_variational + F_thermal
```

Positive `P_X` amplifies rim-over-core opening; negative `P_X` heals it. The
forward contrast adds a positive `1.65e-6` opening-rate component, so its phase
drive sign at the resolved solid/liquid interface is not reversed. But the
variational projection is `-0.10544`, the complete forward thermal projection
is only `+1.18e-5`, and the total remains `-0.10543`. Smooth phase-field healing
is about `8,900` times the whole thermal contribution and about `64,000` times
the contrast-only contribution. The reversed arm also heals.

This diagnostic closes smooth Candidate 2A as the carrier of discrete hopper
terraces at the resolved scale. It does not reject Candidate 2A's conservative
thermal boundary or bulk enthalpy field. Those can supply Candidate 2C, whose
explicit step state must carry ledge birth and propagation without being
converted into stamped 3D geometry.

## Candidate 2B surface-incorporation isolation

Albani et al.'s sharp-surface model evolves surface adatom density `N` through

```text
dot(N) = div_s [M grad_s(mu)] + F - v
v = (mu - mu_eq) / tau(n)
```

With quasi-stationary adatom density, this becomes

```text
v = div_s [M grad_s(mu)] + F
mu = mu_eq + tau(n) v
```

Candidate 2B tests this nonlocal construction on a planar unfolded
side-top-side surface. It sets `mu_eq = 0`, uses constant `M`, and applies zero
tangential chemical-potential flux at the two open ends. Eliminating `v` gives
the finite-volume elliptic problem

```text
mu / tau - M d2(mu) / ds2 = F
```

The endpoint condition is a conservative local isolation choice, not an
Albani trijunction law. The paper supplies no melt-air-crystal trijunction
condition and no bismuth calibration.

The fixed discriminator borrows Figure 9's dimensionless values `F = 0.5`,
`tau_side = 10`, `tau_top = 1`, and `M = 0.1`, on a top facet wider than
`sqrt(M tau_top)`. Figure 9 uses a directional incident flux; the isolation
deliberately applies uniform supply to every unfolded facet so only
incorporation contrast and tangential redistribution create the signal.
Before evaluation, the screen required at least `5%` top-rim excess,
supply-balance error no larger than `1e-12`, equation residual no larger than
`1e-11`, and less than `1%` absolute signal change under aligned grid
refinement. It passes: normalized rim excess is `1.2040`, balance error is
`1.18e-13`, and residual is `5.72e-13`. Zero mobility or isotropic `tau`
removes the signal, reversing the contrast reverses it, and scaling uniform
supply leaves the normalized signal unchanged.

This result explains a possible perimeter-over-core mechanism without carving
a hollow or retuning local Candidate 2A anisotropies. It does not authorize a
3D run. Albani's `F` and `v` already describe material-driven normal motion,
while Candidate 2A's phase rate already describes thermally driven normal
motion and releases latent heat. An additive phase-rate correction would
double-count growth. Direct bismuth evidence favors interface-reaction and
layer growth, so Candidate 2B is retained as a deferred mechanism rather than
the active coupling path.

## Candidate 2C outer-source facet steps

Pure-bismuth melt observations report stepwise advance on faceted interfaces,
and time-resolved Sn-Bi observations infer surface nucleation of new layers,
slow `{1-102}` attachment, and faster surface/trijunction tips than a buried
tip. Candidate 2C therefore tests explicit layer birth and inward step flow
instead of another smooth local kinetic multiplier.

Weinstein and Brandon give step propagation

```text
v_step = beta_step DeltaT
V_facet = h v_step c_step = beta_step |tan(theta)| DeltaT
```

and approximate their macroscopic defect-free two-dimensional nucleation law
as

```text
V_2DN = B DeltaT exp(-A / DeltaT).
```

Candidate 2C derives a deterministic layer clock `V_2DN / h`, emits circular
ledges at an outer boundary, moves each ledge inward with `v_step`, and removes
it at a center sink. That clock is an isolation closure, not a literal
nucleation-event equation from the paper. The paper's outer source is an
analogous concave silicon/ampoule configuration and does not establish a
bismuth melt-air source.

For facet radius `R`, step height `h`, and active step radius `r_i`, the
reconstructed height and exact swept volume are

```text
H(r) = h [completed_layers + count(r_i <= r)]
V = pi h [completed_layers R^2 + sum_i (R^2 - r_i^2)].
```

The fixed dimensionless isolation has `R = 4`, `h = 0.25`,
`beta_step = 1`, `B = 0.25`, `A = 1`, and uniform `DeltaT = 1`. At `t = 6`
it has two active ledges at radii `0.7183` and `3.4366`, giving a two-step
opening and swept volume `15.4520`. Source-off immobility, exact constant and
linear-undercooling trajectories, center completion, the fractional birth
clock, volume/latent geometry ledgers, profile quadrature, and time refinement
pass deterministic checks.

This proves the conditional geometry only: outer-born inward ledges can create
nested recession. A second radial isolation now couples that mechanism to a
conservative annular thermal field:

```text
dot(u) = D (1 / r) partial_r [r partial_r u] + latent_step_source
partial_r u(R) = -k_rim [u(R) - u_air]
```

Each finite-volume face exchanges equal and opposite heat between adjacent
annuli. Here `k_rim` has inverse radial-length units; it is not a conventional
dimensionless Biot number. This prescribed outer Robin sink is the only
external term. Every ledge displacement from `r_old` to `r_new` returns

```text
Delta V = pi h (r_old^2 - r_new^2)
Delta Q_latent = L Delta V
```

to the overlapped annular thermal cells. Thus the same motion supplies geometry
and latent heat. Starting uniformly at melting temperature, the fixed gate at
`t = 1.5` produces core temperature `-0.0512` and rim temperature `-0.5090`;
the rim source emits 11 active terraces, opening depth is `1.1`, and swept
volume is `7.0787`. Removing the outer heat flux leaves the field at melting
temperature and emits no layer. Cumulative external heat `-20.5201` and latent
heat `+7.0787` close the finite-volume energy ledger, while radial and time
errors decrease independently and remain inside the predeclared `15%`
envelope. A step-motion Courant bound is enforced, and newborn zero-area
ledges do not count toward opening depth until they move inward by one cell.

The cold-rim toy therefore passes its numerical conservation gate, but not the
physical coupling gate. It prescribes the source location and uses a
unit-depth radial capacity. It remains predecessor evidence only; the active
path does not revolve or stamp this profile.

### Faceted thermal coupling and scalar carrier

The active Candidate 2C coupling uses a fixed, closed, cell-centered 3D
thermal domain. There is no fitted effective depth. For thermal cell `i`,
interior face `f`, and surface phase `p` in `{solid, liquid}`, the discrete
energy update is

```text
E_i = V_i u_i

Delta E_i = Delta t sum_f D (A_f / d_f) (u_j - u_i)
            - Delta t sum_p D kappa_eff,p A_i,p (u_i - u_air)
            + L Delta V_s,i

kappa_eff,p = kappa_p / (1 + kappa_p dx / 2).
```

The last denominator is the half-cell resistance between the stored cell
center and the Robin face. Internal exchanges are equal and opposite. Exact
solid/liquid cut areas partition every free-surface cell, while `Delta V_s,i`
is the same swept faceted-prism volume used by the step geometry. It is
rasterized over its actual vertical cell overlaps and deposited once; no
Candidate 2A phase update supplies a second latent source.

At the exact outer polygon, a local linear finite-volume reconstruction gives
the shared cell trace. Its two one-sided Robin face values and outward fluxes
are

```text
u_Gamma,p = [u_c + (kappa_p dx / 2) u_air]
            / [1 + kappa_p dx / 2]
q_Gamma,p = D kappa_p (u_Gamma,p - u_air)
J_Gamma = mean_Gamma(q_Gamma,solid - q_Gamma,liquid).
```

`J_Gamma > 0` selects the outer solid source. Equal coefficients make this
excess source exactly zero, and coefficient reversal reverses its sign; the
reverse arm suppresses births rather than inventing step dissolution. The
actual contact undercooling, not the flux or a solid/liquid temperature
difference, is supplied to the cited two-dimensional nucleation law:

```text
Delta T_Gamma = max(0, -mean(u_Gamma,solid, u_Gamma,liquid))
dot(N_layer) = B Delta T_Gamma exp(-A / Delta T_Gamma) / h.
```

Each explicit six-facet loop retains an ordinal layer. Its inward velocity is
`beta_step Delta T_i`, where `Delta T_i` is reconstructed and averaged on that
loop's own vertical step-front slab. A completed oldest loop becomes one full
layer without moving the remaining fronts between slabs. Birth times,
fractional clock phase, strict nesting, and crossings remain explicit
diagnostics; fractional clock progress creates no partial geometry or latent
heat.

The observational scalar is a deterministic view of that authoritative state.
With outer polygon `P_0`, active inner polygons `P_j`, completed count `N`, and
one closed base layer, its solid set is

```text
S = P_0 x [0, (1 + N) h]
    union_j (P_0 minus P_j)
            x [(1 + N + j) h, (2 + N + j) h].
```

The signed union level is mapped to `+1` solid and `-1` liquid across a fixed
extraction-only transition band. This band is not a phase-field interface
width, and the scalar never changes heat, steps, or the swept-volume ledger.
The fixed carrier resolves `h` with four samples, preserves the reciprocal
facet frame and analytic volume, encloses at most eight total layers, and has
a predeclared GPU vertex capacity. The first screen advances the same reduced
model to its fixed evaluation time in 1600 numerical steps and retains step 0,
every 100 steps, and the final step.

The fixed 1600-step Candidate 2C screen is complete. It retained step 0 and
every 100-step checkpoint through step 1600 for 17 GPU extractions. All
thermal-step and observational-scalar values remained finite, the explicit
terrace state reported no crossings, and GPU marching cubes reported neither
capacity overflow nor uncaptured WebGPU errors. At the final checkpoint there
were six active terraces and three resolved terraces, opening depth was
`0.75`, and the extracted mesh contained `333636` vertices and `111212`
triangles. The normalized energy residual was `1.6281e-13`, and raster geometry
relative error was `1.49e-15`. The predeclared classification is
`hopper-mechanism-candidate`.

This result shows that one fixed uncalibrated Candidate 2C configuration and
discretization survives the observational-scalar and production GPU-extraction
path while retaining a resolved open terrace sequence. It does not establish a
bismuth trijunction nucleation law, calibrate the heat-transfer or kinetic
coefficients or step height, demonstrate screen-level spatial or internal-seed
robustness, or accept product morphology. The next scientific boundary was
time-only refinement with the screened physical configuration and source
closure held fixed.

Before inspecting the half-time-step arm, the screen-level temporal envelope
is fixed as follows. The `1600`-step and `3200`-step arms must align at the same
17 physical times within `1e-12`. Emitted, completed, active, and resolved
terrace counts, opening depth, birth ordinals, and final topology must match
exactly at aligned checkpoints. Maximum layer-clock drift is `0.15` layer,
maximum matched birth-time drift is `0.05`, and maximum matched loop-offset
drift is `5%` of facet inradius. Contact temperature, flux jump, cumulative
external heat, analytic and rasterized swept volume, and cumulative latent heat
may each differ by at most `5%` under `|a-b| / max(1, |a|, |b|)`. Both arms
must remain finite, crossing-free, and classified
`hopper-mechanism-candidate`; normalized energy, raster-geometry, and latent
ledger residuals must remain at or below `1e-10`. These tolerances are frozen
before the refined result and do not authorize coefficient tuning.

The half-time-step arm passes that envelope. Both arms remain
`hopper-mechanism-candidate`; emitted, completed, active, and resolved terrace
counts and opening depth match at every checkpoint, birth/completion ordering
is unchanged, and no crossing occurs. Maximum physical-time misalignment is
`4.4853e-14`, layer-clock drift is `3.6576e-4`, matched birth-time drift is
`7.3131e-5`, normalized loop-offset drift is `2.9994e-5`, and the largest
continuous-state difference is `4.1061e-4`. The largest normalized ledger
residual is `1.1475e-12`. Both final arms have six active terraces, three
resolved terraces, and opening depth `0.75`. GPU marching cubes extracts the
17 refined checkpoints at steps 0, 200, ..., 3200 without overflow or
uncaptured WebGPU errors; the final mesh remains `333636` vertices and
`111212` triangles. This establishes screen-level temporal robustness only;
spatial refinement, internal seeds, calibration, and product morphology remain
open.

## Bismuth acceptance gate

Predeclare numeric envelopes before tuning. At minimum assess:

- normalized dominant-opening depth and projected/solid fill;
- connected nested terrace contours and their continuity;
- agreement with supported facet directions;
- robust maturity relative to the seed, not one longest ray;
- one dominant connected component and adequate boundary clearance;
- stability under grid/time refinement and several internal seeds.

Fixed-view reference review is required for final morphology, but an attractive
image cannot override failed numerical or physical gates.

## Conditional physics

High-purity bismuth may use twin-plane re-entrant growth, and real specimens
may contain multiple domains, dislocations, convection, or finite-reservoir
effects. None is assumed in advance. Add a twin, step, defect, orientation,
transport, or surface-incorporation field only when a primary source or an
isolated failure shows what the field must explain. A twin is at least two
orientation domains at one site, not a scalar decoration.

## Numerical rules

- Treat grid spacing and time step together and reject unstable explicit
  configurations before dispatch.
- Keep internal randomness seeded and deterministic.
- Do not hide instability with unreviewed clamping, smoothing, remeshing, or
  artistic post-processing.
- Record deliberate departures from cited models here, near the equations
  they affect; do not preserve run transcripts as documentation.
- Repeat source review only when an equation, constant, boundary, or scientific
  assumption changes.
