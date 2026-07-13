import type { Candidate2CFacetedThermalCheckpoint } from '../simulation/candidate2c-faceted-thermal';
import {
  CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT,
  runCandidate2CFacetedMorphologyTimeRefinementYielding,
  type Candidate2CFacetedMorphologyRefinementComparison,
} from '../simulation/candidate2c-morphology-refinement';
import {
  CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER,
  createCandidate2CFacetedMorphologySnapshot,
  type Candidate2CFacetedMorphologyState,
} from '../simulation/candidate2c-morphology';
import type { ScalarFieldSnapshot } from '../simulation/scalar-field-snapshot';
import {
  createScalarFieldGpuSnapshotController,
  type ScalarFieldGpuSnapshotResult,
} from './scalar-field-gpu-snapshot-controller';
import './single-crystal.css';

const CHECKPOINT_HOLD_MILLISECONDS = 250;
const ALIGNMENT_TOLERANCE =
  CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT.gates
    .maximumTimeAlignmentError;

export type Candidate2CMorphologyFixtureClassification =
  | 'invalid'
  | 'non-hopper'
  | 'time-refinement-failure'
  | 'hopper-mechanism-candidate';

export interface Candidate2CMorphologyFixtureCheckpoint {
  readonly thermal: Candidate2CFacetedThermalCheckpoint;
  readonly gpu: ScalarFieldGpuSnapshotResult;
  readonly finite: boolean;
  readonly loopCrossingDetected: boolean;
}

export interface Candidate2CMorphologyGpuReview {
  readonly status: 'not-run' | 'passed' | 'failed';
  readonly passes: boolean;
  readonly checkpointCount: number;
  readonly checkpoints: readonly Candidate2CMorphologyFixtureCheckpoint[];
  readonly finalGpuSnapshot: ScalarFieldGpuSnapshotResult | null;
  readonly overflow: boolean;
  readonly uncapturedErrors: readonly string[];
}

export interface Candidate2CMorphologyFixtureResult {
  readonly classification: Candidate2CMorphologyFixtureClassification;
  readonly acceptedMorphology: false;
  readonly authoritativeComparison: Candidate2CFacetedMorphologyRefinementComparison;
  readonly gpuReview: Candidate2CMorphologyGpuReview;
  /** Compatibility summaries for the existing browser result hook. */
  readonly checkpointCount: number;
  readonly checkpoints: readonly Candidate2CMorphologyFixtureCheckpoint[];
  readonly finalGpuSnapshot: ScalarFieldGpuSnapshotResult | null;
  readonly overflow: boolean;
  readonly uncapturedErrors: readonly string[];
}

export type Candidate2CMorphologyFixtureOutcome =
  | { readonly ok: true; readonly result: Candidate2CMorphologyFixtureResult }
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
    __BISMUTH_CANDIDATE2C__?: Promise<Candidate2CMorphologyFixtureOutcome>;
  }
}

