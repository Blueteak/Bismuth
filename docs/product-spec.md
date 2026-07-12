# Product Specification

## Product statement

The Bismuth Visualizer is a desktop-browser experience that generates and displays a unique, physically motivated bismuth hopper specimen growing in real time. Watching the growth is a primary feature, not a loading transition. The stopped specimen must remain visually convincing under interactive inspection.

## Continuous-growth contract

Every meaningful stage of nucleation, faceting, hopper recession, terracing,
competition, and intergrowth must appear through the live mesh. While growth
is active, target at least `30` mesh promotions per second on the reference
machine. Less than `15` promotions per second, or a 95th-percentile interval
above `66.67 ms`, is a blocking product regression.

Render-frame rate is not a substitute for this measurement: frames that reuse
an old mesh do not make growth continuous. Extraction-kernel timing is also
insufficient by itself; validate the end-to-end interval from one promoted
render mesh to the next. Material, lighting, camera, controls, multi-grain
extensions, performance selection, and deployment must all preserve this
contract.

## Visual reference class

Use photographs of real, lab-grown bismuth hopper specimens as visual ground truth. The familiar colorful hopper forms are typically produced from high-purity molten bismuth; uncommon native bismuth specimens are not the target morphology.

The target composition is a hero specimen: usually one dominant grain with a small number of secondary grains that may nucleate at different times and orientations. The final distribution must be derived from references rather than assumed.

## Supported environment

- Current Chrome and Edge on Windows desktop.
- Hardware WebGPU is required.
- The reference development machine has an NVIDIA RTX 5080 with 16 GB VRAM.
- Broader browser, mobile, integrated-GPU, WebGL, and CPU-fallback support are outside the initial scope.

## User journey

1. The page shows a minimal loading state while WebGPU, compute/render pipelines, and the HDRI initialize.
2. The first generation starts automatically when ready.
3. The camera remains at a fixed distance and the crystal grows from small in frame toward the intended hero scale. Growth is not required to remain fully framed.
4. A gentle automatic orbit runs until the user manipulates orbit or zoom.
5. The bottom-center primary action reads `Stop` while growth is active.
6. Manual Stop halts solver advancement, completes one final surface extraction from the latest valid field, and freezes the specimen. It cannot be resumed.
7. Automatic completion freezes the specimen when growth reaches its configured domain extent.
8. In either stopped state, the primary action reads `Regenerate`.
9. Regenerate discards the current run and immediately starts a new, internally seeded generation.

## Public interface

The public experience is a full-screen black canvas with a minimal floating control treatment. Controls should fade or quiet down during inactivity and return on input.

Initial public capabilities:

- Stop an active run.
- Regenerate from a stopped or completed run.
- Orbit and zoom the camera.

Potential later capabilities, requiring explicit approval:

- A small set of stable morphology controls.
- Multiple curated HDRI presets.

## Developer-only capabilities

- Phase and chemical-potential slices.
- Raw simulation parameters.
- Fixed random seeds and replay.
- Grid and extraction resolution.
- CPU/GPU comparison output.
- Morphology metrics, GPU timing, memory estimates, and adapter details.
- Field readback and debugging visualizations.

## Non-goals

- Quantitatively predictive bismuth manufacturing simulation.
- Atomic-scale simulation.
- A claim that the published hopper model is uniquely proven for bismuth.
- Time scrubbing, pause/resume, editing, sculpting, or authored placement.
- Model, mesh, image, or animation export.
- Saved projects, accounts, persistence, seed sharing, or run history.
- Visible melt, crucible, floor, display stand, or other scene geometry.
- Public scientific diagnostics.

## Completion and timing

The reference model uses a continuing far-field driving condition and has no natural finite-reservoir completion. Product completion is therefore defined as reaching a calibrated fraction of the simulation domain, with a hard simulated-time guard for safety.

The desired visible duration is approximately 25-60 seconds. This remains a target until measured against validated resolutions on the reference GPU. Solver fidelity, resolution, and duration tradeoffs must be decided from benchmark results.

## Product success criteria

- Growth visibly produces hopper depressions, terraces, facets, competition, and intergrowth rather than revealing a prefabricated mesh.
- Growth remains continuous at or above the documented mesh-promotion floor;
  it never advances through a small set of visible checkpoints.
- Final specimens resemble the curated lab-grown bismuth reference class across many seeds.
- Metallic reflections and surface-age color variation read as bismuth and thin-film oxidation, not painted gradients.
- The first run, Stop, completion, Regenerate, orbit, and zoom are immediately understandable.
- Repeated runs remain stable, responsive, and free of resource accumulation.
