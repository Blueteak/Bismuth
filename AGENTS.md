# Bismuth Agent Guide

This repo is for an interactive web application that procedurally generates and renders bismuth crystal models in real time.

## Project Goal

Build a browser app where a user can press one button to generate a new bismuth crystal, tune the growth conditions, watch the generation process unfold, and inspect the final model with a smooth orbital 3D camera.

The target experience is visually realistic and responsive, not an atom-level scientific simulator. We should be honest in code and UI about this: the generator is physically inspired by bismuth hopper crystal growth and oxide-film coloration.

## Current Product Requirements

- Single button press regenerates the crystal.
- Users can manually set or randomize the seed.
- Sliders/settings influence seed and growth conditions.
- Generation steps are realtime-visible and are a major part of the viewing experience.
- Geometry should resemble real bismuth hopper/stair-step growth.
- Rendering should use PBR-style metallic bismuth with thin-film/oxide color shifting.
- Final model should remain interactive at realtime orbit-camera speeds, aiming for 60 FPS on a typical modern laptop.

## Chosen Initial Stack

- App shell: Vite + React + TypeScript.
- 3D runtime: three.js via React Three Fiber.
- 3D helpers: `@react-three/drei` where it saves time for cameras, environments, controls, and helpers.
- State: Zustand or a similarly small explicit store for seed, generator settings, timeline state, and render options.
- Generation: deterministic TypeScript core running in a Web Worker with chunked, streamable output.
- Mesh data: custom `CrystalModel` JSON-like data structure passed from worker to renderer, converted to three.js `BufferGeometry` or instanced geometry on the main thread.
- Styling: plain CSS modules or vanilla CSS first. Add Tailwind only if the project later needs broad UI velocity.
- Testing: Vitest for generator determinism and geometry invariants. Playwright for visual smoke tests once the app exists.

Do not introduce a server backend for the MVP. The generation and rendering should run fully client-side until there is a clear requirement for saved galleries, accounts, remote rendering, or large exports.

## Architecture Boundaries

Keep these modules separate:

- `src/generation`: pure deterministic crystal generation. No React, DOM, or three.js scene concerns.
- `src/workers`: worker wrapper, progress messages, cancellation, and transfer serialization.
- `src/rendering`: three.js/R3F conversion, materials, lights, postprocessing, camera behavior.
- `src/ui`: controls, seed editing, timelines, panels, buttons, and status surfaces.
- `src/state`: app-level state, presets, persistence, and URL/share encoding.

The generation package should be testable in Node without a browser canvas.

## Generation Direction

Use a staged growth pipeline:

1. Initialize seeded PRNG and growth parameters.
2. Place one or more nuclei on a discrete lattice.
3. Grow nuclei on a shared deterministic timeline so multiple nuclei can
   interact instead of growing one after another.
4. Grow stepped hopper shells with edge-biased deposition.
5. Apply anisotropy, impurities, cooling-rate variation, branching, and
   screw-dislocation-inspired square spiral terrace sources.
6. Resolve collisions by placing contact cells, preventing growth through the
   merged interface, and pruning unsupported terminal voxels.
7. Classify facets, edges, cavities, and oxide thickness.
8. Build renderable geometry at the selected detail level.
9. Emit small generation chunks throughout so the UI can display the crystal forming in realtime.
10. Pace playback independently from raw compute speed when needed, so high-end machines do not skip past the generation experience.

Prefer compact data over raw high-poly output. Generate the big silhouette and terraces as geometry, then use shader/detail maps for fine scratches, pitting, roughness variation, and oxide shimmer.

## Rendering Direction

Start with WebGL2 through three.js. Keep rendering abstractions clean enough to experiment with WebGPU later, but do not make WebGPU a requirement for the first implementation.

Rendering should prioritize:

- Metallic PBR material with high metalness and tuned roughness.
- Thin-film/oxide color shifting by view angle, surface normal, and generated oxide thickness.
- Procedural normal/roughness maps for fine detail.
- HDR/environment lighting and tone mapping.
- Optional bloom/glints kept subtle and performance-gated.
- Orbit controls with stable 60 FPS after generation completes.

Use instancing or merged buffer geometry for repeated terraces. Avoid one React component per crystal step in the final model.

## Performance Budgets

Initial budgets for the MVP:

- Final render: 60 FPS target at 1920x1080 on a mid-range modern laptop.
- Main-thread frame cost after generation: under 12 ms typical.
- Geometry: under 200k triangles for the default quality setting.
- Draw calls: under 100 for default quality.
- Generation duration: 5+ seconds is acceptable when it improves the experience.
- Generation updates: visible model updates should be much faster than every 100 ms. Aim for animation-frame cadence when possible, with compute work sliced into small chunks such as 2-8 ms.
- Generation pacing: if raw generation finishes too quickly, buffer or schedule chunks so the user can watch the formation instead of seeing a near-instant jump.
- Memory: keep default generated model data under 100 MB in browser memory.

If a feature conflicts with these budgets, add a quality setting or defer the feature.

## UI Direction

This is an interactive tool, not a landing page. The first screen should be the generator: viewport, controls, regenerate action, seed field, timeline/progress, and render settings.

