# Milestone 3 Initial Material Integration

Recorded 2026-07-12 on the local hardware WebGPU reference path.

## Scope

This record covers the first Milestone 3 slice only. It validates the
surface-age-to-oxide mapping, physical node-material binding, initial fixed
camera fixture, correction of a hard interior color seam, and continuous mesh
promotion with the material enabled. It does not close Milestone 3 or claim
final oxide calibration against specimen references.

## Material path

- Three.js revision: `185`.
- Backend: hardware `webgpu` in the Codex in-app browser.
- Adapter architecture: `blackwell`.
- Viewport and device scale: `1280 x 720` at `1`.
- Fixed camera: `[4.2, 3.1, 4.6]`, looking at the origin.
- Oxide model: literal monotonic exponential `40..600 nm`, nominal half-rise age `90`,
  with balanced deterministic low-frequency rate variation.
- Physical material: metallic bismuth substrate, iridescence strength `0.72`,
  roughness `0.30`, and provisional oxide-film IOR `2.1`.
- Rendering normal: object-to-view transformed original one-voxel phase
  gradient; wider derivative experiments did not move the age-following border
  and were reverted.
- Surface age: liquid `-1` endpoints resolve to current simulated time before
  edge interpolation, preserving the isosurface interpolation factor.

## Hard-seam investigation

The first age-driven screenshots contained a hard moving color boundary.
Constant-thickness, oxide-range, IOR, ping-pong, and rendering-normal
experiments changed its color or width but did not remove it. Those
unsuccessful remappings and normal changes were removed.

One correctness issue was a coordinate-space mismatch. Marching cubes emits the
phase-gradient normal in object space, but Three.js physical node lighting and
iridescence consume `normalNode` in view space. The material had assigned the
storage attribute directly, so its normal was compared with view-space eye and
light vectors without the model-view normal transform. The corrected bismuth
and neutral storage-backed material paths call `transformNormalToView(...)`
before normalization and assignment. This fixed the shading basis, but the
moving age-following border remained.

The border's root cause was the liquid birth-time sentinel rule. A
marching-cubes crossing normally has one captured solid endpoint and one
not-yet-solid endpoint containing `-1`. The old rule discarded the edge
interpolation factor and used the captured endpoint's full age. The corrected
rule resolves `-1` to current simulated time, representing age zero, and then
interpolates birth time normally to the isosurface. The moving hard boundary
disappeared immediately while literal monotonic oxide kinetics remained.

The final corrected fixed-camera screenshot has coherent broad age color and
view-dependent reflections without the false moving border. The
developer-only constant-thickness query remains available for future optical
A/B diagnosis.

The hardware analytic-plane regression covers the corrected rule. Its `294`
vertices all emitted age `4.0000019073` against expected age `4`, within a
dedicated `4e-6` float32 interpolation tolerance, with zero age mismatches.

## Continuous-growth result

The corrected `128^3`, `50000`-step run used 49-step presentation batches and
reported:

| Metric                   |       Result |
| ------------------------ | -----------: |
| Mesh promotions          |       `1021` |
| Measured duration        | `18997.1 ms` |
| Average promotion rate   |  `53.692 /s` |
| Median interval          |    `17.0 ms` |
| 95th-percentile interval |    `31.9 ms` |
| Maximum interval         |   `192.5 ms` |
| Texture-parity updates   |  `511 / 510` |
| Renderer frames          |       `1136` |
| Uncaptured WebGPU errors |          `0` |

The result exceeds the `30 /s` target and remains inside the `15 /s` average
and `66.67 ms` 95th-percentile blocking limits.

## Fixed age samples

At the fixture's retained sample position, the provisional mapping produced:

| Surface age | Oxide thickness |
| ----------: | --------------: |
|         `0` |     `40.000 nm` |
|        `45` |    `188.017 nm` |
|        `90` |    `296.911 nm` |
|       `180` |    `435.959 nm` |
|       `500` |    `581.508 nm` |

These values are deterministic test inputs, not calibrated oxidation kinetics.
