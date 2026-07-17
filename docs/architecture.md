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
  deterministic RNG, fields, stepping, completion. Candidate 2E owns the
  authoritative GPU 3D CA fields, seed/frame table, synchronous update passes,
  shared supply, capture/impingement, mass/latent ledger. Retired candidates
  remain doc summary only.
- Extraction: classify, scan/compact, emit vertices/normals/age, cap capacity,
  indirect draw. Overflow -> keep last valid mesh.
- Rendering: WebGPU, environment, lights, material, tone/exposure, age->oxide.
  Read extracted attributes; never mutate simulation.

## GPU rules

- Production fields/meshes GPU-resident. Small diagnostic readback only; no
  per-frame full volume/mesh readback or product exposure.
- Allocate/reuse run resources; double-buffer fields/promotion when overlap.
- CA ping-pong state prevents update-order dependence. Separate proposal and
  resolution passes; seed ID is tie-break only, never scan-order ownership.
- Dispose renderer, textures, buffers, observers, listeners, run state on
  regenerate, device loss, teardown.

## Candidate 2E target flow

```text
seed table (origin, frame)
          |
shared phase/fill/supply/owner/age grid + interface layer/front state
          |
adsorb/expire -> ledge capture proposals -> resolve -> consume -> age
          |
production classifier/compaction/emission/indirect draw
```

Global grid = storage/transport coordinates only. Local morphology rule receives
the owner's inverse frame transform. Same-owner fronts merge; different owners
form boundaries on impingement; all owners deplete the same supply field. No
per-seed mesh overlap or independent transport domain.

Current code has the reusable grid/frame/ledger seam and experimental
facet-local front/handoff state. Test 2 produces only a thin shell; it is not
current product architecture.

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

Default: frozen failed Candidate 2E.2 sparse edge-source Test 1 beside all five
targets. `?checkpoint=early|middle|final`; `?mode=material`: oxide fixture.
Retired evidence routes are removed.

Dev bridge: CPU scalar -> storage buffer -> 3D storage texture -> production
classifier/compaction/emission/promotion/indirect draw; read back small summary.
Recurring full-volume upload allowed only for fixed dev proof. Production:
CA state evolves and feeds extraction on GPU.

Production server: absolute Vite hashed assets + app shell + `/healthz`;
stateless behind trusted HTTPS.
