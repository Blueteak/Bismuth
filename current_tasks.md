# Current Tasks

Updated 2026-07-12.

## Status

The active blocker is Milestone 1B: replace the generic cubic regression
hopper with a bismuth-specific one-nucleus model. Solver, extraction,
controller, and initial material infrastructure already exist. The public root
remains neutral, and `/__dev/material` is the only retained integrated review
route.

Candidate 1 is rejected and its generic-solver support has been removed. A
direct rhombohedral remapping selected the wrong physical construction and
grew an extreme boundary-limited body; do not restore or retune it.

Candidate 2A is the active thermal/free-surface isolation. The CPU model has a
pure-melt field, latent heat, a fixed Robin heat-removal boundary, and separate
`gamma(n)`/`beta(n)` functions for the observed slow bismuth facet family.
Those isolated signatures pass deterministic tests, but no 3D Candidate 2
morphology has been run or accepted.

## Next implementation slice

1. Implement the variational anisotropic Candidate 2 phase operator.
2. Derive and encode its normalization and stability bound.
3. Prepare a consistent surface-attached diffuse or pre-relaxed seed and
   define critical size.
4. Add the smallest rotated planar-front refinement tests needed to protect
   that math.
5. Do not start a 3D morphology screen until those checks pass.

Keep twins, dislocations, explicit steps, and multiple orientations deferred
until evidence or an isolated failure requires them. Keep material calibration,
public lifecycle work, clustering, performance selection, and deployment
paused until bismuth morphology passes.

## Working loop

```powershell
npm.cmd run check:fast
npm.cmd run check:baseline
review.cmd
```

Use `check:fast` while editing and `check:baseline` before handoff. Run the
review surface only for changes that affect GPU integration or appearance.
Do not create retained result transcripts; record only durable decisions or
the next unresolved boundary in this file and `docs/simulation-model.md`.
