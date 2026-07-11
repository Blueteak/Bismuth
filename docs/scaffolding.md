# Scaffolding Handoff

## Immediate assignment

The next implementation task is milestone 0A only: create the project and module scaffolding. Stop after the 0A exit criteria. Do not continue into WebGPU compute proofs, environment integration, the phase-field solver, marching cubes, or production UI behavior unless the user explicitly expands the task.

Milestones 0B and 0C exist to keep capability spikes and asset integration separate from project bootstrap.

## Fixed inputs

- Package manager: npm with a committed `package-lock.json`.
- Three.js: exact package version `0.185.0` (r185).
- Client direction: React, strict TypeScript, and Vite.
- Test direction: Vitest and Playwright.
- Production server direction: Node.js and Express.
- Local environment: Windows and PowerShell.
- Production environment: Ubuntu EC2, later.
- Environment source asset: repository-root `hdri.jpg`, provided by the user before scaffolding begins.

Do not download, generate, replace, rename, or relocate `hdri.jpg`. Milestone 0A only verifies that it is present and leaves integration to 0C. If it is missing when work begins, report the missing prerequisite rather than substituting another asset.

## Delegated toolchain choices

The scaffolding agent may select the latest stable, non-prerelease compatible releases for Node.js, npm-managed dependencies other than Three.js, linting, formatting, and build support.

Requirements:

- Pin exact dependency versions.
- Record the selected Node.js version in `package.json` engines and a simple version file appropriate to the selected workflow.
- Use ESM unless a concrete tool incompatibility requires otherwise.
- Commit `package-lock.json`.
- Prefer one package at the repository root. Do not introduce a monorepo/workspace layer without approval.
- Record material choices in this document or `docs/decisions.md` during scaffolding.

The agent may choose exact filenames and leaf layout, but preserve these module boundaries:

- React application shell.
- Imperative visualizer controller.
- Simulation module.
- Extraction module.
- Rendering/material module.
- Developer diagnostics module.
- Express server.
- Unit, browser, and later GPU test areas.

## Milestone 0A deliverables

- Root npm package with exact dependencies and scripts.
- Strict TypeScript configuration for browser and server code.
- Vite React application shell with a full-viewport canvas host.
- Loading and unsupported-state components that can be driven by injected/mock capability state.
- An imperative visualizer-controller interface and inert implementation stub outside React reconciliation.
- Empty typed module boundaries for simulation, extraction, rendering, and developer diagnostics.
- Minimal Express TypeScript server with built-asset serving shape and `/healthz`.
- Vitest configuration and at least one meaningful state/configuration test.
- Playwright configuration and a shell test that does not require a real GPU.
- Lint, formatting, and type-check configuration selected by the agent.
- A concise root README containing install and command instructions.

Do not render a placeholder crystal, animate fake growth, expose Stop/Regenerate as if a solver exists, or use the milestone 0B proof mesh as public product content.

## Required scripts at the end of 0A

- `npm run dev` starts the Vite development server.
- `npm test` runs real Vitest tests and fails on test failure.
- `npm run test:e2e` runs the GPU-independent shell tests.
- `npm run lint` runs the selected linter.
- `npm run format:check` checks formatting without rewriting files.
- `npm run typecheck` checks browser and server TypeScript.
- `npm run build` builds the client and Express server.
- `npm start` serves the built application and `/healthz`.

Do not add a no-op `test:gpu` or `benchmark` command in 0A. Those commands become required in 0B when they have real WebGPU work to execute.

## Milestone 0A exit criteria

- A clean install succeeds using the committed lockfile.
- All required 0A scripts pass on Windows.
- The shell renders loading and unsupported states under test control.
- The Express production build serves the application and a successful health response.
- `hdri.jpg` is present but not yet integrated or modified.
- No WebGPU compute, proof geometry, fake crystal, scientific solver, or production run lifecycle has been implemented.
- Documentation remains ASCII-only.

## Selected milestone 0A toolchain

The scaffold uses one root ESM package with Node.js `24.12.0` and npm `11.6.2`. Browser code is built with React `19.2.7`, Vite `8.1.4`, and strict TypeScript `6.0.3`. Three.js remains fixed at `0.185.0`. The production server uses Express `5.2.1`. Vitest `4.1.10`, Playwright `1.61.1`, ESLint `10.7.0`, typescript-eslint `8.63.0`, and Prettier `3.9.5` provide the validation toolchain. All package versions are exact in `package.json` and the npm lockfile.

The Express server compiles separately to `dist-server`, while Vite writes browser assets to `dist`. GPU-independent shell tests remain Playwright-managed. Milestone 0B hardware proofs and benchmarks use the local Codex in-app browser. HDRI integration and public run controls remain deferred to their documented milestones.
