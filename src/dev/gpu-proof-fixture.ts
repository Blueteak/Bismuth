import {
  runGpuProof,
  serializeGpuProofError,
  type GpuProofOutcome,
} from './gpu-proof';
import './gpu-proof.css';

declare global {
  interface Window {
    __BISMUTH_GPU_PROOF__?: Promise<GpuProofOutcome>;
  }
}

export function mountGpuProofFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="gpu-proof-shell">
      <canvas class="gpu-proof-canvas" aria-label="WebGPU indirect draw proof"></canvas>
      <section class="gpu-proof-panel">
        <p class="eyebrow">Developer fixture</p>
        <h1>WebGPU capability proof</h1>
        <p data-proof-status>Initializing the hardware adapter...</p>
        <pre data-proof-output aria-live="polite"></pre>
      </section>
    </main>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('.gpu-proof-canvas');
  const status = root.querySelector<HTMLElement>('[data-proof-status]');
  const output = root.querySelector<HTMLElement>('[data-proof-output]');

  if (!canvas || !status || !output) {
    throw new Error('Unable to mount the WebGPU proof fixture.');
  }

  const includeBenchmark = new URLSearchParams(location.search).has(
    'benchmark',
  );
  const reportToRunner = new URLSearchParams(location.search).has('report');
  const runId = new URLSearchParams(location.search).get('run');
  window.__BISMUTH_GPU_PROOF__ = runGpuProof(canvas, includeBenchmark)
    .then((result): GpuProofOutcome => ({ ok: true, result }))
    .catch(serializeGpuProofError);

  void window.__BISMUTH_GPU_PROOF__.then((outcome) => {
    status.textContent = outcome.ok
      ? 'Hardware WebGPU proofs completed.'
      : 'Hardware WebGPU proof failed.';
    output.textContent = JSON.stringify(outcome, null, 2);

    if (reportToRunner && runId) {
      void fetch('/__gpu-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, outcome }),
      });
    }
  });
}
