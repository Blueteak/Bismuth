# Architecture

## Runtime

Browser owns simulation/rendering. Express serves build + `/healthz` only.

```text
React shell -> imperative controller
                  |-> simulation
                  |-> extraction
                  |-> promoted GPU mesh
                  |-> material/renderer
```

WebGPU required. Initialization failure -> honest UI; never hidden CPU/WebGL.

## Ownership

- React: load/error UI, public controls, accessibility, coarse run state. Never
  loop, camera, fields, GPU buffers, per-frame uniforms.
- Controller: canvas, renderer, scene, orbit camera, scheduling, lifecycle,
  solver/extractor orchestration, resize, disposal. UI calls coarse methods;
  high-frequency state stays imperative.
- Simulation: equations, config validation, boundaries, initial state,
  deterministic RNG, fields, stepping, completion. Active morphology:
  Candidate 2D target-matched envelope, partial ledges/heads, exact swept
  volume/latent ledger. Generic + 2A-2C remain isolated evidence. Dev scalar may
  feed extraction only; never simulation feedback/production CPU fallback.
- Extraction: classify, scan/compact, emit vertices/normals/age, cap capacity,
  indirect draw. Overflow -> keep last valid mesh.
- Rendering: WebGPU, environment, lights, material, tone/exposure, age->oxide.
  Read extracted attributes; never mutate simulation.

## GPU rules

- Production fields/meshes GPU-resident. Small diagnostic readback only; no
  per-frame full volume/mesh readback or product exposure.
- Allocate/reuse run resources; double-buffer fields/promotion when overlap.
- Dispose renderer, textures, buffers, observers, listeners, run state on
  regenerate, device loss, teardown.

## Scheduling/lifecycle

Simulation, promotion, rendering: separate cadences. Rendering stale mesh !=
visible growth. Controller advances bounded batches, extracts/promotes latest,
renders last valid mesh; no React reconciliation.

```text
loading -> growing -> stopped
             |          |
             +--Stop----+
                        +--Regenerate--> loading/growing
```

Completion and Stop share `stopped`; orbitable, never resumable. Regenerate
recreates/resets run resources + chooses new deterministic internal seed.

## Surfaces

`/__dev/material`: development-only integrated view, not second product UI.
Public root stays neutral pending accepted morphology/lifecycle.

Default: Candidate 2D edge-source closeout. One canvas + model-neutral snapshot
controller sequence source-removed, initially reversed, growing, post-reversal,
final one-front states; final beside all targets. Report source,
scalar/extraction, morphology separately.

- `?mode=candidate2d-twin-evidence`: closed twin-source slice.
- `?mode=candidate2d-carrier-evidence`: rejected first Candidate 2D carrier.
- `?mode=candidate2c-evidence`: retired Candidate 2C seam.
- `?mode=material`: oxide fixture.

Dev bridge: CPU scalar -> storage buffer -> 3D storage texture -> production
classifier/compaction/emission/promotion/indirect draw; read back small summary.
Recurring full-volume upload allowed only for fixed dev proof. Production:
reconstruct from compact accepted state on GPU.

Production server: absolute Vite hashed assets + app shell + `/healthz`;
stateless behind trusted HTTPS.
