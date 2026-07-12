# Decision Log

## Confirmed decisions

| ID    | Decision                                                                                                                   | Rationale                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Start from current documentation and new code; do not inspect previous iterations or history.                              | The previous direction was rejected and must not bias the design.                                                                                    |
| D-002 | Target a plausible, visually polished experience grounded in physical mechanisms.                                          | Growth and recognizable hopper morphology matter more than quantitative process prediction.                                                          |
| D-003 | Implement the published 3D hopper phase-field equations before reduced or procedural models.                               | Establish a credible morphology baseline before art direction.                                                                                       |
| D-004 | Validate one single-orientation crystal before adding a cluster.                                                           | The reference paper is single-field; multi-orientation clusters require a separate extension.                                                        |
| D-005 | Target a hero specimen with a dominant grain and a few secondary nuclei, calibrated from references.                       | This supports common clustered forms without assuming every specimen is densely multi-grain.                                                         |
| D-006 | Use React, TypeScript, Vite, Three.js `0.185.0` (r185) WebGPURenderer, and TSL.                                            | Separates testable UI from GPU compute/rendering while retaining Three.js PBR tooling.                                                               |
| D-007 | Require WebGPU on current desktop Chrome/Edge.                                                                             | Full 3D live simulation and GPU extraction are core requirements; a fallback would be a separate product.                                            |
| D-008 | Run the solver live rather than precomputing and replaying growth.                                                         | The visible surface should represent the current simulated field.                                                                                    |
| D-009 | Extract a GPU mesh with marching cubes.                                                                                    | Enables standard physical materials, shadows, depth, and post-processing without CPU readback.                                                       |
| D-010 | Treat grid resolution as a numerical configuration, not a public graphics slider.                                          | Resolution affects solver stability and morphology.                                                                                                  |
| D-011 | Drive rainbow coloration from a surface-age oxidation model during growth.                                                 | Produces evolving thin-film color without adding temperature/oxygen kinetics.                                                                        |
| D-012 | Use an invisible studio HDRI, black background, and one directional self-shadow light.                                     | Provides readable metallic reflections without scene geometry.                                                                                       |
| D-013 | Use a fixed camera distance/target with auto-orbit that stops after user interaction.                                      | Growth may fill or exceed the frame; no automatic dolly is desired.                                                                                  |
| D-014 | Begin the first run automatically after initialization.                                                                    | The experience should immediately demonstrate growth.                                                                                                |
| D-015 | Use one bottom-center action: Stop while running, Regenerate otherwise.                                                    | Regeneration is the primary interaction; paused runs do not resume.                                                                                  |
| D-016 | Stop automatically at a calibrated domain-extent threshold.                                                                | The reference far-field condition does not naturally finish a finite specimen.                                                                       |
| D-017 | Keep random seeds internal and public runs disposable.                                                                     | Reproducibility is needed for tests, not as a user feature initially.                                                                                |
| D-018 | Keep diagnostics developer-only.                                                                                           | The public experience should remain polished and minimal.                                                                                            |
| D-019 | Do not support export.                                                                                                     | The mesh can remain GPU-resident and the product stays focused on visualization.                                                                     |
| D-020 | Develop primarily on Windows and deploy later with Express on Ubuntu EC2.                                                  | Matches the available environment and preferred production operations.                                                                               |
| D-021 | Use repository-root `hdri.jpg`, provided by the user, as the initial environment source.                                   | Avoids unapproved asset selection or download during scaffolding.                                                                                    |
| D-022 | Let the scaffolding agent choose latest stable, non-prerelease compatible toolchain versions other than Three.js.          | Keeps the bootstrap current while requiring exact pins and recorded choices.                                                                         |
| D-023 | Run reference hardware WebGPU tests in the local Codex in-app browser without software/unsafe forcing flags.               | Keeps numerical and performance evidence tied to the requested local browser surface and real Windows GPU.                                           |
| D-024 | Import the repository-root JPG through Vite as the initial sRGB equirectangular reflection environment.                    | Preserves the supplied source while producing a content-hashed, immutable production asset.                                                          |
| D-025 | Keep agent-facing Markdown ASCII-only.                                                                                     | Prevents Windows PowerShell encoding ambiguity during handoff.                                                                                       |
| D-026 | Use the source-traceable cubic scale `1 / [3 (1 + epsilon)^2]` and document the active Fortran branch's extra `A0` factor. | The paper omits the scale; the current Fortran centered-Hessian formula is close to, but not identical with, a globally scaled paper energy.         |
| D-027 | Use an explicit conservative face-flux stencil and integrate the split chemical source as exact `Delta g`.                 | Shared face fluxes avoid odd/even decoupling; exact `Delta g` preserves the phase-change source under operator splitting.                            |
| D-028 | Apply homogeneous Neumann `phi` and a fixed Dirichlet `mu` reservoir at the full-domain boundary.                          | Makes the browser boundary choice explicit, follows the paper's far-field driving statement, and avoids relying on octant symmetry.                  |
| D-029 | Permit only deterministic smooth perturbations to physical initial or far-field conditions for Step 1 irregularity.        | Seed shape, initial chemical-potential heterogeneity, and reservoir gradients can seed physical instability without altering final geometry.         |
| D-030 | Treat the scalar cubic hopper as a generic single-crystal baseline, not a calibrated model of real bismuth.                | Bismuth-specific facets, screw spirals, twins, and differently oriented intergrowths require additional kinetic, defect, or orientation physics.     |
| D-031 | Require an explicit expected morphology and transition-specific descriptors for full-volume checkpoints.                   | A one-cell recession allowed a nearly filled cube to pass the old hopper gate; each transition class now has separate internal acceptance checks.    |
| D-032 | Keep the author-centered anisotropy stencil as a developer-only A/B option; retain conservative face fluxes by default.    | The centered CPU/GPU path is source-faithful and changes morphology, but the `D_L = 4`, `t = 500` run still fails the expected dendrite gate.        |
| D-033 | Use octant symmetry and reach-based maturity only for symmetric transition validation.                                     | The paper's ten-seed-radius comparison needs more physical extent than a full `256^3` grid provides; octant mode rejects symmetry-breaking inputs.   |
| D-034 | Use a deterministic `128^3` hopper profile with a `25000 ms` wall budget for per-edit solver screening.                    | Its fixed-domain `256^3` pair has close scale-aware morphology metrics; full-resolution runs remain required for scientific promotion and gates.     |
| D-035 | Use a separate calibrated `D_L = 4`, `t = 350` screen and do not promote the mature `dt = 0.005` run.                      | The `128^3` screen scales to its `256^3` spatial pair, but halving `dt` changes no reach metric and produces a smaller signal than spatial mismatch. |
| D-036 | Keep coupled backward Euler CPU-only and do not promote a production integrator or mature GPU run.                         | At two time steps and on two domains its converged effect scales first-order but consistently reduces diagonal/face reach.                           |
| D-037 | Close Milestone 1 around the validated single-hopper objective after recording the complete transition investigation.      | Cube and hopper pass, while fractal and dendritic fail fixed gates; adaptive BDF2/Float64 reproduction is a separate fidelity expansion.             |
| D-038 | Expose explicit internal seeds only in the developer morphology runner and retain a four-seed quick validation suite.      | Four distinct hopper seeds pass in under 16 seconds each without turning seeds into a public product control.                                        |
| D-039 | Treat continuous live mesh promotion as a cross-milestone product gate: target `30 /s`, block below `15 /s`.               | Watching growth is a primary feature; render frames over a stale mesh and isolated extraction-kernel timings do not demonstrate continuous growth.   |
| D-040 | Point the local review launcher at the most advanced integrated developer visualization until final presentation.          | Review should show current mesh-generation progress without prematurely exposing developer fixtures through the production root.                     |

