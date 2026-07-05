# Crystal Generation Design

This document defines the initial physically inspired model for bismuth crystal generation. Generation is part of the viewing experience, so the algorithm must be built to stream visible intermediate results smoothly.

## Reality-Inspired Constraints

Bismuth display crystals are recognizable because of:

- Hopper growth: edges grow faster than face centers.
- Stepped terraces: repeated ledges create square or rectangular spiral-like forms.
- Hollowed centers: face interiors can lag behind edge growth.
- Branching clusters: multiple nuclei and collisions create compound forms.
- Oxide coloration: surface oxide thickness varies and creates thin-film interference colors.
- Brittle metallic facets: large flat faces, sharp edges, and small imperfections.

The generator should create these visual cues procedurally. It does not need to simulate molecular dynamics, melt chemistry, or heat transfer at scientific fidelity.

## Recommended Algorithm

Use a discrete lattice plus compact surface extraction. The generator must be incremental: every major loop should be resumable after a small compute slice so the worker can report visual changes frequently.

### 1. Seed Initialization

Create a seeded PRNG from the user seed and settings hash. Place one or more nuclei near the model center. Each nucleus has:

- Position.
- Primary orientation.
- Initial size.
- Growth budget.
- Local impurity offset.

### 2. Edge-Biased Hopper Growth

Represent each nucleus as a stack of stepped rectangular/rhomboid shells on a lattice. For each growth iteration:

- Find active frontier cells.
- Score frontier cells by edge exposure, face-center distance, orientation, cooling rate, and impurity.
- Prefer cells along outer edges and corners.
- Fill face centers more slowly according to `faceFillRate`.
- Leave recessed centers when `hopperDepth` is high.

This produces the defining hopper silhouette: developed edges with lagging centers.

### 3. Terrace Formation

Quantize vertical growth into `terraceHeight`. Add ledges/rings by shrinking or expanding each layer's footprint. Vary ledge width by seeded noise so the model avoids a perfect staircase.

Terraces should be visible in geometry. Fine scratches and microscopic unevenness should be delegated to normal maps or shader noise.

### 4. Branches and Collisions

When `branchingProbability` permits, spawn child nuclei from exposed corners or high-energy edges. Child crystals inherit the parent orientation with small rotations. When branches collide:

- Stop overlapped growth.
- Keep boundary facets if visible.
- Optionally create seam-like recesses, but avoid expensive boolean operations in the MVP.

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
- Final standard mode: greedy meshed surfaces from lattice occupancy.
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
- `oxidationExposure`: Controls oxide thickness range and color intensity.
- `nucleationCount`: Controls number of initial crystals.
- `crystalScale`: Overall output scale.

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
- Prefer greedy meshing over one cube mesh per occupied cell for final output.
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
- Triangle estimate stays under quality-level budget.
- All emitted progress values are monotonic from 0 to 1.
- Chunk event ordering is deterministic for identical seed/settings.
- Pacing can slow down fast generation without changing final model output.
- Cancellation stops worker output for stale jobs.
