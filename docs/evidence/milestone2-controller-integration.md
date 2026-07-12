# Milestone 2 controller integration

Recorded on 2026-07-12 with Chromium 150, Three.js r185, and the hardware
WebGPU backend on the NVIDIA Blackwell adapter.

The developer-only `/__dev/live-controller` fixture composes the retained
`128^3` hopper solver, two parity-bound GPU surface extractors, one shared
promoted last-valid mesh, and the renderer through the imperative visualizer
controller. React does not own simulation, extraction, mesh, or per-frame
state.

## Continuous-growth result

The controller completed `50000` solver steps using 49-step presentation
batches. Every completed batch immediately classified, compacted, emitted,
and promoted a new render mesh. The final short batch also received an
extraction. The batch size is a presentation/performance choice; it does not
change the solver time step or equations and can be configured down to one
solver step per mesh promotion.

The run produced `1021` mesh promotions over a measured `18480.6 ms`:

- Average mesh update rate: `55.193 /s`.
- Median update interval: `17.0 ms`.
- 95th-percentile update interval: `31.7 ms`.
- Maximum update interval: `39.0 ms`.
- Texture parity update counts: `511 / 510`.
- Render frames: `1115`.
- Browser and uncaptured WebGPU errors: `0`.

This exceeds the `30 /s` reference-machine target and the blocking `15 /s`
minimum. Both extractor candidates promote into the same last-valid position,
normal/age, and indirect buffers. The controller does not read back the phase
volume or generated mesh.

## Why the first closure was wrong

The first controller proof promoted only ten exact checkpoints over the full
run. It proved texture-parity routing, last-valid retention, resize, disposal,
and independent render scheduling, but it did not prove continuous visible
growth. Reporting `1030` render frames beside ten mesh promotions made the
render loop look continuous even though almost all frames reused a stale mesh.

The earlier live fixture also held five checkpoints onscreen for `500 ms` so
they were easy to inspect. That dwell was useful for debugging but visually
masked the sparse update cadence. Finally, the Milestone 2 exit criterion said
"acceptable cadence" without a numeric end-to-end mesh-promotion threshold.
Kernel-only warm extraction timing (`2.55 ms` median) showed sufficient GPU
headroom but was incorrectly treated as if it established controller cadence.

These were validation and review errors. Continuous visible growth is a core
product behavior and should have blocked closure until an end-to-end promotion
rate was measured. The controller fixture now fails below `15 /s` average or
when its 95th-percentile interval exceeds `66.67 ms`.

## Other retained gates

A live viewport change from `1280 x 720` to `800 x 600` updated both the CSS
canvas size and backing dimensions without errors. Unit coverage verifies
promotion after every bounded batch, one-step configurability, ordered cadence
measurement, both texture parities, continued rendering, and disposal while
solver work is in flight. Machine-readable results are in
`milestone2-controller-integration-summary.json`.

The retained marching-cubes views preserve broad flat facets, continuous major
edges, readable face-center recesses, and nested terraces without visible
grid-pattern noise. The geometry passes the facet-quality gate, so dual
contouring is not justified at this milestone.

With the corrected continuous-growth gate, Milestone 2 is complete.
Bismuth-specific metallic and thin-film appearance, camera interaction, and
public run controls remain Milestones 3 and 4, and must preserve this cadence.
