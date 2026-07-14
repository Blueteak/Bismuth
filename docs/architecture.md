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

The controller owns the canvas, renderer, scene, orbital camera, render
scheduling, run lifecycle, solver/extractor orchestration, resize, and
disposal. Mouse orbit/zoom and camera transforms stay imperative. Public UI
events call coarse controller methods; high-frequency state stays imperative.

### Simulation

The simulation layer owns equations, configuration validation, boundaries,
initial conditions, deterministic randomness, field textures, time stepping,
and completion checks. Candidate 2D is the only active morphology path. It must
own a target-matched outer carrier, explicit partial ledge paths and step heads,
and exact swept-volume/latent accounting. The generic solver and Candidates 2A
through 2C remain isolated evidence; none may supply active geometry, facets,
or acceptance. A development scalar may be exposed to extraction, but it never
feeds back into simulation or acts as a production CPU fallback.

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

The route now defaults to the current Candidate 2D twin-source closeout. One
canvas and one model-neutral GPU snapshot controller sequentially show the
source-null, initially reversed, growing, post-emission-reversal, and final
one-front states, then leave the final state visible beside all four target
images. Source isolation, scalar/extraction validity, and morphology approval
are reported separately so a valid local mechanism cannot be mistaken for a
target crystal. `?mode=candidate2d-carrier-evidence` retains the rejected first
Candidate 2D topology carrier, `?mode=candidate2c-evidence` retains the retired
Candidate 2C seam, and `?mode=material` retains the oxide fixture.

The model-neutral development bridge uploads each Candidate 2D CPU scalar
through a storage buffer into a 3D storage texture and exercises the existing
classifier, compaction, vertex emission, last-valid promotion, and indirect
draw path. Only a small extraction summary is read back. Recurring full-volume
upload is allowed only on this fixed development proof. Production promotion
still requires reconstruction from compact accepted Candidate 2D state on the
GPU.

The production server serves Vite's hashed assets and the application shell
from absolute paths, exposes `/healthz`, and stays stateless behind trusted
HTTPS termination.
