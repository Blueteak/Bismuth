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
| `review.cmd`             | Open the integrated material route             |

`package.json` is the command authority. Do not add no-op scripts or restore a
large command catalog for one-off experiments.

## Change-aware checks

| Change                        | Minimum useful evidence                         |
| ----------------------------- | ----------------------------------------------- |
| Pure refactor or docs         | Typecheck or focused check; ASCII scan for docs |
| Equation/configuration math   | Focused deterministic numerical unit tests      |
| Candidate 2 operator/seed     | Analytic or planar refinement tests             |
| Extraction/layout             | Analytic CPU topology/layout tests              |
| Scheduler/lifecycle           | Deterministic controller scheduling tests       |
| Material/oxide mapping        | Focused math tests and visual review if visible |
| GPU integration or appearance | `/__dev/material` manual smoke and screenshot   |
| Performance                   | Purpose-built measurement for that task only    |

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

## Evidence retention

Generated logs, screenshots, JSON reports, and test output are transient and
ignored. Do not copy successful run reports into `docs/`. Preserve only a
durable decision, model boundary, or unresolved next step in its owning
document. Re-run a check when current evidence is needed.