## Deferred decisions

These must not be resolved silently when they materially affect product behavior or scientific fidelity.

| ID    | Deferred decision                                                | Required evidence or trigger                                 |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| X-001 | Default grid size and workgroup configuration                    | Solver convergence, memory, and RTX 5080 benchmarks          |
| X-002 | What to sacrifice if the validated solver misses 25-60 seconds   | Measured resolution/duration/fidelity alternatives           |
| X-003 | Final marching-cubes use versus dual contouring                  | Facet-quality review after solver convergence                |
| X-004 | Exact oxide-age curve and thickness range                        | Fixed-seed material studies against references               |
| X-005 | Public morphology controls                                       | Stable parameter ranges with predictable outcomes            |
| X-006 | HDRI selector and additional environments                        | Core experience approved with one preset                     |
| X-007 | Secondary nucleus count, timing, and distribution                | Multi-grain model cost and curated reference analysis        |
| X-008 | HTTPS termination and infrastructure automation                  | Deployment phase requirements                                |
| X-009 | Bismuth-specific facet set and attachment-kinetic calibration    | Primary experimental data and renewed convergence tests      |
| X-010 | Defect/orientation representation for spirals, twins, and grains | A cited model, GPU cost study, and isolated validation cases |

## Decision-change process

When changing a confirmed decision:

1. Record the reason and evidence.
2. Update this log, `PLAN.md`, and every affected focused document.
3. Add or update tests that demonstrate the new behavior.
4. Call out scientific-model deviations explicitly.
