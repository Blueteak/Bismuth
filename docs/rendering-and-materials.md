# Rendering and Materials

## Surface extraction

Extract the live crystal surface at the phase isovalue `0.5` using GPU marching cubes.

Pipeline:

1. Classify every grid cell from its eight phase samples.
2. Look up triangle counts and edge intersections.
3. Prefix-sum counts to compact active cells and assign output offsets.
4. Emit positions, normals, surface birth/age data, and any stable material variation attributes.
5. Write indirect draw arguments.
6. Draw the latest valid output through Three.js storage-backed geometry.

Cell classification uses the standard Lorensen-Cline corner order
`000, 100, 110, 010, 001, 101, 111, 011`. A case bit is set when its phase
sample is on the solid side, including the threshold: `phase <= 0.5`. Thus an
x-normal plane with solid on negative x has crossing case `153`. This ordering
is shared by the CPU reference and GPU classifier and must remain fixed when
the edge and triangle lookup tables are introduced.

Active flags and per-cell triangle counts use independent hierarchical
exclusive scans with `128` values per workgroup. Each workgroup performs a
Blelloch scan in shared memory, block totals recurse until one block remains,
and parent offsets are added back down the hierarchy. Active cells then scatter
their source indices into a stable compact list. Triangle offsets remain keyed
by source cell for bounded vertex emission. Production extraction dispatches
these passes on the GPU; only small validation summaries may be read back.

Vertex emission uses the canonical Three.js r185 marching-cubes triangle table
with each triangle reversed so the `phase <= 0.5` solid convention winds toward
increasing phase. Edge intersections linearly interpolate the two phase samples
in physical grid coordinates. Triangle edges, edge endpoints, and corner
offsets share one packed read-only buffer so the emission shader stays within
the portable eight-storage-buffer WebGPU limit.

Vertex capacity is always a multiple of three. The GPU summary records
`[requested vertices, emitted vertices, overflow, triangles]`, and emission
checks the complete triangle against the emitted bound before writing any of
its vertices. An overflowed candidate is therefore bounded and detectable, but
does not replace the last valid render mesh.

Normals use clamped centered phase differences at each edge endpoint, then
interpolate and normalize the gradient at the isosurface. This points toward
increasing phase and agrees with the outward winding convention. Surface age
shares the normal buffer's fourth component. When both edge endpoints have a
captured solidification time, birth time interpolates normally; when one side
still contains the liquid sentinel `-1`, the captured endpoint is used. If
neither endpoint is captured, age is zero for that extraction.

Candidate attributes remain separate from the renderable last-valid buffers.
A promotion pass copies positions and normal/age attributes and writes
non-indexed indirect arguments `[vertex count, 1, 0, 0]` only when overflow is
zero. An overflow candidate performs neither copy nor indirect update, so the
renderer continues drawing the preceding complete mesh without CPU repair or
mesh readback.

Extraction cadence is independent from solver and render cadence. The first
live tracking fixture used five even-step checkpoints only to validate repeated
GPU extraction. It is not a production cadence model. The controller binds
both texture parities to candidates that share one promoted last-valid mesh
and now extracts after every bounded presentation batch. The retained `128^3`
profile uses 49 solver steps per mesh update, can be configured down to one,
and always extracts the final short batch.

Active growth targets `30` promoted meshes per second and blocks below `15 /s`
average or above a `66.67 ms` 95th-percentile interval. Render frames that
reuse the previous mesh do not count. Queue-complete extraction-kernel timing
excludes rendering and is useful for capacity planning, but only end-to-end
promotion intervals validate continuous growth.

The production loop must not copy the volume or generated mesh to JavaScript.

## Capacity and correctness

- Allocate an evidence-based maximum triangle capacity, not the pathological all-cells worst case.
- Detect overflow on the GPU and expose it through a small summary readback or mapped diagnostic path.
- Never issue an indirect draw beyond buffer capacity.
- Preserve the last valid surface and stop safely if overflow occurs.
- Test winding and gradient direction so the crystal is outward-facing and shadows correctly.

## Facet-quality gate

