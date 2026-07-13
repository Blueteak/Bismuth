# Architecture

## Runtime shape

The browser owns all simulation and rendering. Express only serves the built
application and `/healthz`.

```text
React shell -> imperative visualizer controller
                  |-> simulation compute
                  |-> surface extraction
                  |-> promoted GPU mesh
                  |-> material and renderer
```

The public application requires WebGPU. Unsupported or failed initialization
must produce an honest UI state, never a hidden CPU or WebGL simulation.

## Ownership

### React

React owns loading/error presentation, public controls, accessibility, and
coarse run-state display. It does not own the render loop, camera transforms,
simulation fields, GPU buffers, or per-frame uniforms.

### Visualizer controller

The controller owns the canvas, renderer, scene, camera, render scheduling,
run lifecycle, solver/extractor orchestration, resize, and disposal. Public UI
events call coarse controller methods; high-frequency state stays imperative.

### Simulation

The simulation layer owns equations, configuration validation, boundaries,
initial conditions, deterministic randomness, field textures, time stepping,
and completion checks. Candidate 2A, Candidate 2B, and Candidate 2C remain
isolated from the generic cubic solver. Candidate 2C owns its faceted
thermal-step state and deterministic observational scalar reconstruction. The
scalar may be exposed to development extraction, but it never feeds back into
simulation or acts as a production CPU fallback.

### Extraction

The extraction layer classifies marching-cubes cells, scans and compacts active
work, emits vertices/normals/surface age, enforces capacity, and updates
indirect draw state. Overflow retains the last valid mesh.

### Rendering

The rendering layer owns WebGPU capability setup, the environment, lights,
materials, tone/exposure choices, and the surface-age-to-oxide mapping. It may
read extracted attributes but never writes simulation state.

## GPU resource rules

- Keep production fields and meshes GPU-resident.
- Small summaries may be read for diagnostics; full volumes and meshes may not
  be read every frame or exposed as a product path.
- Allocate run-scoped resources once where practical and reuse them.
- Double-buffer solver fields and promotion targets when in-flight work can
  overlap.
- Dispose renderer, textures, buffers, observers, listeners, and run state on
  regeneration, device loss, or teardown.

## Scheduling

Simulation, mesh promotion, and rendering are related but separate cadences.
A render frame over a stale mesh is not visible growth. The controller advances
bounded solver batches, extracts/promotes their latest field, and renders the
last valid mesh while work continues. React reconciliation is never part of
that loop.

## Run lifecycle

```text
loading -> growing -> stopped
             |          |
             +--Stop----+
                        +--Regenerate--> loading/growing
```

Automatic completion and manual Stop share the same stopped state. Stopped
runs remain orbitable but cannot resume. Regenerate resets or recreates all
run-scoped resources and chooses a new internal deterministic seed.

## Developer and production surfaces

`/__dev/material` is the single integrated development view. It is loaded only
in development builds and is not a second product UI. The public root stays
neutral until accepted bismuth morphology and lifecycle work are integrated.

The development snapshot bridge is model-neutral. In the next Candidate 2C
review it receives each retained observational scalar checkpoint, uploads it
through a storage buffer into a 3D storage texture, and uses the existing GPU
classifier, compaction, vertex emission, last-valid promotion, and indirect
draw path. The authoritative faceted state remains separate, and only the
small extraction summary is read back. The bridge neither reads a full GPU
field nor inserts the CPU solver into the production controller.

The production server serves Vite's hashed assets and the application shell
from absolute paths, exposes `/healthz`, and stays stateless behind trusted
HTTPS termination.
