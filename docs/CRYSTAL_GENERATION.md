# Crystal Generation Design

This document defines the initial physically inspired model for bismuth crystal generation. Generation is part of the viewing experience, so the algorithm must be built to stream visible intermediate results smoothly.

## Reality-Inspired Constraints

Bismuth display crystals are recognizable because of:

- Hopper growth: edges grow faster than face centers.
- Stepped terraces: repeated ledges create square or rectangular forms.
- Screw-dislocation spiral steps: a persistent step source winds around a defect
  and creates square spiral ledges on hopper faces.
- Hollowed centers: face interiors can lag behind edge growth.
- Branching clusters: multiple nuclei co-grow, collide, and physically merge at
  contact surfaces.
- Oxide coloration: surface oxide thickness varies and creates thin-film interference colors.
- Brittle metallic facets: large flat faces, sharp edges, and small imperfections.

The generator should create these visual cues procedurally. It does not need to simulate molecular dynamics, melt chemistry, or heat transfer at scientific fidelity.

## Recommended Algorithm

Use a discrete lattice plus compact surface extraction. The generator must be incremental: every major loop should be resumable after a small compute slice so the worker can report visual changes frequently.

### 1. Seed Initialization

Create a seeded PRNG from the user seed and settings hash. Place one or more nuclei near the model center. Each nucleus has:

- Position.
- Start delay.
- Primary orientation.
- Vertical spread inside the growth volume.
- Initial size.
- Growth budget.
- Local impurity offset.
- One or more screw-dislocation spiral sources with handedness, phase, spacing,
  and source offset.

### 2. Edge-Biased Hopper Growth

Represent each nucleus as a stack of stepped rectangular/rhomboid shells on a lattice. For each growth iteration:

- Find active frontier cells.
- Score frontier cells by edge exposure, face-center distance, orientation, cooling rate, and impurity.
- Prefer cells along outer edges and corners.
- Fill face centers more slowly according to `faceFillRate`.
- Leave recessed centers when `hopperDepth` is high.

This produces the defining hopper silhouette: developed edges with lagging centers.

### 3. Screw-Dislocation Terrace Formation

Quantize vertical growth into `terraceHeight`. Add ledges by shrinking or expanding
each layer's footprint, but do not rely on random terrace noise for the defining
spiral shape. Each nucleus should carry deterministic square-lattice spiral
sources that approximate screw-dislocation growth:

- The source acts as a persistent step that cannot disappear.
- The step advances around the source in 90-degree turns on the square lattice.
- Layer advance shifts the step phase so the ledge climbs as the crystal grows.
- The center near the source remains more recessed, preserving hopper depth.
- Secondary generic terrace bands can remain on outer faces, but hopper-center
  terraces should be driven primarily by the dislocation step.

Terraces should be visible in geometry. Fine scratches and microscopic unevenness should be delegated to normal maps or shader noise.

### 4. Branches, Co-Growth, and Collisions

When `branchingProbability` permits, spawn child nuclei from exposed corners or
high-energy edges. Child crystals inherit the parent orientation with small
rotations and perturbed spiral sources.

Multiple nuclei should generate on a shared candidate timeline, not one after
another. This lets similarly aged growth fronts interact. When nuclei collide:

- Place contact cells so the crystals physically touch instead of leaving an
  empty plane.
- Register a deterministic stop boundary for both nuclei so future growth does
  not pass through the contact surface.
- Keep visible boundary facets where the surface remains exposed.
- Avoid expensive boolean operations in the MVP.

After growth, prune unsupported terminal cells. Free-floating or single-neighbor
voxels, especially near the top of late-stage growth, are not physically
plausible and should be removed.

### 5. Oxide Thickness

Assign oxide thickness after geometry is known. Inputs:

- `oxidationExposure`.
- Height and outward normal.
- Local impurity/noise.
- Face age from growth timeline.
- Recessed areas, which may oxidize differently.

Store oxide thickness per facet or vertex. The renderer uses it for color shifting.

### 6. Geometry Build

Start with one of these output modes:

- Preview mode: instanced boxes or terraces for fast intermediate display.
- Final standard mode today: higher-resolution instanced lattice blocks.
- Future final standard mode: greedy meshed surfaces from lattice occupancy.
- Final high mode: bevel/selectively chamfer major exposed edges and add more terrace detail.

Avoid generating dense geometry for details that can be represented by normal, roughness, or color variation.

### 7. Realtime Streaming and Pacing

Treat raw computation and user-visible playback as separate concerns:

- The worker computes in short slices, ideally 2-8 ms per slice.
- Each slice can emit added/changed cells, facets, terraces, or preview instances.
- The main thread applies those chunks on animation frames.
- If the worker can compute 500 ms of geometry immediately, it should still be possible to expose that work as many small display chunks, such as 100 chunks around 5 ms each.
- If a machine is fast enough to finish before the user can perceive the growth, buffer chunks and pace their release.
- If a machine is slow, stream chunks as soon as possible and reduce preview complexity before dropping responsiveness.

The goal is not simply progress reporting. The user should see the crystal grow.

## Settings Semantics

- `coolingRate`: Higher values increase smaller terraces, more branching, and sharper incomplete hopper centers.
- `edgeGrowthBias`: Higher values favor corner/edge expansion over center fill.
- `faceFillRate`: Higher values fill hopper centers, producing chunkier crystals.
- `terraceHeight`: Controls step spacing.
- `hopperDepth`: Controls how hollow/recessed each face becomes.
- `branchingProbability`: Controls child nuclei and cluster complexity.
- `impurity`: Adds asymmetric noise, roughness, and oxidation variation.
- `oxidationExposure`: Controls generated oxide thickness range. Render-only
  oxide display intensity controls how strongly that model data is shown.
