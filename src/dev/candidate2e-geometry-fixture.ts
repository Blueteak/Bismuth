import { createScalarFieldGpuSnapshotController } from './scalar-field-gpu-snapshot-controller';
import { BISMUTH_TARGET_REFERENCES } from './bismuth-target-references';
import {
  CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1,
  runCandidate2eGeometryTest,
  type Candidate2eCellularSummary,
} from '../simulation/candidate2e-cellular';
import type { WebGpuDiagnostics } from '../rendering/webgpu-capability';
import './candidate2e-review.css';

interface Candidate2eGeometryCheckpointResult {
  readonly cellular: Candidate2eCellularSummary;
  readonly triangleCount: number;
  readonly emittedVertices: number;
  readonly overflow: boolean;
}

interface Candidate2eGeometryFixtureResult {
  readonly backend: 'webgpu';
  readonly threeRevision: string;
  readonly adapter: string;
  readonly authority: 'cpu-reference-ca-to-gpu-extraction';
  readonly configuration: typeof CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1;
  readonly checkpoints: readonly Candidate2eGeometryCheckpointResult[];
  readonly uncapturedErrors: readonly string[];
}

type Candidate2eGeometryFixtureOutcome =
  | { readonly ok: true; readonly result: Candidate2eGeometryFixtureResult }
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
    __BISMUTH_CANDIDATE_2E__?: Promise<Candidate2eGeometryFixtureOutcome>;
  }
}

function referenceCard(
  reference: (typeof BISMUTH_TARGET_REFERENCES)[number],
): string {
  return `
    <figure class="candidate2e-reference">
      <img src="${reference.source}" alt="${reference.alt}" />
      <figcaption>
        <strong>${reference.label}</strong>
        <span>${reference.emphasis}</span>
      </figcaption>
    </figure>
  `;
}

function adapterName(diagnostics: WebGpuDiagnostics): string {
  return (
    diagnostics.adapter.description ||
    diagnostics.adapter.device ||
    diagnostics.adapter.architecture ||
    'unidentified hardware adapter'
  );
}

function serializeError(error: unknown): Candidate2eGeometryFixtureOutcome {
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

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function mountCandidate2eGeometryFixture(root: HTMLElement): void {
  const run = runCandidate2eGeometryTest();
  const checkpointName = new URLSearchParams(window.location.search).get(
    'checkpoint',
  );
  const selectedCheckpointIndex =
    checkpointName === 'early' ? 0 : checkpointName === 'middle' ? 1 : 2;
  root.innerHTML = `
    <main class="candidate2e-shell">
      <section class="candidate2e-stage candidate2e-geometry-stage">
        <canvas class="candidate2e-canvas" aria-label="Candidate 2E.2 cellular geometry"></canvas>
        <header>
          <p>Candidate 2E.2 - frozen sparse edge-source test 1</p>
          <h1>Repeated local sources, finite-depth test</h1>
          <span data-candidate2e-status>Preparing CPU reference cells for GPU extraction...</span>
        </header>
        <dl class="candidate2e-boundary candidate2e-geometry-readout" data-candidate2e-readout aria-label="Candidate 2E geometry result"></dl>
      </section>
      <aside class="candidate2e-targets" aria-label="Five bismuth morphology targets">
        ${BISMUTH_TARGET_REFERENCES.map(referenceCard).join('')}
      </aside>
    </main>
  `;
  const canvas = root.querySelector<HTMLCanvasElement>('.candidate2e-canvas');
  const status = root.querySelector<HTMLElement>('[data-candidate2e-status]');
  const readout = root.querySelector<HTMLElement>('[data-candidate2e-readout]');
  if (!canvas || !status || !readout) {
    throw new Error('Unable to mount the Candidate 2E geometry fixture.');
  }

  const initial = run.checkpoints[0];
  if (!initial || run.checkpoints.length !== 3) {
    throw new Error(
      'Candidate 2E geometry run did not produce three checkpoints.',
    );
  }
  const controller = createScalarFieldGpuSnapshotController(
    canvas,
    initial.snapshot,
    {
      label: 'Candidate 2E.2 sparse edge-source test 1',
      displaySpan: 5.8,
      materialMode: 'bismuth',
    },
  );
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

  window.__BISMUTH_CANDIDATE_2E__ = controller.ready
    .then(async (diagnostics) => {
      const checkpoints: Candidate2eGeometryCheckpointResult[] = [];
      for (const checkpoint of run.checkpoints) {
        status.textContent = `Rendering step ${checkpoint.state.step} of ${CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1.checkpointSteps[2]}...`;
        const gpu = await controller.show(checkpoint.snapshot);
        checkpoints.push({
          cellular: checkpoint.summary,
          triangleCount: gpu.triangleCount,
          emittedVertices: gpu.emittedVertices,
          overflow: gpu.overflow,
        });
        await nextPaint();
      }
      const selectedCheckpoint = run.checkpoints[selectedCheckpointIndex]!;
      const shown = checkpoints[selectedCheckpointIndex]!;
      if (selectedCheckpointIndex !== 2) {
        await controller.show(selectedCheckpoint.snapshot);
        await nextPaint();
      }
      const errors = controller.errors;
      status.textContent = `Showing frozen step ${selectedCheckpoint.state.step}. Inspect pixels for morphology verdict.`;
      readout.innerHTML = `
        <div><dt>Cells</dt><dd>${shown.cellular.solidCellCount.toLocaleString()}</dd></div>
        <div><dt>Triangles</dt><dd>${shown.triangleCount.toLocaleString()}</dd></div>
        <div><dt>Ledger</dt><dd>${shown.cellular.ledgerError.toExponential(1)}</dd></div>
        <div><dt>Boundary</dt><dd>${shown.cellular.boundaryTouched ? 'touched' : 'clear'}</dd></div>
        <div><dt>Connectivity</dt><dd>${shown.cellular.faceConnected ? 'one component' : 'failed'}</dd></div>
        <div><dt>Sources / planes</dt><dd>${shown.cellular.frontSourceCount} / ${shown.cellular.frontLayerCount}</dd></div>
        <div><dt>Front cells</dt><dd>${shown.cellular.frontSolidCellCount.toLocaleString()}</dd></div>
        <div><dt>Authority</dt><dd>CPU reference -> GPU mesh</dd></div>
      `;
      const result: Candidate2eGeometryFixtureResult = {
        backend: diagnostics.backend,
        threeRevision: diagnostics.threeRevision,
        adapter: adapterName(diagnostics),
        authority: 'cpu-reference-ca-to-gpu-extraction',
        configuration: CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1,
        checkpoints,
        uncapturedErrors: errors,
      };
      readout.dataset.result = JSON.stringify(result);
      return { ok: true, result } as const;
    })
    .catch((error) => {
      const outcome = serializeError(error);
      status.textContent = outcome.ok
        ? 'Candidate 2E geometry fixture failed.'
        : `Candidate 2E geometry fixture failed: ${outcome.error.message}`;
      return outcome;
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
