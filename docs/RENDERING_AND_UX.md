# Rendering and UX Design

This document defines the initial realtime rendering and interface direction.

## Rendering Pipeline

Start with three.js through React Three Fiber.

Recommended scene components:

- Perspective camera with orbit controls.
- HDR or procedural environment lighting.
- Directional/key light only if needed for shape readability.
- Ground/contact shadow optional and performance-gated.
- Final crystal mesh or instanced preview mesh.
- Subtle postprocessing only after baseline FPS is stable.

Use WebGL2 first. Keep the material and geometry adapter modular so WebGPU experiments can happen later without rewriting the generator.

For the baseline app shell, prefer procedural environment lighting or bundled
assets over remote HDR dependencies so the local viewport works offline and does
not fail silently on network-restricted machines.

## Material Model

Bismuth should read as metallic, sharp, and iridescent.

Initial material approach:

- Use `MeshPhysicalMaterial` or a custom shader material based on physical lighting.
- Set high metalness.
- Use moderate roughness with generated roughness variation.
- Use environment reflections.
- Use generated oxide thickness for art-directed color shifting.
- Use procedural bump/detail maps for fine steps, scratches, pitting, and tiny surface warps.

Current MVP material:

- Uses `MeshPhysicalMaterial` with high metalness, configurable roughness,
  iridescence, and clearcoat roughness.
- Colors instanced blocks from generated oxide thickness and render-only oxide
  intensity.
- Generates a deterministic canvas bump texture from `scratchDetailStrength`
  for scratch-like surface detail.
- Uses procedural Drei environment lighting, local lights, ACES tone mapping,
  and contact shadows.

For color shifting, use generated oxide thickness plus view angle and normal:

```ts
color = thinFilmPalette(oxideThickness, dot(normal, viewDirection), oxidationExposure)
```

This can begin as an art-directed palette lookup and later move toward a more physically based thin-film approximation.

## Geometry Display Modes

Use different representations for different moments:

- During generation: instanced blocks, shells, or partial surfaces. Prioritize frequent visible updates and the experience of watching the crystal form.
- Final standard view today: instanced lattice blocks carrying oxide-driven
  vertex colors, with the model kept under the default triangle budget.
- Future final standard view: merged `BufferGeometry` with facet attributes for oxide and roughness.
- Final high view: more bevels/chamfers and higher-resolution normal/detail maps.

Do not render thousands of individual React mesh components for final geometry. React should orchestrate scene-level objects, not every crystal step.

## Camera and Interaction

Required:

- Orbit rotate.
- Wheel/pinch zoom.
- Pan.
- Reset view.
- Auto-fit after generation.

Nice to have:

- Auto-rotate/turntable toggle in the viewport or timeline controls.
- Focus selected facet.
- Snapshot camera bookmarks.
- Inspect mode showing growth/oxide data for a hovered facet.

## UI Layout

The first viewport should be the app itself:

- Main 3D canvas occupies most of the screen.
- Left or right control rail for seed and generation settings.
- Bottom timeline strip for generation progress and playback.
- Compact top bar for app title, regenerate, quality, export, and status.

Controls should be grouped:

- Seed: seed input, randomize, copy.
- Structure and growth: physics-inspired model-data sliders.
- Render/view: oxide display, film range, roughness, scratch detail,
  environment, and camera controls.
- Timeline: play, pause, scrub, current step.
- Performance/export: quality, screenshot, glTF later.

Use icons where the action is familiar, with tooltips for less obvious controls.
Icon-only controls should expose an accessible label or `title`, maintain a
stable hit target, and update state through attributes such as `aria-pressed`
when they toggle.

The R3F canvas must be explicitly sized to fill its viewport container at all
breakpoints. After layout edits, verify desktop and narrow mobile widths; the
canvas, rail, and timeline should not overlap or fall back to a small intrinsic
canvas size.

## Generation Playback

The user should be able to watch generation in two ways:

- Live stream: geometry updates continuously as the worker emits chunks.
- Replay: after completion, scrub or play the event history.

Store enough preview payloads to replay meaningfully, but cap memory:

- Always keep major step snapshots.
- Keep only sampled frames for dense iterations.
- Drop old preview payloads if memory exceeds a configured cap.

Generation should have a minimum perceptual duration for normal presets. If the worker finishes quickly, the UI can continue playing buffered chunks at animation-frame cadence so the formation remains legible. If the worker is slow, the UI should still show partial growth quickly and avoid frozen loading states.

## Quality Levels

Preview:

- Lowest geometry density.
- Instanced/simple geometry.
- Reduced shadows/postprocessing.

Standard:

- Default.
- Higher-resolution lattice than preview.
- Instanced geometry in the current MVP, with a path to greedy meshing later.
- Procedural scratch/bump detail in the current MVP, with a path to richer
  normal/roughness maps later.
- Full material.

High:

- More terraces.
- Better bevels/detail maps.
- Optional extra postprocessing.
- Warn or gracefully degrade if FPS drops.

## Performance Instrumentation

Expose development-only stats:

- FPS.
- Draw calls.
- Triangles.
- Generation duration.
- Generation chunk cadence.
- Buffered playback duration.
- Worker transfer size.
- Main-thread mesh build time.

Use these stats to prevent silent performance regressions.

## Visual QA

For rendering or UI changes, verify:

- Production build completes.
- The local dev page loads with a WebGL canvas.
- Browser console has no errors.
- Desktop layout shows the viewport, parameter rail, top bar, and timeline.
- Mobile/narrow layout keeps the canvas full-width and moves the parameter rail without overlap.
- Interactive toggles, especially timeline and camera controls, update their visible or accessibility state.

## Export Ideas

Add after MVP generation/rendering is solid:

- PNG screenshot.
- Shareable URL containing seed/settings.
- JSON settings/model metadata export.
- glTF mesh export with vertex colors or material metadata.
- Short generation replay video or animated GIF if feasible.
