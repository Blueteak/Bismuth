# Bismuth Visualizer Plan

## Objective

Deliver a stateless browser experience that visibly grows a plausible
lab-grown bismuth hopper specimen in real time, extracts its surface on the
GPU, and renders age-driven metallic iridescence.

## Current gate: bismuth morphology

The generic cubic solver, live GPU extraction, continuous controller, and
initial material path exist. They are infrastructure, not product approval.
Milestone 1B blocks later presentation work until one initial site produces a
connected, deeply open, stepped bismuth hopper from cited physics.

Candidate 1 is closed and rejected. Candidate 2A is the active one-domain,
thermal/free-surface path. Its next implementation slice is:

1. Insert independent surface-energy `gamma(n)` and kinetic `beta(n)` laws
   into a variational anisotropic phase operator.
2. Derive its normalization and explicit stability bound.
3. Define a consistent surface-attached diffuse or pre-relaxed seed and a
   critical-size measure.
4. Pass rotated planar-front grid and time refinement.
5. Only then run a cheap 3D morphology screen.

No twin, step, defect, or orientation field is authorized unless the
one-domain isolation or reference evidence demonstrates that it is necessary.

## Milestones

### Foundation - complete

React/Vite/TypeScript scaffolding, Express serving, WebGPU capability failure,
the supplied HDRI, and the imperative controller boundary are in place.

### Generic numerical scaffold - complete

The published cubic phase-field model produces a deterministic faceted hopper
and remains a regression baseline. The broader paper transition investigation
is closed; fractal and dendritic outcomes were not reproduced and are not
future acceptance gates.

### GPU extraction and live integration - complete infrastructure

Marching-cubes classification, compaction, vertex emission, normals, surface
age, bounded promotion, and the controller-owned live path are implemented.
Full-volume production readback remains prohibited.

### Bismuth-specific single crystal - current

Exit criteria:

- The model uses documented bismuth crystallography and growth mechanisms.
- One initial site produces a connected, deep opening with nested continuous
  terraces and coherent facet directions.
- The morphology survives sensible grid/time refinement and several internal
  deterministic seeds without boundary contact.
- Acceptance does not depend on post-processed or decorative geometry.
- The live extracted result remains visibly continuous at an acceptable rate.

### Material, camera, and public lifecycle - next

Resume only after the morphology gate. Calibrate the provisional oxide curve,
metal response, environment, and fixed-target camera against references. Then
wire automatic start, `Stop`, completion, and `Regenerate` into the public
root, including resource disposal and honest device-loss states.

### Multi-orientation specimen - later

Add secondary orientations only through a documented multiphase or
orientation-field model with shared transport. Do not overlap cosmetic meshes.

### Performance selection - later

Choose the production grid and presentation cadence from the accepted model.
Benchmark only when making that choice; present fidelity, duration, memory,
and update-rate tradeoffs before changing equations or resolution.

### Deployment - later

Serve the Vite build through Express on Ubuntu EC2 behind trusted HTTPS. Keep
the server stateless: no database, queue, session store, authentication, or
server-side solver is required.

## Persistent gates

- Exact `three@0.185.0`; current desktop Chrome/Edge with WebGPU.
- No silent fallback, full production readback, or React-driven frame loop.
- No product screenshots or approval using the generic cubic hopper.
- No public controls beyond the documented contract without approval.
- No tuning of numerical gates after seeing a candidate result.
- No artistic geometry used to compensate for missing physics.
