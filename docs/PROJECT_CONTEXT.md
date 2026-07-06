# Project Context

Bismuth is a greenfield browser application for procedural bismuth crystal generation and realtime 3D viewing.

## Product Shape

The core loop is:

1. User adjusts seed and growth controls.
2. User presses regenerate.
3. The app streams the crystal forming in realtime, not just coarse progress stages.
4. The final model resolves into a realtime 3D scene.
5. User orbits, zooms, changes render settings, tweaks growth parameters, and regenerates.

The application should feel like a focused creative/scientific instrument: direct manipulation, compact controls, immediate feedback, and high-quality rendering.

## MVP Scope

The MVP should include:

- Full-screen 3D viewport.
- Regenerate button.
- Manual seed input and random seed action.
- Deterministic generation for the same seed/settings.
- Growth controls for at least edge bias, terrace height, hopper depth, impurity/noise, cooling rate, and oxidation.
- Realtime generation viewport updates with visible intermediate geometry and replayable step states.
- PBR-ish bismuth material with angle-dependent color shift.
- Orbit camera.
- Quality setting that protects framerate.

Out of scope for MVP:

- Accounts.
- Backend storage.
- Collaborative editing.
- Fully physically accurate atomic simulation.
- High-poly mesh sculpting.
- Native desktop packaging.
- Server-side rendering of the 3D scene.

## Recommended Milestones

### Milestone 1: App Skeleton - Complete

- [x] Scaffold Vite + React + TypeScript.
- [x] Add R3F canvas, orbit controls, environment lighting, and basic layout.
- [x] Add Zustand-style state for seed, settings, and generation status.
- [x] Add initial placeholder procedural geometry for the app skeleton.

### Milestone 2: Deterministic Generator

- [x] Add seeded PRNG.
- [x] Implement lattice nuclei and stepped hopper growth.
- [x] Run generation in a Web Worker.
- [x] Emit small generation chunks, progress events, and final `CrystalModel`.
- [x] Add a pacing layer so generation can be slowed down when raw compute completes too quickly.
- [x] Add Vitest tests for determinism and bounds.
- [x] Add co-growing nuclei, collision merging, support pruning, and
  screw-dislocation-inspired spiral terraces.

### Milestone 3: Realtime Visualization

- [x] Stream generation chunks to the viewport.
- [ ] Add timeline playback and scrub.
- [x] Convert final model into instanced geometry.
- [x] Add quality levels.

### Milestone 4: Bismuth Material

- [x] Implement metallic PBR material.
- [x] Add oxide thickness data per block and exposed facet.
- [x] Add material-level iridescence and oxide-driven vertex colors.
- [x] Generate procedural scratch/bump detail for render-time surface texture.
- [x] Add procedural environment lighting and tone mapping.
- [ ] Replace the current art-directed oxide color mapping with a fuller
  view-angle-aware thin-film shader when the material path moves beyond
  `MeshPhysicalMaterial`.

### Milestone 5: Polish and Export

- Add presets and shareable settings in URL.
- Add screenshot export.
- Add glTF export if geometry structure is stable.
- Add Playwright screenshot/performance smoke tests.

## Core Data Contracts

Generation settings should remain serializable and versioned:

```ts
export interface GenerationSettings {
  version: number;
  seed: string;
  nucleationCount: number;
  nucleusStartDelay: number;
  nucleiVerticalSpread: number;
  initialSeedSize: number;
  crystalScale: number;
  symmetryBias: number;
  coolingRate: number;
  edgeGrowthBias: number;
  faceFillRate: number;
  terraceHeight: number;
  hopperDepth: number;
  branchingProbability: number;
  impurity: number;
  gravitySagBias: number;
  oxidationExposure: number;
  quality: 'preview' | 'standard' | 'high';
}
```

App settings extend generation settings with render-only controls. These must
not affect generation hashes or deterministic model output:

```ts
export interface CrystalSettings extends GenerationSettings {
  oxideIntensity: number;
  iridescenceThicknessRange: number;
  surfaceRoughness: number;
  scratchDetailStrength: number;
  environmentIntensity: number;
}
```

Generated output should separate semantic model data from render implementation:

```ts
export interface CrystalModel {
  settingsHash: string;
  bounds: Bounds3;
  facets: CrystalFacet[];
  blocks: CrystalBlock[];
  mesh?: PackedMesh;
  oxideRange: [number, number];
  stats: {
    generationMs: number;
    blockCount: number;
    facetCount: number;
    triangleCountEstimate: number;
  };
}
```

Timeline and chunk events should be useful for UI animation, replay, and debugging:

```ts
export interface GenerationEvent {
  step:
    | 'seed'
    | 'nucleation'
    | 'edge-growth'
    | 'face-fill'
    | 'terrace'
    | 'branch'
    | 'oxidation'
    | 'mesh-build'
    | 'complete';
  progress: number;
  message?: string;
  preview?: CrystalPreviewPayload;
  chunk?: CrystalChunkPayload;
  displayTimeMs?: number;
}
```

## Design Principles

- Make the first screen the working generator, not a marketing page.
- Prefer familiar controls over novel controls.
- Keep settings grouped by job: seed, structure, growth/model data, render/view, timeline/playback, and performance/export.
- The current parameter rail includes Seed, Structure, Growth, and Render
  sections. Keep model-data controls in Structure/Growth and render-only
  controls in Render so it remains clear which changes require regeneration.
- Treat oxidation exposure as model data because it affects generated
  surface/facet metadata. Treat oxide display intensity, film range, surface
  roughness, scratch detail strength, environment intensity, and camera motion
  as rendering/view controls.
- Make randomness inspectable: every generated result should have a seed and settings snapshot.
- Make progressive generation a primary visual mode, with smooth incremental updates rather than occasional progress jumps.
- Keep generated geometry physically plausible at the visual-model level:
  nuclei co-grow, collision fronts merge without crossing, screw-dislocation
  sources create square spiral terraces, and unsupported terminal voxels are
  pruned.
- Keep scientific claims modest and accurate.
