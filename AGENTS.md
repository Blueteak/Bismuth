# Bismuth Visualizer Contributor Guide

## Goal

Build a browser-based, real-time visualizer for physically motivated bismuth
hopper-crystal growth. The growth process matters as much as the final shape.

Work only from the current source tree and `docs/`. Do not inspect deleted
branches, Git history, caches, or earlier implementations unless asked.

## Sources of truth

- `README.md`: product contract, setup, and commands.
- `PLAN.md`: milestone order and gates.
- `current_tasks.md`: current blocker and next action.
- `docs/architecture.md`: ownership and runtime flow.
- `docs/simulation-model.md`: equations and scientific boundaries.
- `docs/testing-and-validation.md`: proportionate validation policy.
- `docs/references.md`: scientific and technical sources.

Keep each fact in its owning document. Do not copy status, command catalogs,
test transcripts, or completed evidence between files.

## Fixed direction

- Windows and PowerShell locally; Node.js and Express on Ubuntu EC2 later.
- React, TypeScript, Vite, and exactly `three@0.185.0`.
- `WebGPURenderer` and TSL on current desktop Chrome or Edge. No silent WebGL
  or CPU product fallback.
- GPU marching cubes with GPU-resident buffers and indirect drawing.
- Metallic PBR with surface-age-driven thin-film iridescence.
- Preserve the repository-root `hdri.jpg` unchanged.

React owns DOM state. The imperative controller owns the render loop, camera,
GPU resources, and run lifecycle. Simulation, extraction, and materials remain
separate; materials never alter simulation state. Never move per-frame work
through React or read back full production fields/meshes.

## Scientific and product guardrails

- Transcribe model equations and constants from cited sources, not memory.
- The four files in `crystal_references/` are the visual morphology authority:
  bulk bismuth hopper specimens with rectilinear or rhombohedral-pyramidal
  sectors, deep recesses, and winding stepped ledges. Candidate 2D is the
  active direction.
- Every Candidate 2D scientific slice, including a failed or mechanism-only
  slice, ends with an honest deterministic 3D generation on the integrated
  review route and a fixed-camera comparison beside all four files in
  `crystal_references/`. Render the state the slice actually produced,
  including sparse, stalled, or empty outcomes; never add fallback or
  decorative geometry to make the review presentable.
- The generic cubic hopper and Candidates 2A through 2C are evidence or
  regression scaffolding, not product habits. No generic crystal algorithm or
  different-specimen paper may set target geometry, facets, or acceptance.
- Classify every scientific source by composition, growth route, scale,
  specimen habit, and domain state before importing a claim. A mismatch may
  support an isolated mechanism only; it cannot validate product morphology.
- Do not add decorative hollows, terraces, spirals, noise, or overlapping
  crystals to conceal a model failure.
- Keep randomness deterministic internally. Grid spacing and time step are
  numerical parameters, not quality sliders.
- Public behavior stays minimal: automatic first run and one bottom-center
  `Stop`/`Regenerate` action. Stop cannot resume.
- Ask before adding public controls, export, persistence, sharing, time
  scrubbing, mobile support, frameworks, services, or product abstractions.

## Working style

Only write tests when they protect critical math, state transitions, data
layout, or a reproduced bug. Routine hardware matrices are not required, but
one local WebGPU 3D review is required to close every Candidate 2D scientific
slice. Use the smallest relevant checks from
`docs/testing-and-validation.md`; use screenshots only for visual changes.

Keep patches scoped, preserve unrelated user changes, and update only the
document that owns changed information. Keep agent-facing Markdown ASCII-only
and verify it with:

```powershell
rg -n --pcre2 "[^\x00-\x7F]" AGENTS.md PLAN.md current_tasks.md README.md docs
```
