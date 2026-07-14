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
| Source or facet claim         | Specimen-match audit before implementation       |
| Candidate 2D ledge path       | Continuity, turns, step heads, no self-crossing  |
| Candidate 2D swept geometry   | Exact area, volume, and latent-energy accounting |
| Candidate 2D carrier          | Opening, connectedness, topology, resolution     |
| Candidate 2D mechanism        | Isolated source null/reversal and failure mode   |
| Candidate 2D scientific slice | Frozen 3D run and all-four-reference comparison  |
| Extraction/layout             | Analytic CPU topology/layout tests               |
| Scheduler/lifecycle           | Deterministic controller scheduling tests        |
| Material/oxide mapping        | Focused math tests and visual review if visible  |
| GPU integration or appearance | `/__dev/material` manual smoke and screenshot    |
| Performance                   | Purpose-built measurement for that task only     |

Escalate from focused tests to `check:baseline` before handoff. Do not run a
hardware matrix, adapter fingerprint, long morphology sweep, or benchmark
unless the change directly concerns that behavior.

## Visual and WebGPU review

The product still requires hardware WebGPU. A hardware matrix is not a routine
development gate, but one current-desktop WebGPU run is mandatory at the end
of every Candidate 2D scientific slice. Use the single `/__dev/material`
surface and confirm:

- WebGPU initializes or fails honestly;
- growth visibly updates rather than rendering a stale mesh;
- the latest valid mesh survives transient capacity problems;
- resize and disposal do not produce visible or console errors;
- changed appearance is captured at a fixed view when comparison matters.

Left-drag orbits and the wheel zooms on every 3D canvas. Browser automation
may use `window.__BISMUTH_CAMERA__`: `orbitLeft45()`, `orbitRight45()`,
`orbitUp45()`, and `orbitDown45()` move in deterministic 45 degree increments,
`getPose()` reports the current transform, and `reset()` restores the frozen
camera. Always reset before a fixed-view morphology capture; alternate angles
are inspection evidence, not morphology retuning.

### Per-slice 3D closeout

1. Freeze the deterministic seed or initial state, configuration, resolution,
   checkpoint times, camera, lighting/material, and comparison layout before
   viewing the result.
2. Render only geometry derived from that slice's state through
   `/__dev/material`. Capture fixed early, middle, and final checkpoints, or
   the honest stalled or empty result when growth does not occur.
3. Keep all four files from `crystal_references/` visible beside the generated
   result. References 1 and 2 are the current single-sector acceptance gate;
   references 3 and 4 remain mandatory regression context until connected
   branching/intergrowth becomes active, when their traits become formal
   gates.
4. Label source/mechanism, conservation, extraction, and morphology outcomes
   independently. A failed slice still completes this review and remains
   failed.
5. Never use a retired carrier, fallback mechanism, target mask,
   camera/material retune, or decorative fill to hide a failed slice.

Collect adapter/browser/timing details only when diagnosing an adapter issue or
making a performance decision.

`/__dev/material` defaults to the current Candidate 2D twin-source closeout
beside all four references. It reports source isolation, scalar/extraction,
and fixed-view morphology separately and leaves the final generated state
visible. `?mode=candidate2d-carrier-evidence` selects the rejected first
Candidate 2D topology carrier, `?mode=candidate2c-evidence` selects the retired
six-facet seam, and `?mode=material` selects the oxide-material fixture.
Success on an evidence route validates only its declared boundary.

The first Candidate 2D comparison froze its camera, layout, and numeric
envelopes before review and was rejected without retuning. Repeat that freeze
for every source-driven candidate. Outer frame, geometric opening depth,
ledge continuity, direction changes, irregular spacing, connectedness, swept
volume, energy closure, and refinement remain independent gates. Explicitly
reject a regular hexagon, a three-sided Sn-Bi pyramid, complete concentric
rings, a shallow opening, and perfect uninterrupted symmetry. The CPU scalar
bridge is not a product fallback; production promotion still requires
compact-state GPU field reconstruction without recurring full-volume upload
or readback.

## Evidence retention

Generated logs, screenshots, JSON reports, and test output are transient and
ignored. Do not copy successful run reports into `docs/`. Preserve only a
durable decision, model boundary, or unresolved next step in its owning
document. Re-run a check when current evidence is needed.