Use dense, calm controls suited for repeated tweaking:

- Regenerate button.
- Seed text/input with randomize and copy controls.
- Preset menu for growth styles.
- Sliders for growth/model-data conditions.
- Timeline/playback and camera motion controls for watching generation.
- Compact performance/quality menu.
- Export controls once export exists.

Keep controls grouped by what they change. The primary parameter rail should
focus on serializable generation/model-data inputs such as seed, structure,
growth, and oxidation exposure. Render-only knobs such as material roughness,
environment intensity, oxide display intensity, and camera/turntable playback
belong in render, view, or timeline surfaces instead of the generation parameter
list.

Avoid explanatory marketing copy in the UI. Put deeper explanation in docs, tooltips, or an optional details panel.

## Useful User-Facing Controls

Seed and structure:

- Seed value.
- Nucleation count.
- Nucleus start delay.
- Nuclei vertical spread.
- Initial seed size.
- Crystal scale.
- Symmetry bias.

Growth conditions:

- Cooling rate.
- Edge growth bias.
- Face fill rate.
- Terrace height.
- Hopper depth.
- Branching probability.
- Impurity/noise.
- Gravity/sag bias.
- Oxidation exposure.

Rendering:

- Oxide intensity.
- Iridescence thickness range.
- Surface roughness.
- Scratch/detail strength.
- Environment intensity.
- Quality level.

## Scientific Notes

Bismuth crystals commonly show hopper morphology: edges grow faster than face
centers, producing hollowed or stepped forms. Spiral terraces on crystal faces
can arise from screw-dislocation step sources: a persistent step winds around a
defect and advances as growth continues. Their vivid colors come from thin-film
interference in the oxide layer rather than intrinsic pigment. The generator
should encode those ideas as visible rules without claiming atom-level accuracy.

Reference links for later research:

- Bismuth overview and iridescent oxide notes: https://en.wikipedia.org/wiki/Bismuth
- Hopper crystal morphology overview: https://en.wikipedia.org/wiki/Hopper_crystal
- Screw-dislocation spiral growth discussion: https://arxiv.org/abs/1612.08924
- three.js docs: https://threejs.org/docs/
- React Three Fiber docs: https://r3f.docs.pmnd.rs/getting-started/introduction
- Vite guide: https://vite.dev/guide/

## Implementation Standards

- Use TypeScript for app and generation code.
- Keep generator settings serializable.
- Ensure identical seed + settings produces identical model data.
- Add tests for deterministic generation, bounded geometry, and valid timeline events.
- Keep generated events meaningful enough for playback, debugging, and UI progress.
- Keep generation chunks small enough for smooth visual updates.
- Prefer small pure functions for growth rules.
- Do not hide random calls. Route randomness through the seeded PRNG.
- Avoid global mutable generation state.
- Avoid blocking the main thread during generation.
- Preserve user changes in a dirty worktree unless explicitly instructed otherwise.

Local development notes:

- On Windows PowerShell, use `npm.cmd` since `npm` is blocked by execution policy.
- In the Codex managed filesystem sandbox, Vite/esbuild and Vitest will
  fail to read `vite.config.ts` with `Access is denied`. 
  For known Vite/Vitest commands, request the appropriate approved
  escalation up front instead of first running the command in the sandbox and
  then retrying after the expected failure. This applies to:
  - `npm.cmd run build`
  - `npm.cmd test -- --run`
  - `npm.cmd run dev`
- Use `npm.cmd run preview -- --port 4173` to validate the production build
  in the browser after `npm.cmd run build`. If port `4173` is occupied, use a
  nearby free port and note the URL.
- If one of those commands still fails with a config-read sandbox error, rerun
  the same command with the appropriate approved escalation instead of changing
  project code.
- Keep `node_modules/`, `dist/`, Vite caches, logs, and local env files ignored.
- Use Web Crypto or browser-only randomness only for user convenience actions such as randomizing a seed. Generation randomness must still flow through the seeded PRNG.
- Do not rely on external HDR files or remote assets for the baseline scene unless the dependency is deliberate and documented.

## Definition of Done for Feature Work

For generator changes:

- Determinism test passes.
- Production build passes.
- New settings are documented in code or project docs.
- Progress/timeline output still works in the built app. In browser validation,
  regenerate once and confirm block counts advance from `0` through visible
  intermediate chunks to a completed model.
- Triangle/draw-call impact is understood.
- Browser console errors are checked after regeneration.

For rendering changes:

- Visual change is inspected in the browser.
- Prefer validating against a production preview build, not only the Vite dev
  server, when shader/material/worker output is involved.
- FPS/performance impact is checked.
- Mobile and desktop layout are checked if UI is affected.
- R3F canvas sizing is checked after responsive changes. The canvas should fill its viewport container at desktop and mobile widths.
- Browser console errors are checked after scene, material, lighting, or control changes.

For UI changes:

- Controls do not overlap at common desktop and mobile widths.
- Every setting has a clear state path.
- Regeneration and cancellation still work.
- If controls are moved between panels, verify the old location no longer exposes duplicate or misleading controls.
