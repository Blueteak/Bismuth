# Testing and Validation

## Policy

Tests exist to protect critical equations, state transitions, data layout, and
reproduced bugs. Do not add coverage for trivial accessors, static markup, old
milestone confirmations, or speculative behavior.

The default suite is deterministic, browser-free, and hardware-independent.
Files named `gpu-*.test.ts` exercise CPU-checkable planning or buffer-layout
helpers; they do not request a GPU adapter.

## Commands

| Command                  | Use                                            |
| ------------------------ | ---------------------------------------------- |
| `npm test`               | Fast Vitest suite                              |
| `npm run check:fast`     | Tests plus TypeScript                          |
| `npm run check:baseline` | Handoff gate: fast checks, lint, format, build |
| `npm run dev`            | Public root and development review route       |
| `review.cmd`             | Open the integrated development review route   |

`package.json` is the command authority. Do not add no-op scripts or restore a
large command catalog for one-off experiments.

## Change-aware checks

| Change                        | Minimum useful evidence                          |
| ----------------------------- | ------------------------------------------------ |
| Pure refactor or docs         | Typecheck or focused check; ASCII scan for docs  |
| Equation/configuration math   | Focused deterministic numerical unit tests       |
| Candidate 2 operator/seed     | Analytic or planar refinement tests              |
| Candidate 2 mechanism probe   | Frozen heat ledger and resolved force projection |
| Candidate 2 surface transport | Balance, direction, and grid refinement tests    |
| Candidate 2 facet steps       | Event, swept-volume, and refinement tests        |
| Candidate 2 radial heat       | Source null, enthalpy, and refinement tests      |
| Candidate 2 faceted heat      | Source reversal, 3D ledger, topology, refinement |
| Candidate 2 scalar carrier    | Contour, volume, connectivity, resolution        |
| Extraction/layout             | Analytic CPU topology/layout tests               |
| Scheduler/lifecycle           | Deterministic controller scheduling tests        |
| Material/oxide mapping        | Focused math tests and visual review if visible  |
| GPU integration or appearance | `/__dev/material` manual smoke and screenshot    |
| Performance                   | Purpose-built measurement for that task only     |

Escalate from focused tests to `check:baseline` before handoff. Do not run a
hardware matrix, adapter fingerprint, long morphology sweep, or benchmark
unless the change directly concerns that behavior.

## Visual and WebGPU review

The product still requires hardware WebGPU. That does not make hardware tests
a routine development gate. For changes to pipelines, resource ownership, or
appearance, use the single `/__dev/material` surface and confirm:

- WebGPU initializes or fails honestly;
- growth visibly updates rather than rendering a stale mesh;
- the latest valid mesh survives transient capacity problems;
- resize and disposal do not produce visible or console errors;
- changed appearance is captured at a fixed view when comparison matters.

Collect adapter/browser/timing details only when diagnosing an adapter issue or
making a performance decision.

For the Candidate 2C morphology review, `/__dev/material` must compare the
fixed `1600`-step scalar screen with the half-time-step `3200`-step arm at 17
aligned physical times. It must evaluate the authoritative thermal-step state
first and skip GPU work on failure. On a pass it uploads only the refined
observational fields to the existing GPU marching-cubes path at steps 0, 200,
..., and 3200. The review must keep one fixed camera, extraction grid,
isovalue, and capacity across checkpoints, report GPU overflow honestly, and
retain only lightweight metric summaries and carrier projections.
`?mode=material` selects the oxide-material fixture. Successful extraction
validates the review seam, not bismuth calibration or morphology. This bridge
does not make the Candidate 2C CPU solver a production fallback or authorize a
full-field GPU readback.

## Evidence retention

Generated logs, screenshots, JSON reports, and test output are transient and
ignored. Do not copy successful run reports into `docs/`. Preserve only a
durable decision, model boundary, or unresolved next step in its owning
document. Re-run a check when current evidence is needed.
