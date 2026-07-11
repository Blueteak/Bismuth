# Simulation Model

## Scientific baseline

The first solver must reproduce the three-dimensional faceted hopper model described by Bollada, Jimack, and Mullis, "Phase field modelling of hopper crystal growth in alloys" (2023). The model evolves a phase field and a chemical-potential field with strongly faceted cubic anisotropy. It demonstrates equilibrium-like cubes, hopper forms, and dendritic transitions as transport and driving parameters change.

The paper is a physically motivated hopper model, not a quantitatively calibrated bismuth process model. Its authors identify bismuth as a plausible material for analogous behavior but also state that hopper formation is incompletely understood. Product copy and developer documentation must preserve that distinction.

## Reference transcription requirement

Before implementing kernels, transcribe into a reviewable engineering note or source comments:

- Phase evolution equation.
- Chemical-potential evolution equation.
- Double-well and interpolation functions and derivatives.
- Faceted anisotropy and regularization.
- Parameter table and nondimensional meanings.
- Initial phase and chemical-potential fields.
- Far-field and symmetry/boundary conditions.
- Published hopper parameter sets.
- Spatial and temporal discretization described in the paper and supplement.

Use the paper PDF and supplementary material directly. Do not rely on equations copied through search snippets or OCR without checking the rendered source.

## Initial single-crystal model

- Use one centered spherical seed.
- Use one global crystal orientation.
- Use the published cubic/faceted anisotropy.
- Simulate the full 3D domain in the product path; do not rely on octant symmetry because later stochastic perturbations and clusters break it.
- Keep the far boundary sufficiently distant from the growing surface to avoid contaminating the transport field.
- Start from published nondimensional constants and hopper-producing parameter sets before tuning.

The paper does not model nucleation. Initial product uniqueness may perturb permitted initial or boundary conditions with deterministic, bounded noise, but only after the unperturbed baseline is reproduced. Noise must not be introduced as a substitute for correct instability.

## Discretization

The initial browser solver should use a uniform Cartesian grid because it maps predictably to WebGPU storage textures. Adaptive mesh refinement is out of scope for the first solver.

Required properties:

- Ping-pong resources; never read and write the same field sample within one update pass.
- Explicitly defined stencil and boundary sampling.
- A time step tied to grid spacing and a documented stability criterion.
- Separate compute stages when updated phase values or phase rate are required by the transport equation.
- No unreviewed value clamping. If bounds enforcement becomes necessary, document its numerical effect and validate it against the CPU reference.
- Non-finite detection through bounded reductions or summary buffers rather than full readback.

## Resolution and convergence

Grid size, domain size, grid spacing, interface width, and time step form one numerical configuration. A `256^3` grid is not automatically a "higher graphics setting" than `128^3`; changing it can change morphology.

For each candidate configuration:

- Hold the nondimensional physical domain and model parameters consistently.
- Record grid spacing, interface width in cells, time step, total simulated time, and boundary distance.
- Compare solid volume, bounding extent, symmetry, center depression, edge/corner advancement, and surface characteristics.
- Verify that the hopper form is not a grid-alignment or under-resolution artifact.

The default resolution remains deferred until this comparison and live benchmarks are complete.

## Solidification time and oxidation input

Maintain a field initialized to an "unborn" sentinel. When phase first crosses the selected solidification threshold, store simulated time once. Do not continuously overwrite it.

Marching-cubes vertices sample or interpolate this field to obtain surface birth time. Surface age is current simulated time minus birth time. This age is a rendering input only; oxide appearance must not feed back into the phase-field equations.

## Completion

The reference far-field driving condition can continue supplying growth. Product completion is therefore a presentation boundary:

- Stop when occupied bounds reach a calibrated fraction of the simulation domain.
- Include a hard maximum simulated time and a failure/slow-growth diagnostic.
- Freeze the latest valid surface when stopped.
- Do not reinterpret product completion as thermodynamic equilibrium or finite-melt exhaustion.

## Determinism

- Each run has an internal seed.
- Random generation must be stable for a pinned implementation and configuration.
- Tests and developer tools can provide a seed explicitly.
- The public interface neither displays nor persists the seed.

## Multi-grain extension

Do not implement a hero cluster by rendering independent single-crystal meshes through one another. Differently oriented grains require a documented multiphase or orientation-field formulation coupled through shared transport and interfacial rules.

Before implementation:

- Select and cite a defensible multiphase/orientation-field extension.
- Define grain-boundary behavior and phase normalization.
- Determine how grain count affects memory and compute.
- Validate one dominant nucleus plus a bounded set of secondary nuclei.
- Compare single-dominant and clustered distributions against the curated specimen references.

This extension is allowed to go beyond the single-field paper, but the extension and its physical interpretation must be explicit.

## Required numerical evidence

- CPU/GPU small-grid agreement.
- Deterministic repeatability.
- Stability and finite-value checks.
- Published morphology transition reproduction.
- Resolution/convergence comparison.
- Morphology metrics across a fixed seed suite.
- Performance data separated by solver, extraction, and rendering work.
