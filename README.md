# Bismuth Visualizer

Browser WebGPU study: real-time bismuth hopper growth into a metallic,
thin-film-iridescent specimen; never reveal a prebuilt mesh. Candidate 2E uses
orientation-aware 3D cellular growth: local supply/attachment, GPU-resident
state, per-seed morphology frames, shared transport, deterministic impingement.

Public root: neutral foundation scene. Active science: Candidate 2E, locked to
five bulk hopper targets in `crystal_references/`. References 1-2 gate one
hopper; 3-5 gate later branching/intergrowth. See `current_tasks.md`.

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
review. Default: frozen failed Candidate 2E.2 sparse edge-source Test 1 beside all
five targets; verdict: `current_tasks.md`. `?checkpoint=early|middle|final`;
`?mode=material`: oxide fixture.

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

- `crystal_references/`: five Candidate 2E morphology targets.
- `src/simulation/`: simulation runtime; Candidate 2E CA experiments.
- `src/extraction/`: GPU marching cubes + CPU-checkable layouts.
- `src/rendering/`: WebGPU, environment, material, oxide.
- `src/visualizer/`: imperative controller/scheduling.
- `server/`: static Express + `/healthz`.
- `PLAN.md` / `current_tasks.md`: sequence / immediate handoff.
- `docs/`: architecture, model, validation, sources.
