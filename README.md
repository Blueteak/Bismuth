# Bismuth Visualizer

A browser-based WebGPU study of physically motivated bismuth hopper-crystal
growth. The intended product shows continuous growth into a metallic,
thin-film-iridescent specimen rather than revealing a prebuilt mesh.

The public root is intentionally still a neutral foundation scene. The active
scientific task is Candidate 2D: a target-locked model for the four bulk
bismuth hopper specimens in `crystal_references/`. Their deep rectilinear or
rhombohedral-pyramidal recesses and winding stepped ledges are the morphology
authority. Candidate 2C's regular hexagonal, complete-loop carrier is rejected
as product habit even though its conservation and WebGPU extraction work
remain useful infrastructure evidence. Generic crystal models and papers about
different specimen classes may support isolated numerics or mechanisms only;
they cannot set product geometry or morphology acceptance. See
`current_tasks.md` for the active Candidate 2D slice.

## Product contract

- Desktop Chrome or Edge with hardware WebGPU; no silent fallback.
- The first generation starts after required resources are ready.
- The sole primary action is bottom-center: `Stop` while growing and
  `Regenerate` after stopping or completion. A stopped run cannot resume.
- The user may orbit and zoom a frozen or growing specimen.
- No public export, persistence, seed, parameter, resolution, timeline, or
  sharing controls.
- Rendering uses GPU marching cubes, metallic PBR, the repository-root
  `hdri.jpg`, and surface-age-driven oxide iridescence against black.

## Setup

Requires Node.js `24.x` and npm.

```powershell
npm.cmd install
npm.cmd run dev
```

`review.cmd` starts the development server and opens `/__dev/material`, the
single retained integrated review surface. It now runs the Candidate 2D
twin-source 3D closeout and leaves its exact one-front result beside all four
ground-truth images. The local source and extraction pass, but the generated
strip is visibly rejected as target morphology. Add
`?mode=candidate2d-carrier-evidence` for the rejected first Candidate 2D
topology carrier, `?mode=candidate2c-evidence` for the retired six-facet seam,
or `?mode=material` for the oxide fixture. None is approved product
morphology.

Production-shaped local serving:

```powershell
npm.cmd run build
npm.cmd start
```

## Checks

```powershell
npm.cmd test                 # fast deterministic unit tests
npm.cmd run check:fast       # tests and TypeScript
npm.cmd run check:baseline   # full browser-free handoff gate
```

The automated suite does not launch a browser or require a GPU. Use the review
surface for relevant visual or GPU-pipeline changes; collect hardware-specific
measurements only when performance or adapter behavior is the task.

## Repository map

- `crystal_references`: the four authoritative Candidate 2D target images.
- `src/simulation`: generic runtime, retired Candidate evidence, and the new
  Candidate 2D work.
- `src/extraction`: GPU marching cubes and CPU-checkable layout helpers.
- `src/rendering`: environment, material, oxide, and WebGPU capability code.
- `src/visualizer`: imperative live controller and scheduling.
- `server`: minimal Express static server and `/healthz`.
- `PLAN.md` and `current_tasks.md`: milestone sequence and immediate handoff.
- `docs/`: focused architecture, simulation, validation, and reference notes.

The scientific constraints and next implementation gate are in
[`docs/simulation-model.md`](docs/simulation-model.md) and
[`current_tasks.md`](current_tasks.md).
