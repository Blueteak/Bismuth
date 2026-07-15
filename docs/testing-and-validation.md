# Testing and Validation

## Policy

Test only critical equations, state transitions, layouts, reproduced bugs. Skip
trivial accessors/markup, old milestones, speculation. Default suite:
deterministic, browser/GPU/hardware independent. `gpu-*.test.ts` tests
CPU-checkable planning/layout only.

## Commands

| Command                  | Purpose                               |
| ------------------------ | ------------------------------------- |
| `npm test`               | Fast Vitest                           |
| `npm run check:fast`     | Tests + TypeScript                    |
| `npm run check:baseline` | Handoff: fast + lint + format + build |
| `npm run dev`            | Public + dev route                    |
| `review.cmd`             | Open integrated review                |

`package.json` owns commands. No no-op/one-off catalog growth.

## Minimum evidence

| Change               | Evidence                                                  |
| -------------------- | --------------------------------------------------------- |
| Refactor/docs        | Typecheck/focused check; docs ASCII scan                  |
| Equation/config math | Focused deterministic numerical tests                     |
| Source/facet claim   | Specimen-match audit first                                |
| Candidate 2D path    | Continuity, turns, heads, no self-crossing                |
| Swept geometry       | Exact area/volume/latent ledger                           |
| Carrier              | Opening, connectedness, topology, refinement              |
| Mechanism            | Isolated null/reversal/failure                            |
| Scientific slice     | Frozen 3D + screenshot + explicit all-four visual verdict |
| Extraction/layout    | Analytic CPU topology/layout tests                        |
| Scheduler/lifecycle  | Deterministic scheduling tests                            |
| Material/oxide       | Focused math + visual review if visible                   |
| GPU/appearance       | `/__dev/material` smoke + screenshot                      |
| Performance          | Task-specific measurement only                            |

Focused -> `check:baseline` before handoff. No hardware matrix, fingerprint,
long morphology sweep, benchmark unless directly relevant.

## WebGPU review

Every Candidate 2D scientific slice requires one current-desktop hardware
WebGPU run on `/__dev/material`. Confirm honest init/failure, visible mesh
updates, last-valid retention, clean resize/disposal. Always capture the final
fixed-camera comparison; visual morphology is part of every scientific slice.

Canvas: left-drag orbit; wheel zoom. Automation:
`window.__BISMUTH_CAMERA__.{orbitLeft45,orbitRight45,orbitUp45,orbitDown45,
getPose,reset}`. Reset before morphology capture; alternate angles are
inspection, not retuning.

### Per-slice closeout

1. Pre-freeze seed/state, config, resolution, checkpoints, camera,
   light/material, comparison layout.
2. Render only slice-derived geometry. Capture fixed early/middle/final or
   honest stalled/empty result; save the fixed-camera screenshot.
3. Keep all four targets visible. References 1-2: single-sector gate; 3-4:
   mandatory context, later branching/intergrowth gates.
4. Inspect rendered pixels directly against the named target traits; record an
   explicit visual pass/fail + reasons. Fixture classification, triangle count,
   and GPU health cannot substitute.
5. Report source, conservation, extraction, morphology independently. Failed
   slice still closes review and remains failed.
6. No retired carrier, fallback, target mask, camera/material retune,
   decorative fill.

Default route: edge/free-surface closeout; final state beside references;
separate source/scalar/morphology results.

- `?mode=candidate2d-twin-evidence`: closed twin-source slice.
- `?mode=candidate2d-carrier-evidence`: rejected topology carrier.
- `?mode=candidate2c-evidence`: retired six-facet seam.
- `?mode=material`: oxide fixture.

Evidence-route success validates only its declared boundary. Freeze every new
candidate before viewing. Independent gates: outer frame, opening depth,
ledge continuity/turns/irregularity, connectedness, volume, energy, refinement.
Reject hexagon, three-sided Sn-Bi pyramid, concentric rings, shallow opening,
perfect symmetry. Dev CPU scalar bridge is not product fallback; production
requires compact-state GPU reconstruction without recurring full-volume
upload/readback.

Collect adapter/browser/timing only for adapter diagnosis/performance choice.

## Retention

Logs, screenshots, JSON, test output: transient/ignored. Do not copy successes
into docs. Preserve only durable decisions, model boundaries, unresolved next
steps in owner docs. Re-run for current evidence.
