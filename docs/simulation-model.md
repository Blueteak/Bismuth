# Simulation Model

## Product boundary

The goal is a physically motivated, single-site bismuth hopper with a deep open
recession, nested terraces, coherent bismuth facets, and plausible asymmetry.
The accepted model must generate those traits during growth. Mesh carving,
stamped terraces, decorative spirals/noise, or overlapping cosmetic crystals
cannot satisfy the gate.

The code currently contains two separate scientific tracks:

- A completed generic cubic alloy hopper used only as runtime and extraction
  scaffolding.
- Candidate 2A, the active bismuth thermal/free-surface model under isolated
  CPU development.

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

## Active Candidate 2A model

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
partial_n u = -Bi (u - u_air)
u_ghost = u_surface - dx Bi (u_surface - u_air)
```

This boundary changes heat flux; it never stamps or multiplies local phase
growth. Turning the boundary off removes its excess contact-line signal in the
isolated deterministic case.

Candidate 2A defines surface energy `gamma(n)` independently from attachment
kinetics `beta(n)`. Its slow directions use the observed `{1-102}` hexagonal
family, equivalent to `{110}` in the rhombohedral cell, derived as reciprocal
plane normals from the corrected 298 K lattice constants. Current contrast
values are dimensionless discriminators, not calibrated bismuth properties.

## Next mathematical gate

Before any 3D Candidate 2 morphology run:

1. Put `gamma(n)` and `beta(n)` into a variational anisotropic phase operator;
   a local mobility multiplier is not an equivalent construction.
2. Derive the normalization, capillary/critical-size interpretation, and an
   explicit stability bound for that operator.
3. Define a surface-attached diffuse or pre-relaxed seed consistent with the
   chosen energy. Do not reuse the generic spherical-seed calibration.
4. Demonstrate rotated planar-front covariance and grid/time refinement with
   the smallest deterministic tests that protect the derivation.

Only then may a cheap 3D screen test whether one initial site stays connected,
clear of the boundary, and develops an increasingly deep dominant opening.

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