- `nucleationCount`: Controls number of initial crystals.
- `nucleusStartDelay`: Controls how far apart the first growth pulses of separate nuclei can be.
- `nucleiVerticalSpread`: Controls how much initial nuclei can be suspended above the base plane.
- `initialSeedSize`: Controls starting nucleus radius before shells grow outward.
- `crystalScale`: Overall lattice block size and radius boost.
- `symmetryBias`: Higher values keep nuclei, footprints, and drift more regular;
  lower values allow stronger asymmetry.
- `gravitySagBias`: Shifts upper layers laterally/down-axis over height for a
  subtle sagging growth bias.
- `quality`: Selects preview, standard, or high generation budgets for layer
  count, radius, chunk size, and minimum playback duration.

Render-only settings live in app state rather than generation state:

- `oxideIntensity`: Controls oxide color saturation and material iridescence strength.
- `iridescenceThicknessRange`: Controls the material film-thickness range used by three.js.
- `surfaceRoughness`: Controls material roughness.
- `scratchDetailStrength`: Controls procedural scratch/bump texture strength.
- `environmentIntensity`: Controls procedural environment lighting intensity.

Changing render-only settings must not change the generated model hash or
deterministic block layout.

## Current Implementation Notes

- The current generator precomputes candidate blocks for every nucleus, sorts
  them by deterministic growth age, and resolves occupancy/collisions in that
  shared order.
- Standard quality uses a higher-resolution lattice than the initial prototype
  while preserving the default triangle budget.
- Collision boundaries are exclusive: contact cells may fill, but candidates
  beyond the merged interface are rejected.
- A support-pruning pass runs after collision resolution to remove unsupported
  terminal voxels.
- Spiral steps are implemented as square-lattice screw-dislocation influence
  fields rather than true molecular simulation.
- The renderer currently displays blocks as an instanced lattice with generated
  oxide colors and procedural scratch/bump detail. Fine scratch detail is
  render-time surface texture, not generated crystal geometry.

## Progress and Chunk Events

Emit progress frequently enough for the UI to animate the model smoothly:

- `seed`: PRNG initialized and settings snapshot created.
- `nucleation`: initial nuclei placed.
- `edge-growth`: edge/corner biased growth iterations.
- `face-fill`: face centers fill or remain recessed.
- `terrace`: layer and step geometry committed.
- `branch`: child nuclei spawned or resolved.
- `oxidation`: oxide thickness assigned.
- `mesh-build`: final mesh packed.
- `complete`: model ready.

Progress events describe the phase. Chunk events carry visible model deltas. Do not rely on phase changes alone for animation.

Recommended chunk payloads:

- Added or removed preview instances.
- Updated terrace rings.
- Partial facet buffers.
- Oxide updates for visible facets.
- Final packed mesh buffers.

Generation should support cancellation. If the user presses regenerate while the worker is running, cancel the previous job and start a new one. Stale chunks from canceled jobs must be ignored by job id.

## Determinism Requirements

For a fixed settings object:

- Growth output must be identical.
- Timeline event sequence and chunk contents must be identical except for wall-clock duration and display pacing.
- Model stats should be stable.

Implementation rules:

- All randomness must flow through the seeded PRNG.
- Do not use `Math.random()` in generation code.
- Do not depend on object key iteration when it could change output order.
- Sort frontier candidates deterministically before resolving equal scores.
- Keep floating-point operations stable and avoid unnecessary parallel reduction.

## Performance Strategy

Generation can be richer and slower than a conventional loading step, but it must stay responsive and bounded.

- Use typed arrays for occupancy and scalar fields when possible.
- Store active frontier sets instead of scanning the full lattice each iteration.
- Use compact integer coordinates during growth.
- Convert to floats only when building render geometry.
- Prefer instancing over one React component per occupied cell today; move to
  greedy meshing when surface extraction becomes the primary final output.
- Send transferable buffers from worker to main thread for packed mesh data.
- Design long operations as resumable iterators or explicit job queues.
- Keep individual worker slices short enough that cancellation and progress remain responsive.
- Apply visual chunks on `requestAnimationFrame` rather than forcing synchronous scene rebuilds.
- Separate preview geometry updates from final mesh compaction.
- Allow a minimum playback duration for generation, such as 3-8 seconds for default presets.

Raw generation taking 5+ seconds is acceptable. The failure case is not long generation; the failure case is a frozen or visually silent generation.

## Testing Ideas

- Same seed/settings produce byte-identical packed mesh.
- Different seed produces different model hash.
- Higher `edgeGrowthBias` increases exposed edge/terrace ratio.
- Higher `faceFillRate` reduces average hopper recess depth.
- Screw-dislocation sources produce visible square spiral step fronts.
- Multi-nucleus growth creates face-adjacent contact cells rather than empty
  collision planes.
- Unsupported terminal voxels are removed from final output.
- Triangle estimate stays under quality-level budget.
- All emitted progress values are monotonic from 0 to 1.
- Chunk event ordering is deterministic for identical seed/settings.
- Pacing can slow down fast generation without changing final model output.
- Cancellation stops worker output for stale jobs.
