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

Candidate 1 is closed and rejected. Candidate 2A is the one-domain
thermal/free-surface path. Its variational operator, normalization/stability
bound, surface seed, critical-size measure, and rotated planar refinement are
validated. The first fixed 3D screen was numerically healthy but failed as a
`non-hopper`: the center remained ahead of the rim and opening depth stayed
zero throughout growth.

Candidate 2B validates a generic nonlocal surface-incorporation signal but is
deferred because direct bismuth evidence favors interface-reaction and layer
growth. Candidate 2C now proves the conditional geometry: if discrete ledges
are born at an outer boundary and flow inward, they generate nested terraces
and a persistent rim-over-core opening with exact swept-volume accounting.
Candidate 2A also supports the source-backed solid/liquid surface heat-flux
jump while retaining one phase velocity and one latent-heat update.

An exact-seed frozen pulse confirms the flux-jump direction but rejects its
surface rim localization. A separate resolved opening projection shows that
the intended thermal component exists at the solid/liquid interface, while the
smooth variational phase field heals the terrace overwhelmingly faster. Smooth
Candidate 2A is therefore closed as the terrace carrier; explicit ledges remain
owned by Candidate 2C.

Candidate 2C now couples its six-facet outer-source/inward-flow loops to the
phase-specific free-surface heat supply in a closed three-dimensional thermal
control volume. The signed contact-line flux jump selects the source, actual
local undercooling drives the cited step and layer laws, and the same exact
swept volume supplies latent heat. Its source null, reversal, conservation,
nested-topology, and independent grid/time refinement gates pass.

A Candidate 2C-owned observational scalar carrier reconstructs those
authoritative loops and layers as one closed extraction field without feeding
back into growth or using Candidate 2A as a terrace carrier. Its analytic
volume, facet support, connectivity, topology, capacity, and resolution gates
pass. Candidate 2C passed its first fixed rejection screen as a mechanism
candidate. Screen-level spatial refinement, several internal seeds, coefficient and
source calibration, and fixed-view reference review still block morphology
acceptance and production integration. The screen-level temporal arm passes;
spatial refinement remains. Twins, defects, and extra orientations remain
conditional.

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
