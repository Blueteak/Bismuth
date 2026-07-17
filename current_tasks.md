# Current Tasks

Updated 2026-07-15.

## Handoff

Milestone 1B / Candidate 2E active. Sparse edge-source Test 1 closed:
finite-depth mechanism pass; sparsity/scaling/target-morphology fail. Stop; do
not tune the schedule or add transport.

Read next: `PLAN.md`; `docs/simulation-model.md` for the rule boundary;
`docs/testing-and-validation.md` for closure; `docs/references.md` before any
physical claim.

## Closed 2E.1 lateral-facet handoff Test 2

Rule: Test 1 plus opening-orthogonal lateral-facet identity and same-source
handoff across local perpendicular facets at equal layer. No new source, layer
advance, nucleation, transport, route, mask, or coefficient change.

Isolation: `41^3`; centered `5^3` seed; 72 steps. One source produced 416
front cells across four connected lateral planes; 541 solid cells total;
center above seed liquid. Exact ledger; connected; boundary clear;
forward/reverse arrays identical. Mechanism/topology gate passed.

Integrated frozen run: `65^3`; centered `11^3` seed; identity frame;
checkpoints `12/36/72`.

| Step | Cells | Front cells | Planes | Triangles |
| ---: | ----: | ----------: | -----: | --------: |
|   12 | 1,348 |          17 |      2 |     1,496 |
|   36 | 1,582 |         251 |      3 |     1,672 |
|   72 | 2,174 |         843 |      4 |     3,120 |

All checkpoints: one source, exact ledger, connected, boundary clear, no
overflow or browser/WebGPU error. Fixed and alternate pixel inspection confirms
four rising walls and a deep open center. The walls are a thin rectangular
tube, not connected bulk planes.

Visual verdict:

- Reference 1 fail: box opening; no stepped bulk hopper, winding ledges, or
  terrace elevations.
- Reference 2 fail: centered regular tube; no offset opening, interrupted
  bands, or asymmetry.
- References 3-5 fail context: no intergrown sectors, varied widths, branching,
  arbitrary frames, or impingement.

Do not call this hopper growth. The discriminator proves local facet handoff
can preserve one source, turn four corners, and leave an open center. Surface
occupancy alone cannot carry a finite-volume hopper body.

## Closed 2E.2 sparse edge-source Test 1

Rule: Test 2 plus deterministic source-birth trials every 12 steps. Each
locally eligible outer lateral edge used the frozen hash with probability
`1/4`; one solid face, Moore support `4..6`, outward support aligned to its
seed-local lateral facet. No inward-cavity birth, completion trigger, global
chooser, one-per-layer rule, transport, route, mask, or rate change.

Isolation: `41^3`; centered `5^3` seed; 96 steps. 293 sources, 419
source/facet/layer planes, 6,742 solid cells; finite radial depth; center open.
Exact ledger; connected; boundary clear; forward/reverse arrays identical.
Local state transition passed; sparse-source premise failed.

Integrated frozen run: `65^3`; centered `11^3` seed; identity frame;
checkpoints `24/60/96`.

| Step |  Cells | Sources | Planes | Triangles |
| ---: | -----: | ------: | -----: | --------: |
|   24 |  1,859 |      42 |     61 |     2,316 |
|   60 |  5,796 |     229 |    328 |     6,200 |
|   96 | 14,239 |     563 |    765 |    11,296 |

All checkpoints: exact ledger, connected, boundary clear, no overflow or
browser/WebGPU error. Repeated births make finite-depth walls and retain a deep
opening, but source count scales with exposed area. Planes merge into a smooth,
bulky centered block; no three distinct terrace elevations.

Visual verdict:

- Reference 1 fail: deep opening survives, but no winding stepped ledges or
  target bulk frame; smooth lobes dominate.
- Reference 2 fail: centered symmetric opening; no offset, interruptions, or
  asymmetric bands.
- References 3-5 fail context: no intergrown sectors, branching, arbitrary
  frames, or impingement.

Do not tune period/probability. Per-site Bernoulli birth is not sparse or
resolution-stable; reducing its rate only delays the same area-scaling failure.

## Next action: source-population strategy review

Choose one stateful source population: conserved local nucleation precursor or
explicit persistent imperfection hypothesis. It must define birth, persistence,
termination, mass coupling, and refinement behavior without a global source
chooser or target-authored layer clock. Source-audit before implementation. No
schedule sweep, transport, multi-seed, or morphology compensation.

## Review

`/__dev/material`: frozen failed sparse edge-source Test 1 beside all targets.
Use `?checkpoint=early|middle|final`; default final. `?mode=material`: oxide.

```powershell
npm.cmd run check:fast
npm.cmd run check:baseline
review.cmd
```
