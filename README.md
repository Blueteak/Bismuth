# Bismuth

An interactive 3D bismuth crystal generator. The app runs fully in the
browser, streams deterministic generation chunks from a Web Worker, and renders
physically inspired hopper, terrace, collision, and oxide-color behavior in a
React Three Fiber viewport. The current renderer uses instanced lattice blocks
with oxide-driven vertex colors, a metallic physical material, procedural
scratch/bump detail, and exposed render controls for oxide display, film range,
roughness, scratch strength, and environment intensity.

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://127.0.0.1:5173/` by default.

On Windows PowerShell, the `npm.ps1` shim may be blocked by execution policy.
Use `npm.cmd` instead:

```powershell
npm.cmd install
npm.cmd run dev
```

## Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` type-checks and builds the production bundle.
- `npm run preview` serves the production build locally.
- `npm run test` runs Vitest.

For production-style browser validation, run:

```powershell
npm.cmd run build
npm.cmd run preview -- --port 4173
```

Then open `http://127.0.0.1:4173/`, click `Regenerate`, and confirm the
preview block count streams from `0` through intermediate chunks to a completed
model with a visible WebGL canvas and no browser console errors.

Vite may warn that the first JavaScript chunk is larger than 500 kB because
three.js, React Three Fiber, Drei, and the current viewport bundle are loaded
up front. That is acceptable for the current MVP while generation remains
client-side and interactive. Revisit code splitting when export, advanced
shader, or postprocessing modules are added.
