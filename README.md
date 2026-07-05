# Bismuth

An interactive 3D bismuth crystal generator.

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

Vite may warn that the first JavaScript chunk is larger than 500 kB because
three.js, React Three Fiber, and Drei are part of the initial viewport bundle.
That is acceptable for the first app shell. Revisit code splitting when real
generation, shader, export, or postprocessing modules are added.
