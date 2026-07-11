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

## Normals

Derive initial normals from the phase gradient at the isosurface. Compare interpolation and filtering choices against facet readability and temporal stability. Normal treatment may be rendering-specific, but must not imply geometry that is absent from the extracted surface.

## Bismuth PBR material

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
