import {
  CANDIDATE2C_REALTIME_DRIVER_PROOF,
  candidate2CRealtimeDriverLedger,
  createCandidate2CRealtimeDriverState,
  runCandidate2CRealtimeDriverSteps,
  type Candidate2CRealtimeDriverState,
} from '../simulation/candidate2c-realtime-driver';
import {
  CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER,
  createCandidate2CFacetedMorphologySnapshot,
  type Candidate2CFacetedMorphologyState,
} from '../simulation/candidate2c-morphology';
import {
  createScalarFieldGpuSnapshotController,
  type ScalarFieldGpuSnapshotResult,
} from './scalar-field-gpu-snapshot-controller';
import './single-crystal.css';

const CHECKPOINT_HOLD_MILLISECONDS = 200;

export interface Candidate2CRealtimeFixtureCheckpoint {
  readonly step: number;
  readonly time: number;
  readonly undercooling: number;
  readonly activeTerraceCount: number;
  readonly emittedLayers: number;
  readonly openingDepth: number;
  readonly normalizedEnergyResidual: number;
  readonly gpu: ScalarFieldGpuSnapshotResult;
}

export interface Candidate2CRealtimeFixtureResult {
  readonly classification: 'realtime-driver-proof' | 'invalid';
  readonly acceptedMorphology: false;
  readonly driverPasses: boolean;
  readonly gpuPasses: boolean;
  readonly checkpointCount: number;
  readonly changedMeshPromotions: number;
  readonly checkpoints: readonly Candidate2CRealtimeFixtureCheckpoint[];
  readonly finalGpuSnapshot: ScalarFieldGpuSnapshotResult;
  readonly overflow: boolean;
  readonly uncapturedErrors: readonly string[];
}

export type Candidate2CRealtimeFixtureOutcome =
  | { readonly ok: true; readonly result: Candidate2CRealtimeFixtureResult }
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
    __BISMUTH_CANDIDATE2C__?: Promise<Candidate2CRealtimeFixtureOutcome>;
  }
}

