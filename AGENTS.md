# Bismuth Visualizer Contributor Guide

## Goal

Browser, real-time, physically motivated bismuth hopper growth; growth and final
shape both matter.

- Use only current tree + `docs/`. Ignore deleted branches, history, caches,
  earlier implementations unless asked.

## Document ownership

- `README.md`: public contract, setup, commands, map.
- `PLAN.md`: milestones, order, gates.
- `current_tasks.md`: current result, blocker, next action.
- `docs/architecture.md`: ownership/runtime flow.
- `docs/simulation-model.md`: equations/scientific boundaries.
- `docs/testing-and-validation.md`: proportionate checks.
- `docs/references.md`: sources/applicability.

Keep facts only in their owner. Never duplicate status, command catalogs, run
transcripts, or completed evidence.

## Documentation rule

Minimum tokens. Use terse directives/fragments; full sentences only when needed
for precision. Keep only decision-changing facts, constraints, equations,
commands, evidence boundaries, and next actions. Delete repetition/history;
link to the owner instead.

## Fixed direction

- Local: Windows/PowerShell. Later host: Node/Express on Ubuntu EC2.
- React + TypeScript + Vite + exact `three@0.185.0`.
- Current desktop Chrome/Edge; `WebGPURenderer` + TSL; no silent WebGL/CPU
  product fallback.
- GPU marching cubes; GPU-resident buffers; indirect draw.
- Metallic PBR; surface-age thin-film iridescence.
- Preserve root `hdri.jpg` bytes.
- React: DOM state only. Controller: loop, camera, GPU, lifecycle.
- Keep simulation/extraction/materials separate; materials never mutate
  simulation. No per-frame React or full production field/mesh readback.

## Scientific/product rules

- Copy equations/constants from cited sources, never memory.
- Morphology authority: five `crystal_references/` images. References 1-2 gate
  one hopper; 3-5 gate later branching, orientation, and intergrowth. Active:
  Candidate 2E orientation-aware 3D cellular growth.
- Candidate 2E: shared GPU 3D storage grid; per-seed owner + local morphology
  frame; shared supply; synchronous deterministic capture/impingement. Grid
  alignment never defines seed orientation. No prepainted routes/special cells.
- End every Candidate 2E scientific slice, including failure/mechanism-only,
  with deterministic integrated 3D output + fixed-camera screenshot beside all
  five references. Inspect rendered pixels; record explicit visual morphology
  verdict. Show actual sparse/stalled/empty state; no fallback/decorative shape.
- Generic cubic + Candidates 2A-2D: evidence/regression only. Generic or
  mismatched-specimen work cannot set target geometry, facets, or acceptance.
- Before importing a claim, classify composition, growth route, scale, habit,
  domain. Mismatch permits isolated mechanism evidence only.
- Never conceal failure with hollows, terraces, spirals, noise, or overlapping
  crystals.
- Deterministic internal randomness. Grid spacing/time step are numerics, not
  quality controls.
- Public UI: automatic first run; one bottom-center `Stop`/`Regenerate`; no
  resume.
- Ask before public controls, export, persistence, sharing, time scrubbing,
  mobile, frameworks, services, or product abstractions.

## Work/validation

- Tests only for critical math, state transitions, layouts, reproduced bugs.
- Close every Candidate 2E slice with one local WebGPU 3D review + screenshot +
  explicit all-five visual verdict. Fixture/GPU metrics alone never close it.
  Otherwise use smallest checks in `docs/testing-and-validation.md`.
- Scope patches; preserve user changes; edit only owning docs.
- Agent Markdown: ASCII only. Verify:

```powershell
rg -n --pcre2 "[^\x00-\x7F]" AGENTS.md PLAN.md current_tasks.md README.md docs
```
