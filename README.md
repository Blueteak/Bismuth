# Bismuth Visualizer

A browser-based real-time visualizer for physically motivated bismuth hopper-crystal growth. Milestone 0C is complete: the application shell, strict hardware-WebGPU initialization, deterministic GPU capability proofs, supplied reflection environment, empty foundation scene, and production-serving shape are present. Crystal simulation remains intentionally unimplemented.

## Prerequisites

- Node.js 24.12.0 (see `.nvmrc`)
- npm 11.6.2
- The Codex in-app browser with hardware WebGPU for GPU tests and benchmarks
- The user-provided `hdri.jpg` at the repository root (integrated in 0C without modifying the source file)

## Install and run

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the local URL printed by Vite.

## Validation commands

```powershell
npm.cmd test
npm.cmd run test:gpu
npm.cmd run test:e2e
npm.cmd run benchmark
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

The production server uses `PORT=3000` by default and exposes `GET /healthz`.

`test:gpu` and `benchmark` start a temporary local fixture and wait for a report from the Codex in-app browser. Open the printed fixture URL in that browser. The fixture fails if it cannot obtain a hardware adapter, if Three.js selects a fallback backend, if the numerical or indirect-draw proof fails, or if WebGPU reports an uncaptured error. The latest report is written to `test-results/gpu/latest.json`.
