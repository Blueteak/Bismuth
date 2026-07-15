# Bismuth Visualizer

Browser WebGPU study: physically motivated bismuth hopper growth into a
metallic, thin-film-iridescent specimen; never reveal a prebuilt mesh.

Public root: neutral foundation scene. Active science: Candidate 2D, locked to
the four bulk hopper targets in `crystal_references/`. Candidate 2C's regular
hexagonal complete-loop habit is rejected; its conservation/extraction work is
infrastructure evidence only. See `current_tasks.md`.

## Product contract

- Desktop Chrome/Edge + hardware WebGPU; no silent fallback.
- Auto-start after resources load.
- One bottom-center action: `Stop` while growing; `Regenerate` after stop/end.
  No resume. Orbit/zoom anytime.
- No public export, persistence, seed, parameters, resolution, timeline, or
  sharing.
- GPU marching cubes; metallic PBR; root `hdri.jpg`; surface-age oxide
  iridescence; black background.

## Run

Requires Node.js `24.x` + npm.

```powershell
npm.cmd install
npm.cmd run dev
```

`review.cmd`: start dev server + open `/__dev/material`, the sole integrated
review. Default: Candidate 2D edge/free-surface 3D closeout; honest one-front
result beside all targets; local source/extraction pass, target source and
morphology fail.

- `?mode=candidate2d-twin-evidence`: closed twin-source slice.
- `?mode=candidate2d-carrier-evidence`: rejected Candidate 2D topology carrier.
- `?mode=candidate2c-evidence`: retired six-facet seam.
- `?mode=material`: oxide fixture.

No evidence route is approved product morphology.

Production-shaped serving:

```powershell
npm.cmd run build
npm.cmd start
```

## Checks

```powershell
npm.cmd test                 # deterministic unit tests
npm.cmd run check:fast       # tests + TypeScript
npm.cmd run check:baseline   # browser-free handoff gate
```

Automation uses no browser/GPU. Use the review route for relevant visual/GPU
changes; measure hardware only for performance/adapter tasks.

## Map

- `crystal_references/`: four Candidate 2D morphology targets.
- `src/simulation/`: runtime, retired evidence, Candidate 2D.
- `src/extraction/`: GPU marching cubes + CPU-checkable layouts.
- `src/rendering/`: WebGPU, environment, material, oxide.
- `src/visualizer/`: imperative controller/scheduling.
- `server/`: static Express + `/healthz`.
- `PLAN.md` / `current_tasks.md`: sequence / immediate handoff.
- `docs/`: architecture, model, validation, sources.