function serializeError(error: unknown): Candidate2CRealtimeFixtureOutcome {
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
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function holdCheckpoint(): Promise<void> {
  return new Promise((resolve) =>
    window.setTimeout(resolve, CHECKPOINT_HOLD_MILLISECONDS),
  );
}

function morphologyState(
  state: Candidate2CRealtimeDriverState,
): Candidate2CFacetedMorphologyState {
  return {
    configuration: {
      ...state.faceted.configuration,
      frame: state.faceted.frame,
    },
    activeLoopOffsets: state.faceted.activeLoopOffsets,
    completedLayers: state.faceted.completedLayers,
    emittedLayers: state.faceted.emittedLayers,
    integratedSolidVolume: state.faceted.integratedSolidVolume,
    loopCrossingDetected: state.loopCrossingDetected,
    time: state.faceted.time,
    step: state.faceted.step,
  };
}

function captureCheckpoint(
  state: Candidate2CRealtimeDriverState,
  gpu: ScalarFieldGpuSnapshotResult,
): Candidate2CRealtimeFixtureCheckpoint {
  const ledger = candidate2CRealtimeDriverLedger(state);
  return {
    step: state.faceted.step,
    time: state.faceted.time,
    undercooling: state.undercooling,
    activeTerraceCount: state.faceted.activeLoopOffsets.length,
    emittedLayers: state.faceted.emittedLayers,
    openingDepth:
      state.faceted.activeLoopOffsets.length * state.configuration.stepHeight,
    normalizedEnergyResidual: ledger.normalizedResidual,
    gpu,
  };
}

export function mountCandidate2CMorphologyFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="single-crystal-shell">
      <canvas class="single-crystal-canvas" aria-label="Candidate 2C realtime source-driver progression"></canvas>
      <section class="single-crystal-header">
        <p class="eyebrow">Retired Candidate 2C mechanism evidence</p>
        <h1>Six-facet extraction seam</h1>
        <p data-candidate-status>Preparing the evidence-only six-facet carrier...</p>
        <div class="single-crystal-progress" aria-hidden="true"><span data-candidate-progress></span></div>
      </section>
      <section class="single-crystal-diagnostics" aria-label="Candidate 2C realtime diagnostics">
        <div class="single-crystal-readout" data-candidate-readout></div>
      </section>
    </main>
  `;
  const canvas = root.querySelector<HTMLCanvasElement>(
    '.single-crystal-canvas',
  );
  const status = root.querySelector<HTMLElement>('[data-candidate-status]');
  const progress = root.querySelector<HTMLElement>('[data-candidate-progress]');
  const readout = root.querySelector<HTMLElement>('[data-candidate-readout]');
  if (!canvas || !status || !progress || !readout) {
    throw new Error('Unable to mount the Candidate 2C realtime fixture.');
  }

  const proof = CANDIDATE2C_REALTIME_DRIVER_PROOF;
  let disposed = false;
  let controller: ReturnType<
    typeof createScalarFieldGpuSnapshotController
  > | null = null;

  const resize = () => {
    controller?.resize(
      canvas.clientWidth,
      canvas.clientHeight,
      window.devicePixelRatio,
    );
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const updateReadout = (
    checkpoint: Candidate2CRealtimeFixtureCheckpoint,
  ): void => {
    readout.innerHTML = `
      <div><strong>${checkpoint.step}</strong><span>driver step</span></div>
      <div><strong>${checkpoint.gpu.triangleCount.toLocaleString()}</strong><span>GPU triangles</span></div>
      <div><strong>${checkpoint.activeTerraceCount}</strong><span>active terraces</span></div>
      <div><strong>${checkpoint.undercooling.toFixed(3)}</strong><span>lumped undercooling</span></div>
    `;
    progress.style.setProperty(
      '--progress',
      `${(100 * checkpoint.step) / proof.totalSteps}%`,
    );
  };

  const run = async (): Promise<Candidate2CRealtimeFixtureResult> => {
    await nextPaint();
    if (disposed) throw new Error('Candidate 2C fixture disposed.');
    let state = createCandidate2CRealtimeDriverState(proof.configuration);
    let scalar = createCandidate2CFacetedMorphologySnapshot(
      morphologyState(state),
    );
    controller = createScalarFieldGpuSnapshotController(canvas, scalar, {
      vertexCapacity:
        CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.maximumExtractionVertexCount,
      displaySpan: 5.4,
      label: 'Candidate 2C realtime driver',
    });
    resize();
    status.textContent = 'Initializing the production WebGPU extractor...';
    const diagnostics = await controller.ready;
    if (disposed) throw new Error('Candidate 2C fixture disposed.');

    const checkpoints: Candidate2CRealtimeFixtureCheckpoint[] = [];
    let gpu = await controller.show(scalar);
    let checkpoint = captureCheckpoint(state, gpu);
    checkpoints.push(checkpoint);
    updateReadout(checkpoint);
    status.textContent = `Step 0 extracted on ${diagnostics.adapter.description || diagnostics.adapter.device || diagnostics.adapter.architecture}.`;
    await holdCheckpoint();

    while (state.faceted.step < proof.totalSteps) {
      if (disposed) throw new Error('Candidate 2C fixture disposed.');
      const steps = Math.min(
        proof.checkpointInterval,
        proof.totalSteps - state.faceted.step,
      );
      state = runCandidate2CRealtimeDriverSteps(state, steps);
      scalar = createCandidate2CFacetedMorphologySnapshot(
        morphologyState(state),
      );
      gpu = await controller.show(scalar);
      checkpoint = captureCheckpoint(state, gpu);
      checkpoints.push(checkpoint);
      updateReadout(checkpoint);
      status.textContent = gpu.overflow
        ? `Step ${checkpoint.step}: GPU capacity overflow; the last valid mesh remains visible.`
        : `Step ${checkpoint.step}: ${checkpoint.activeTerraceCount} explicit terraces promoted as ${gpu.triangleCount.toLocaleString()} GPU triangles.`;
      await holdCheckpoint();
      await nextPaint();
    }

    const changedMeshPromotions = checkpoints.reduce(
      (count, current, index) =>
        index > 0 &&
        current.gpu.triangleCount !== checkpoints[index - 1]!.gpu.triangleCount
          ? count + 1
          : count,
      0,
    );
    const final = checkpoints.at(-1)!;
    const ledger = candidate2CRealtimeDriverLedger(state);
    const driverPasses =
      state.faceted.emittedLayers >= proof.minimumEmittedLayers &&
      state.faceted.activeLoopOffsets.length >= proof.minimumActiveTerraces &&
      final.openingDepth >=
        proof.minimumOpeningDepthInSteps * state.configuration.stepHeight &&
      !state.loopCrossingDetected &&
      ledger.normalizedResidual <= proof.maximumNormalizedEnergyResidual;
    const uncapturedErrors = [...controller.errors];
    const overflow = checkpoints.some((entry) => entry.gpu.overflow);
    const gpuPasses =
      checkpoints.length === proof.totalSteps / proof.checkpointInterval + 1 &&
      changedMeshPromotions >= proof.minimumChangedMeshPromotions &&
      !overflow &&
      uncapturedErrors.length === 0;
    const result: Candidate2CRealtimeFixtureResult = {
      classification:
        driverPasses && gpuPasses ? 'realtime-driver-proof' : 'invalid',
      acceptedMorphology: false,
      driverPasses,
      gpuPasses,
      checkpointCount: checkpoints.length,
      changedMeshPromotions,
      checkpoints,
      finalGpuSnapshot: gpu,
      overflow,
      uncapturedErrors,
    };
    status.textContent =
      result.classification === 'realtime-driver-proof'
        ? `The retired carrier still passes its extraction proof with ${changedMeshPromotions} changed GPU mesh promotions; it is not a Candidate 2D morphology candidate.`
        : 'Candidate 2C realtime proof failed; inspect the published fixture result.';
    readout.dataset.result = JSON.stringify({
      classification: result.classification,
      acceptedMorphology: false,
      driverPasses,
      gpuPasses,
      changedMeshPromotions,
    });
    readout.dataset.fixture = JSON.stringify(result);
    return result;
  };

  window.__BISMUTH_CANDIDATE2C__ = run()
    .then((result) => ({ ok: true, result }) as const)
    .catch((error: unknown) => {
      const outcome = serializeError(error);
      if (!disposed && !outcome.ok) {
        status.textContent = `Candidate 2C fixture failed: ${outcome.error.message}`;
      }
      return outcome;
    });

  window.addEventListener(
    'beforeunload',
    () => {
      disposed = true;
      resizeObserver.disconnect();
      controller?.dispose();
      controller = null;
    },
    { once: true },
  );
}
