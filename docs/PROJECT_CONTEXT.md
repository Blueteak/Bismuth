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

### Milestone 1: App Skeleton

- Scaffold Vite + React + TypeScript.
- Add R3F canvas, orbit controls, environment lighting, and basic layout.
- Add Zustand-style state for seed, settings, and generation status.
- Add placeholder procedural geometry.

### Milestone 2: Deterministic Generator

- Add seeded PRNG.
- Implement lattice nuclei and stepped hopper growth.
- Run generation in a Web Worker.
- Emit small generation chunks, progress events, and final `CrystalModel`.
- Add a pacing layer so generation can be slowed down when raw compute completes too quickly.
- Add Vitest tests for determinism and bounds.

### Milestone 3: Realtime Visualization

- Stream generation chunks to the viewport at animation-frame cadence where possible.
- Add timeline playback and scrub.
- Convert final model into merged or instanced geometry.
- Add quality levels.

### Milestone 4: Bismuth Material

- Implement metallic PBR material.
- Add oxide thickness data per facet or vertex.
- Add angle-dependent iridescence shader logic.
- Generate procedural normal/roughness detail maps.
- Add environment lighting and tone mapping.

### Milestone 5: Polish and Export

- Add presets and shareable settings in URL.
- Add screenshot export.
- Add glTF export if geometry structure is stable.
- Add Playwright screenshot/performance smoke tests.

## Core Data Contracts

Settings should remain serializable and versioned:

```ts
export interface CrystalSettings {
  version: number;
  seed: string;
  nucleationCount: number;
  initialSeedSize: number;
  crystalScale: number;
  coolingRate: number;
  edgeGrowthBias: number;
  faceFillRate: number;
  terraceHeight: number;
  hopperDepth: number;
  branchingProbability: number;
  impurity: number;
  oxidationExposure: number;
  quality: 'preview' | 'standard' | 'high';
}
```

Generated output should separate semantic model data from render implementation:

```ts
export interface CrystalModel {
  settingsHash: string;
  bounds: Bounds3;
  facets: CrystalFacet[];
  blocks?: CrystalBlock[];
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
- Keep the main parameter rail focused on values that affect generated model data. View-only controls such as camera turntable playback should live with the viewport or timeline, not beside growth sliders.
- Treat oxidation exposure as model data because it affects generated surface/facet metadata. Treat oxide display intensity, environment intensity, roughness display, and camera motion as rendering/view controls.
- Make randomness inspectable: every generated result should have a seed and settings snapshot.
- Make progressive generation a primary visual mode, with smooth incremental updates rather than occasional progress jumps.
- Keep scientific claims modest and accurate.