function serializeError(error: unknown): Candidate2CMorphologyFixtureOutcome {
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

function finiteCarrierState(state: Candidate2CFacetedMorphologyState): boolean {
  return [
    state.completedLayers,
    state.emittedLayers,
    state.integratedSolidVolume,
    state.time,
    state.step,
    ...state.activeLoopOffsets,
  ].every(Number.isFinite);
}

function finiteSnapshot(snapshot: ScalarFieldSnapshot): boolean {
  if (
    !Number.isFinite(snapshot.step) ||
    !Number.isFinite(snapshot.simulatedTime)
  ) {
    return false;
  }
  for (const value of snapshot.orderParameter) {
    if (!Number.isFinite(value)) return false;
  }
  return true;
}

function finiteCheckpoint(
  checkpoint: Candidate2CFacetedThermalCheckpoint,
): boolean {
  return [
    checkpoint.step,
    checkpoint.time,
    checkpoint.solidEdgeTemperature,
    checkpoint.liquidEdgeTemperature,
    checkpoint.edgeContrast,
    checkpoint.contactLineTemperature,
    checkpoint.contactLineUndercooling,
    checkpoint.surfaceFluxJump,
    checkpoint.activeTerraceCount,
    checkpoint.resolvedTerraceCount,
    checkpoint.completedLayers,
    checkpoint.emittedLayers,
    checkpoint.layerPhase,
    checkpoint.openingDepth,
    checkpoint.maximumLocalSolidHeight,
    checkpoint.cumulativeExternalHeat,
    checkpoint.cumulativeLatentHeat,
    checkpoint.ledger.thermalEnergy,
    checkpoint.ledger.expectedThermalEnergy,
    checkpoint.ledger.residual,
    checkpoint.ledger.scale,
    checkpoint.ledger.normalizedResidual,
    checkpoint.ledger.analyticSolidVolume,
    checkpoint.ledger.rasterizedSolidVolume,
    checkpoint.ledger.rasterGeometryRelativeError,
    checkpoint.ledger.expectedLatentHeat,
    checkpoint.ledger.latentResidual,
    ...checkpoint.activeLoopOffsets,
  ].every(Number.isFinite);
}

function captureCheckpoint(
  state: Candidate2CFacetedMorphologyState,
  thermal: Candidate2CFacetedThermalCheckpoint,
  scalar: ScalarFieldSnapshot,
  gpu: ScalarFieldGpuSnapshotResult,
): Candidate2CMorphologyFixtureCheckpoint {
  const aligned =
    state.step === thermal.step &&
    state.step === scalar.step &&
    state.step === gpu.step &&
    Math.abs(state.time - thermal.time) <= ALIGNMENT_TOLERANCE &&
    Math.abs(state.time - scalar.simulatedTime) <= ALIGNMENT_TOLERANCE &&
    Math.abs(state.time - gpu.simulatedTime) <= ALIGNMENT_TOLERANCE;
  return {
    thermal,
    gpu,
    finite:
      aligned &&
      finiteCarrierState(state) &&
      finiteSnapshot(scalar) &&
      finiteCheckpoint(thermal),
    loopCrossingDetected: state.loopCrossingDetected,
  };
}

function failedClassification(
  comparison: Candidate2CFacetedMorphologyRefinementComparison,
): Candidate2CMorphologyFixtureClassification {
  if (
    comparison.baseClassification === 'invalid' ||
    comparison.refinedClassification === 'invalid'
  ) {
    return 'invalid';
  }
  if (
    comparison.baseClassification === 'non-hopper' ||
    comparison.refinedClassification === 'non-hopper'
  ) {
    return 'non-hopper';
  }
  return 'time-refinement-failure';
}

function notRunGpuReview(): Candidate2CMorphologyGpuReview {
  return {
    status: 'not-run',
    passes: false,
    checkpointCount: 0,
    checkpoints: [],
    finalGpuSnapshot: null,
    overflow: false,
    uncapturedErrors: [],
  };
}

function fixtureResult(
  classification: Candidate2CMorphologyFixtureClassification,
  authoritativeComparison: Candidate2CFacetedMorphologyRefinementComparison,
  gpuReview: Candidate2CMorphologyGpuReview,
): Candidate2CMorphologyFixtureResult {
  return {
    classification,
    acceptedMorphology: false,
    authoritativeComparison,
    gpuReview,
    checkpointCount: gpuReview.checkpointCount,
    checkpoints: gpuReview.checkpoints,
    finalGpuSnapshot: gpuReview.finalGpuSnapshot,
    overflow: gpuReview.overflow,
    uncapturedErrors: gpuReview.uncapturedErrors,
  };
}

export function mountCandidate2CMorphologyFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="single-crystal-shell">
      <canvas class="single-crystal-canvas" aria-label="Candidate 2C time-refined faceted morphology progression"></canvas>
      <section class="single-crystal-header">
        <p class="eyebrow">Developer-only Candidate 2C validation</p>
        <h1>Screen-level temporal refinement</h1>
        <p data-candidate-status>Preparing the aligned authoritative arms...</p>
        <div class="single-crystal-progress" aria-hidden="true"><span data-candidate-progress></span></div>
      </section>
      <section class="single-crystal-diagnostics" aria-label="Candidate 2C diagnostics">
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
    throw new Error('Unable to mount the Candidate 2C morphology fixture.');
  }

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
    checkpoint: Candidate2CMorphologyFixtureCheckpoint,
    index: number,
    total: number,
  ): void => {
    readout.innerHTML = `
      <div><strong>${checkpoint.thermal.step}</strong><span>refined simulation step</span></div>
      <div><strong>${checkpoint.gpu.triangleCount.toLocaleString()}</strong><span>GPU triangles</span></div>
      <div><strong>${checkpoint.thermal.resolvedTerraceCount}</strong><span>resolved terraces</span></div>
      <div><strong>${checkpoint.thermal.openingDepth.toFixed(3)}</strong><span>opening depth</span></div>
    `;
    progress.style.setProperty(
      '--progress',
      `${total > 1 ? (100 * index) / (total - 1) : 100}%`,
    );
  };

  const publishResult = (result: Candidate2CMorphologyFixtureResult): void => {
    readout.dataset.result = JSON.stringify({
      classification: result.classification,
      acceptedMorphology: false,
      authoritativePasses: result.authoritativeComparison.passes,
      gpuPasses: result.gpuReview.passes,
    });
    readout.dataset.fixture = JSON.stringify(result);
  };

  const run = async (): Promise<Candidate2CMorphologyFixtureResult> => {
    await nextPaint();
    if (disposed) throw new Error('Candidate 2C fixture disposed.');
    status.textContent =
      'Running the fixed 1600/3200-step authoritative comparison before GPU extraction...';
    await nextPaint();

    const execution =
      await runCandidate2CFacetedMorphologyTimeRefinementYielding(nextPaint);
    const comparison = execution.comparison;
    if (!comparison.passes) {
      const classification = failedClassification(comparison);
      const firstFailure = comparison.firstFailedCheckpointIndex;
      status.textContent = `Authoritative temporal gate failed as ${classification}${firstFailure === null ? '' : ` at aligned checkpoint ${firstFailure}`}; GPU review was not run.`;
      const result = fixtureResult(
        classification,
        comparison,
        notRunGpuReview(),
      );
      publishResult(result);
      return result;
    }

    const carrierStates = execution.refinedCarrierStates;
    if (
      carrierStates.length !==
        CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT.refined.checkpointSteps
          .length ||
      carrierStates.length !== comparison.checkpoints.length
    ) {
      throw new Error(
        'Candidate 2C refined carrier checkpoints were not retained.',
      );
    }

    let scalar = createCandidate2CFacetedMorphologySnapshot(carrierStates[0]!);
    if (!finiteSnapshot(scalar)) {
      throw new RangeError(
        'Candidate 2C refined scalar must be finite before GPU upload.',
      );
    }
    controller = createScalarFieldGpuSnapshotController(canvas, scalar, {
      vertexCapacity:
        CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.maximumExtractionVertexCount,
      displaySpan: 5.4,
      label: 'Candidate 2C time refinement',
    });
    resize();
    status.textContent =
      'Authoritative gate passed; initializing aligned GPU extraction...';
    const diagnostics = await controller.ready;
    if (disposed) throw new Error('Candidate 2C fixture disposed.');

    const checkpoints: Candidate2CMorphologyFixtureCheckpoint[] = [];
    let finalGpuSnapshot: ScalarFieldGpuSnapshotResult | null = null;
    for (let index = 0; index < carrierStates.length; index += 1) {
      if (disposed) throw new Error('Candidate 2C fixture disposed.');
      const state = carrierStates[index]!;
      if (index > 0) {
        scalar = createCandidate2CFacetedMorphologySnapshot(state);
      }
      if (!finiteSnapshot(scalar)) {
        throw new RangeError(
          `Candidate 2C scalar at refined step ${state.step} is not finite.`,
        );
      }
      const gpu = await controller.show(scalar);
      finalGpuSnapshot = gpu;
      const checkpoint = captureCheckpoint(
        state,
        comparison.checkpoints[index]!.refined,
        scalar,
        gpu,
      );
      checkpoints.push(checkpoint);
      updateReadout(checkpoint, index, carrierStates.length);
      status.textContent = gpu.overflow
        ? `Refined step ${state.step}: GPU vertex capacity overflow; the last valid mesh is retained.`
        : `Refined step ${state.step}: GPU marching cubes promoted ${gpu.triangleCount.toLocaleString()} triangles.`;
      await holdCheckpoint();
      await nextPaint();
    }

    const uncapturedErrors = [...controller.errors];
    const overflow = checkpoints.some((checkpoint) => checkpoint.gpu.overflow);
    const gpuPasses =
      checkpoints.length === carrierStates.length &&
      checkpoints.every(
        (checkpoint) =>
          checkpoint.finite &&
          !checkpoint.loopCrossingDetected &&
          !checkpoint.gpu.overflow,
      ) &&
      uncapturedErrors.length === 0;
    const gpuReview: Candidate2CMorphologyGpuReview = {
      status: gpuPasses ? 'passed' : 'failed',
      passes: gpuPasses,
      checkpointCount: checkpoints.length,
      checkpoints,
      finalGpuSnapshot,
      overflow,
      uncapturedErrors,
    };
    const classification: Candidate2CMorphologyFixtureClassification = gpuPasses
      ? 'hopper-mechanism-candidate'
      : 'invalid';
    status.textContent = gpuPasses
      ? `Screen-level temporal refinement passed. All 17 aligned physical checkpoints used GPU marching cubes on ${diagnostics.adapter.description || diagnostics.adapter.device || diagnostics.adapter.architecture}; this is not accepted morphology.`
      : 'Authoritative refinement passed, but the aligned GPU review failed.';
    const result = fixtureResult(classification, comparison, gpuReview);
    publishResult(result);
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
