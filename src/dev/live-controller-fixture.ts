import {
  createLiveVisualizerController,
  type FoundationDiagnostics,
  type LiveVisualizerCompletion,
} from '../visualizer/visualizer-controller';
import './single-crystal.css';

export interface LiveControllerFixtureResult extends LiveVisualizerCompletion {
  readonly backend: 'webgpu';
  readonly threeRevision: string;
  readonly adapter: string;
}

type LiveControllerFixtureOutcome =
  | { readonly ok: true; readonly result: LiveControllerFixtureResult }
  | {
      readonly ok: false;
      readonly error: {
        readonly name: string;
        readonly message: string;
        readonly stack: string | null;
      };
    };

declare global {
  interface Window {
    __BISMUTH_LIVE_CONTROLLER__?: Promise<LiveControllerFixtureOutcome>;
  }
}

function serializeError(error: unknown): LiveControllerFixtureOutcome {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return {
    ok: false,
    error: {
      name: normalized.name,
      message: normalized.message,
      stack: normalized.stack ?? null,
    },
  };
}

function describeResult(
  diagnostics: FoundationDiagnostics,
  completion: LiveVisualizerCompletion,
): LiveControllerFixtureResult {
  return {
    ...completion,
    backend: diagnostics.webGpu.backend,
    threeRevision: diagnostics.webGpu.threeRevision,
    adapter:
      diagnostics.webGpu.adapter.description ||
      diagnostics.webGpu.adapter.device ||
      diagnostics.webGpu.adapter.architecture,
  };
}

export function mountLiveControllerFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="single-crystal-shell">
      <canvas class="single-crystal-canvas" aria-label="Controller-owned live GPU hopper crystal"></canvas>
      <section class="single-crystal-header">
        <p class="eyebrow">Developer-only Milestone 2 validation</p>
        <h1>Imperative live visualizer controller</h1>
        <p data-controller-status>Initializing controller-owned GPU resources...</p>
      </section>
      <section class="single-crystal-diagnostics" aria-label="Live controller diagnostics">
        <div class="single-crystal-readout" data-controller-readout></div>
      </section>
    </main>
  `;
  const canvas = root.querySelector<HTMLCanvasElement>(
    '.single-crystal-canvas',
  );
  const status = root.querySelector<HTMLElement>('[data-controller-status]');
  const readout = root.querySelector<HTMLElement>('[data-controller-readout]');
  if (!canvas || !status || !readout) {
    throw new Error('Unable to mount the live controller fixture.');
  }

  const controller = createLiveVisualizerController(canvas);
  const resize = () => {
    controller.resize(
      canvas.clientWidth,
      canvas.clientHeight,
      window.devicePixelRatio,
    );
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  window.__BISMUTH_LIVE_CONTROLLER__ = Promise.all([
    controller.ready,
    controller.completion,
  ])
    .then(([diagnostics, completion]) => {
      const result = describeResult(diagnostics, completion);
      if (!result.passed) {
        throw new Error('Live visualizer controller validation failed.');
      }
      status.textContent = `Controller completed ${result.finalStepCount.toLocaleString()} solver steps with ${result.cadence.updatesPerSecond.toFixed(1)} mesh updates per second.`;
      readout.innerHTML = `
        <div><strong>${result.cadence.updateCount}</strong><span>mesh promotions</span></div>
        <div><strong>${result.cadence.updatesPerSecond.toFixed(1)} /s</strong><span>mesh update rate</span></div>
        <div><strong>${result.cadence.percentile95IntervalMilliseconds.toFixed(1)} ms</strong><span>95th percentile interval</span></div>
        <div><strong>${result.parityUpdateCounts.join(' / ')}</strong><span>parity update counts</span></div>
        <div><strong>${result.rendererFrames}</strong><span>render frames</span></div>
        <div><strong>${result.uncapturedErrors.length}</strong><span>WebGPU errors</span></div>
      `;
      readout.dataset.result = JSON.stringify(result);
      return { ok: true, result } as const;
    })
    .catch(serializeError);

  void controller.ready
    .then(() => {
      status.textContent =
        'Controller ready. Solver, extraction, and rendering are advancing on independent cadences...';
    })
    .catch(() => undefined);
  void window.__BISMUTH_LIVE_CONTROLLER__.then((outcome) => {
    if (!outcome.ok) {
      status.textContent = `Live controller failed: ${outcome.error.message}`;
    }
  });
  window.addEventListener(
    'beforeunload',
    () => {
      resizeObserver.disconnect();
      controller.dispose();
    },
    { once: true },
  );
}
