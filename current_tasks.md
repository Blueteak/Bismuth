# Current Tasks

Updated 2026-07-13.

## Status

The active blocker remains Milestone 1B: replace the generic cubic regression
hopper with a bismuth-specific one-nucleus model. Solver, extraction,
controller, and initial material infrastructure already exist. The public root
remains neutral, and `/__dev/material` is the only retained integrated review
route.

Candidate 1 is rejected and its generic-solver support has been removed. A
direct rhombohedral remapping selected the wrong physical construction and
grew an extreme boundary-limited body; do not restore or retune it.

Candidate 2A now has the sourced variational anisotropic phase operator,
directional thin-interface kinetics, an explicit stiffness/stability bound,
and a volume-constrained surface-attached seed. Flux/energy differentiation,
strong ellipticity, seed energy/volume behavior, and rotated planar grid/time
refinement pass deterministic checks.

Candidate 2B now isolates Albani et al.'s quasi-stationary surface-adatom
incorporation mechanism on an unfolded side-top-side surface. Borrowing Figure
9's dimensionless `tau_side / tau_top = 10` and `F = 0.5` while deliberately
making supply uniform, tangential surface diffusion raises top-perimeter
velocity `120.40%` above the top core.
Supply balance closes to `1.18e-13`, the equation residual is `5.72e-13`, the
signal reverses with the directional contrast, and aligned grid refinement
stays inside its predeclared `1%` envelope. This establishes a nonlocal
rim-feeding mechanism; it does not calibrate bismuth or couple that mechanism
to Candidate 2A. Direct bismuth evidence instead favors interface-reaction and
layer/step growth, so Candidate 2B is retained but no longer the active path.

Candidate 2C now owns the reduced faceted path end to end. A closed 3D
cell-centered heat field supplies full thermal capacity without a fitted
effective depth. The phase-specific solid-air/liquid-air flux jump selects the
outer source, the actual contact and step-front temperatures drive layer birth
and motion, and the same exact swept prisms return latent heat once. Equal
surface coefficients remove the excess source, reversal reverses it, and the
conservation, strict-topology, event-clock, and independent refinement gates
pass.

The Candidate 2C observational scalar carrier reconstructs one closed base and
the authoritative completed/active faceted layers on a fixed extraction grid.
It preserves analytic volume, all six facet supports, connectedness,
watertight genus-zero topology, capacity, and resolution convergence. The
scalar never feeds back into the thermal-step state and does not reuse
Candidate 2A as a morphology carrier.

The fixed Candidate 2C scalar/GPU screen and its half-time-step arm pass the
predeclared screen-level temporal envelope. Both remain
`hopper-mechanism-candidate`; all discrete terrace states match at the 17
aligned physical checkpoints, and the refined GPU extractions remain finite,
overflow-free, and error-free. This advances the active blocker from temporal
to spatial robustness. Candidate 2C remains uncalibrated and is not accepted
product morphology; the durable measurements are recorded in
`docs/simulation-model.md`.

Candidate 2A's first predeclared 3D screen is complete and classified
`non-hopper`. Its coupled fields stayed finite, the solid remained
single-component and surface-attached, and it stayed clear of the five far
boundaries. Diffuse maturity reached `1.1259`, but normalized opening depth was
exactly zero at every 100-step checkpoint. At the final checkpoint the central
height was `10.6472` while the rim was `8.2587`: the core grew ahead of the
rim, which is the opposite of the required recession. GPU marching cubes
extracted all 17 review checkpoints without overflow or uncaptured WebGPU
errors. No Candidate 2 morphology is accepted.

The exact relaxed 3D seed now also has a frozen-phase thermal discriminator
and a resolved opening-force projection. The solid/liquid surface-flux sign is
implemented correctly, but the selected contrast does not localize cooling at
the surface rim. At the actual solid/liquid interface its opening component
does point in the intended direction, yet the smooth Candidate 2A variational
term heals a two-interface-width terrace orders of magnitude faster than the
thermal term amplifies it. This closes another smooth Candidate 2A retune as
the generation path. The injected terrace is a stability probe only and must
never enter the morphology screen or GPU review route.

## Next implementation slice

1. Freeze the successful `1600`-step screen as the base and predeclare the
   screen-level spatial comparison envelope before inspecting another result.
2. Run the existing independent spatial arm at shape `[160, 96, 160]` and
   spacing `0.1875` for the same `1.5` physical duration, `0.0009375` time step,
   and 17 checkpoint times. Keep physical domain extent, initial state,
   coefficients, step height, source closure, observational carrier grid,
   extraction isovalue, camera, and GPU capacity fixed.
3. Compare authoritative state first, including source geometry resolution,
   birth/completion ordering, terrace counts, opening depth, swept/latent
   volume, energy residual, finiteness, and crossings. Require both arms to
   remain `hopper-mechanism-candidate` inside the frozen envelope before the 17
   fixed-carrier GPU extractions are interpreted.
4. A pass promotes to several internal deterministic seeds. A failure returns
   to the spatial thermal-step coupling boundary, not coefficient tuning or
   scalar carving. If explaining a failure would require additional chemical,
   defect, or orientation state, stop for an explicit fidelity-versus-GPU-
   realtime decision before adding it.

Keep twins, dislocations, and multiple orientations deferred until the
single-domain outer-step path fails or evidence requires them. Keep material
calibration, public lifecycle work, clustering, performance selection, and
deployment paused until bismuth morphology passes.

## Working loop

```powershell
npm.cmd run check:fast
npm.cmd run check:baseline
review.cmd
```

Use `check:fast` while editing and `check:baseline` before handoff. Run the
review surface only for changes that affect GPU integration or appearance.
The retained morphology review compares the fixed Candidate 2C screen with its
half-time-step arm first, then promotes the refined observational scalar at the
same 17 physical checkpoint times only if the authoritative gate passes. Use
`?mode=material` for the retained oxide-material fixture.
Do not create retained result transcripts; record only durable decisions or
the next unresolved boundary in this file and `docs/simulation-model.md`.
