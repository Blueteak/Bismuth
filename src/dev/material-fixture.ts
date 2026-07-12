import {
  DEFAULT_OXIDE_THICKNESS_MODEL,
  surfaceAgeToOxideThickness,
} from '../rendering';
import {
  createLiveVisualizerController,
  type FoundationDiagnostics,
  type LiveVisualizerCompletion,
} from '../visualizer/visualizer-controller';
import './single-crystal.css';

const MATERIAL_SAMPLE_AGES = [0, 45, 90, 180, 500] as const;
const MATERIAL_SAMPLE_POSITION = [0, 0, 0] as const;

export interface MaterialFixtureResult extends LiveVisualizerCompletion {
  readonly backend: 'webgpu';
  readonly threeRevision: string;
  readonly adapter: string;
  readonly fixedCamera: readonly [4.2, 3.1, 4.6];
  readonly oxideThicknessOverrideNanometers: number | null;
  readonly oxideThicknessSamples: readonly {
    readonly surfaceAge: number;
    readonly thicknessNanometers: number;
  }[];
}

type MaterialFixtureOutcome =
  | { readonly ok: true; readonly result: MaterialFixtureResult }
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
    __BISMUTH_MATERIAL__?: Promise<MaterialFixtureOutcome>;
  }
}

function serializeError(error: unknown): MaterialFixtureOutcome {
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
  oxideThicknessOverrideNanometers: number | undefined,
): MaterialFixtureResult {
  return {
    ...completion,
    backend: diagnostics.webGpu.backend,
    threeRevision: diagnostics.webGpu.threeRevision,
    adapter:
      diagnostics.webGpu.adapter.description ||
      diagnostics.webGpu.adapter.device ||
      diagnostics.webGpu.adapter.architecture,
    fixedCamera: [4.2, 3.1, 4.6],
    oxideThicknessOverrideNanometers: oxideThicknessOverrideNanometers ?? null,
    oxideThicknessSamples: MATERIAL_SAMPLE_AGES.map((surfaceAge) => ({
      surfaceAge,
      thicknessNanometers: surfaceAgeToOxideThickness(
        surfaceAge,
        MATERIAL_SAMPLE_POSITION,
      ),
    })),
  };
}

export function mountMaterialFixture(root: HTMLElement): void {
  const overrideArgument = new URLSearchParams(window.location.search).get(
    'constantThickness',
  );
  const oxideThicknessOverrideNanometers =
    overrideArgument === null ? undefined : Number(overrideArgument);
  if (
    oxideThicknessOverrideNanometers !== undefined &&
    !Number.isFinite(oxideThicknessOverrideNanometers)
  ) {
    throw new Error('constantThickness must be a finite number.');
  }
  root.innerHTML = `
    <main class="single-crystal-shell">
      <canvas class="single-crystal-canvas" aria-label="Surface-age-driven bismuth material"></canvas>
      <section class="single-crystal-header">
        <p class="eyebrow">Developer-only Milestone 3 validation</p>
        <h1>Bismuth oxide material study</h1>
        <p data-material-status>Initializing physical node material...</p>
      </section>
      <section class="single-crystal-diagnostics" aria-label="Material diagnostics">
        <div class="single-crystal-readout" data-material-readout></div>
      </section>
    </main>
  `;
  const canvas = root.querySelector<HTMLCanvasElement>(
    '.single-crystal-canvas',
  );
  const status = root.querySelector<HTMLElement>('[data-material-status]');
  const readout = root.querySelector<HTMLElement>('[data-material-readout]');
  if (!canvas || !status || !readout) {
    throw new Error('Unable to mount the material fixture.');
  }

  const controller = createLiveVisualizerController(canvas, {
    materialMode: 'bismuth',
    ...(oxideThicknessOverrideNanometers === undefined
      ? {}
      : { oxideThicknessOverrideNanometers }),
  });
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

  window.__BISMUTH_MATERIAL__ = Promise.all([
    controller.ready,
    controller.completion,
  ])
    .then(([diagnostics, completion]) => {
      const result = describeResult(
        diagnostics,
        completion,
        oxideThicknessOverrideNanometers,
      );
      if (!result.passed || result.materialMode !== 'bismuth') {
        throw new Error('Bismuth material validation failed.');
      }
      status.textContent = `Material run completed with ${result.cadence.updatesPerSecond.toFixed(1)} mesh promotions per second.`;
      readout.innerHTML = `
        <div><strong>${result.cadence.updateCount}</strong><span>mesh promotions</span></div>
        <div><strong>${result.cadence.updatesPerSecond.toFixed(1)} /s</strong><span>mesh update rate</span></div>
        <div><strong>${result.cadence.percentile95IntervalMilliseconds.toFixed(1)} ms</strong><span>95th percentile</span></div>
        <div><strong>${DEFAULT_OXIDE_THICKNESS_MODEL.minimumNanometers}..${DEFAULT_OXIDE_THICKNESS_MODEL.maximumNanometers} nm</strong><span>oxide range</span></div>
      `;
      readout.dataset.result = JSON.stringify(result);
      return { ok: true, result } as const;
    })
    .catch(serializeError);

  void controller.ready
    .then(() => {
      status.textContent =
        'Material ready. Surface age is driving live thin-film iridescence...';
    })
    .catch(() => undefined);
  void window.__BISMUTH_MATERIAL__.then((outcome) => {
    if (!outcome.ok) {
      status.textContent = `Material fixture failed: ${outcome.error.message}`;
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