Marching cubes is the first implementation because it is direct, well understood, and compatible with the phase field. Its interpolation can round sharp crystallographic features.

Evaluate it using:

- Flatness of large facets.
- Sharpness and continuity of major edges.
- Readability of recessed hopper faces.
- Preservation of terraces at candidate resolutions.
- Absence of grid-pattern noise and excessive triangle shimmer.

If it fails this gate after the solver is converged, prototype feature-preserving dual contouring. Do not sharpen the result by altering the scientific field or applying an unexplained normal quantization effect.

The Milestone 2 retained `128^3` views pass this gate. Broad facets remain
flat, major edges remain continuous, face-center recesses and nested terraces
are readable, and no grid-pattern noise is visible. The remaining rounded
transitions follow the resolved scalar field and marching-cubes interpolation;
they do not justify dual contouring before material validation.

## Normals

Derive initial normals from the phase gradient at the isosurface. Compare interpolation and filtering choices against facet readability and temporal stability. Normal treatment may be rendering-specific, but must not imply geometry that is absent from the extracted surface.

## Bismuth PBR material

Material work must preserve the continuous-growth cadence. Expensive node
graphs, shadows, tone mapping, or camera effects cannot turn growth into sparse
mesh checkpoints; measure promotion rate with the final material enabled.

Use a Three.js physical node material with:

- Metallic substrate behavior.
- A restrained silver/pink bismuth base reflectance.
- Low-to-moderate roughness with bounded spatial variation.
- Thin-film iridescence controlled by oxide thickness.
- Environment lighting as the main source of metallic reflections.
- Directional-light contribution and self-shadowing.

Avoid painting a rainbow directly in object or world coordinates. Color must respond to view angle and environment through the thin-film model.

## Surface-age oxidation model

The oxidation model is intentionally a presentation model, not temperature- and oxygen-dependent kinetics.

- Newly solidified surface begins near a thin-film baseline.
- Oxide thickness increases monotonically with surface age.
- Prefer a fast initial change that slows or saturates rather than unbounded linear growth.
- Add low-frequency, deterministic spatial variation so equal-age surfaces are not perfectly uniform.
- Bound the thickness range to values that produce plausible bismuth-like gold, cyan, blue, purple, and magenta transitions.
- Keep the exact curve and thickness range developer-tunable until calibrated against references.

Surface age should be continuous across triangle boundaries and stable between extractions.

## Environment and lighting

- Use the user-provided repository-root `hdri.jpg` initially. Do not download, replace, rename, or relocate the source asset.
- The build may copy or bundle `hdri.jpg` as needed while preserving the root source file.
- Assign the HDRI to environment lighting/reflections but not the visible background.
- Render a solid black background.
- Include no floor, stand, crucible, melt, particles, or decorative scene geometry.
- Use one directional light for self-shadowing.
- Store environment rotation, exposure, sun direction, sun intensity, and sun color in one internal preset so reflections and shadows remain coherent.
- A public HDRI selector is deferred; the preset abstraction may exist from the start.

The milestone 0C foundation preset uses environment rotation `0`, exposure `1`, sun direction `[3, 5, 4]`, sun intensity `2.5`, and sun color `#fff4e8`. These values establish a coherent integration baseline and remain subject to material-stage calibration.

## Camera and controls

- Fixed perspective-camera distance and fixed orbit target.
- Do not automatically dolly to keep the growing crystal in frame.
- Allow orbit and zoom.
- Apply a gentle automatic orbit until the first user camera interaction.
- Stop automatic orbit after interaction; do not restart it unexpectedly.
- Growth may approach or partially exceed the desired final framing near completion.

## Public overlay

- Full-screen canvas.
- Minimal loading treatment.
- Bottom-center primary action.
- `Stop` during an active run.
- `Regenerate` after manual stop or automatic completion.
- Fade the control treatment during inactivity without making the active action inaccessible.

## Deferred rendering decisions

- Tone mapper, exposure, shadow filter, shadow resolution, and antialiasing configuration.
- Extraction cadence relative to render cadence.
- Marching-cubes versus dual-contouring final choice.
- Exact oxide curve and thickness range.
- Additional environment presets.
