# Bismuth Visualizer Contributor Guide

## Project intent

Build a browser-based, real-time visualizer for physically motivated bismuth hopper-crystal growth. The growth process matters as much as the final specimen. The visual target is the class of colorful, lab-grown bismuth hopper specimens commonly produced from high-purity molten bismuth.

This repository is a fresh implementation. Do not mine reset branches, deleted files, Git history, caches, or other previous iterations for code or design ideas unless the user explicitly asks. Work from the current source tree and the documentation in `docs/`.

## Sources of truth

- `PLAN.md` defines implementation order and milestone gates.
- `docs/product-spec.md` defines public behavior and non-goals.
- `docs/architecture.md` defines subsystem ownership and data flow.
- `docs/simulation-model.md` defines scientific and numerical constraints.
- `docs/rendering-and-materials.md` defines mesh extraction and appearance.
- `docs/testing-and-validation.md` defines required evidence.
- `docs/decisions.md` records confirmed and deferred decisions.
- `docs/scaffolding.md` defines the immediate 0A handoff and its stopping point.

When documents disagree, prefer the most specific document and update all affected docs in the same change.

## Fixed technical direction

- Local development: Windows and PowerShell.
- Client: React, TypeScript, and Vite.
- Graphics and compute: Three.js `0.185.0` (r185) using `WebGPURenderer` and TSL.
- Browser floor: current Chrome and Edge with hardware WebGPU. Do not add a public WebGL or CPU simulation fallback without approval.
- Production: a Vite build served by Node.js and Express on Ubuntu EC2, behind HTTPS termination.
- Simulation: reproduce the published single-crystal 3D hopper phase-field model before adding multi-grain behavior.
- Surface: GPU marching cubes at the phase-field isovalue, using GPU-resident buffers and indirect drawing.
- Material: metallic PBR with surface-age-driven thin-film iridescence.

Pin Three.js exactly to `0.185.0`. The scaffolding agent may choose the latest stable, non-prerelease compatible releases for the remaining toolchain and dependencies. Pin all selected versions exactly, use npm with a committed `package-lock.json`, and record the chosen toolchain in the scaffolding handoff. Do not use floating or unbounded dependency ranges.

The scaffolding agent may choose ordinary implementation details such as ESM configuration, server compilation strategy, lint/format tools, and exact leaf filenames, provided the documented architecture boundaries remain intact and the choices are recorded. Ask before introducing a new framework, service, runtime, workspace/monorepo layer, or product-facing abstraction.

## Architecture boundaries

- React owns DOM layout, controls, accessibility, and application state presentation.
- An imperative visualizer controller owns the render loop, camera, Three.js scene, GPU resources, and run lifecycle.
- The simulation layer owns phase-field parameters, compute passes, boundary conditions, deterministic random state, and termination checks.
- The extraction layer owns classification, prefix-sum compaction, vertex emission, capacity checks, and indirect draw state.
- The material layer reads geometry attributes and surface age; it must not alter simulation state.
- Developer diagnostics may read back small summaries or test grids. The production frame loop must not read back the full simulation or mesh.
- Never drive per-frame rendering or simulation through React reconciliation.

## Scientific integrity

- Transcribe equations, constants, initial conditions, and boundary conditions from the cited paper and supplementary material. Do not reconstruct them from memory.
- First reproduce and validate one centered, single-orientation hopper crystal.
- Treat a differently oriented hero cluster as a later multiphase/orientation-field extension, not as a cosmetic collection of overlapping meshes.
- Document every deliberate departure from the reference model in `docs/simulation-model.md` and `docs/decisions.md`.
- Grid resolution is a numerical parameter, not a cosmetic quality slider. Changes to grid spacing require matching time-step and convergence checks.
- Use deterministic seeded randomness internally. Public runs are disposable, but tests and debugging must be reproducible.
- Do not hide numerical instability with unreviewed clamping, smoothing, remeshing, or art-directed geometry changes.

## Product guardrails

- The initial generation starts automatically after required resources are ready.
- The sole primary public action is bottom-center: `Stop` while growing and `Regenerate` otherwise.
- Stop freezes the current specimen and cannot resume it.
- Automatic completion and manual stopping enter the same stopped state.
- Keep scientific fields, raw parameters, GPU timing, and fixed-seed controls developer-only.
- Do not add export, persistence, shareable seeds, time scrubbing, resume, scene geometry, mobile support, or public parameter controls without approval.
- Ask before adding a feature or architecture to satisfy an assumed future requirement.

## Development and verification

Maintain these cross-platform script contracts as their milestones activate. Milestone 0A requires `dev`, `test`, `test:e2e`, `lint`, `format:check`, `typecheck`, `build`, and `start`. Milestone 0B adds real `test:gpu` and `benchmark` commands; do not create no-op placeholders for them in 0A.

- `npm run dev` - Vite development server.
- `npm test` - deterministic unit and CPU-reference tests.
- `npm run test:gpu` - small-grid WebGPU numerical and extraction tests.
- `npm run test:e2e` - Playwright interaction and screenshot tests.
- `npm run benchmark` - adapter-aware solver/extraction benchmarks.
- `npm run build` - production client and server build.
- `npm start` - serve the production build through Express.

Prefer Node-based scripts over shell-specific glue so the same commands work in PowerShell and Ubuntu. Tests that need a real GPU must report the browser, adapter, driver, grid size, and Three.js revision.

Every material change requires the strongest relevant evidence: numerical comparison for solver work, analytic-field tests for extraction, screenshots for visual changes, and browser lifecycle tests for UI changes.

## Change discipline

- Keep commits and patches scoped to one milestone or concern.
- Preserve unrelated user changes.
- Update documentation alongside behavior changes.
- Keep developer diagnostics removable from production builds or inaccessible through the public UI.
- Surface WebGPU capability failure clearly; do not silently fall back to a different simulation.
- Keep Markdown and other agent-facing instruction files ASCII-only. After documentation changes, run `rg -n --pcre2 "[^\\x00-\\x7F]" AGENTS.md PLAN.md docs` and resolve every match.
