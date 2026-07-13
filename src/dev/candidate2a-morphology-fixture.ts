import {
  createInitialCandidate2AThermalState,
  preRelaxCandidate2ASurfaceSeed,
  runCandidate2AThermalSteps,
  type Candidate2AThermalState,
} from '../simulation/candidate2a';
import {
  CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS,
  classifyCandidate2AMorphologyScreen,
  createCandidate2AMorphologyScreenConfiguration,
  measureCandidate2AMorphology,
  type Candidate2AMorphologyMetrics,
  type Candidate2AMorphologyScreenResult,
} from '../simulation/candidate2a-morphology';
import {
  createCandidate2AGpuSnapshotController,
  type Candidate2AGpuSnapshotResult,
} from './candidate2a-gpu-snapshot-controller';
import './single-crystal.css';

const CPU_BATCH_STEPS = 20;
const CHECKPOINT_HOLD_MILLISECONDS = 250;

export interface Candidate2AMorphologyFixtureResult {
  readonly screen: Candidate2AMorphologyScreenResult;
  readonly checkpointCount: number;
  readonly checkpoints: readonly Candidate2AMorphologyMetrics[];
  readonly preRelaxation: {
    readonly iterations: number;
    readonly converged: boolean;
    readonly energyDecrease: number;
    readonly relativeVolumeDrift: number;
    readonly maximumRate: number;
  };
  readonly finalGpuSnapshot: Candidate2AGpuSnapshotResult;
  readonly uncapturedErrors: readonly string[];
}

type Candidate2AMorphologyFixtureOutcome =
  | { readonly ok: true; readonly result: Candidate2AMorphologyFixtureResult }
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
    __BISMUTH_CANDIDATE2A__?: Promise<Candidate2AMorphologyFixtureOutcome>;
  }
}

function serializeError(error: unknown): Candidate2AMorphologyFixtureOutcome {
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

export function mountCandidate2AMorphologyFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="single-crystal-shell">
      <canvas class="single-crystal-canvas" aria-label="Candidate 2A morphology progression"></canvas>
      <section class="single-crystal-header">
        <p class="eyebrow">Developer-only Candidate 2A validation</p>
        <h1>GPU-extracted morphology progression</h1>
        <p data-candidate-status>Preparing the surface-attached seed...</p>
        <div class="single-crystal-progress" aria-hidden="true"><span data-candidate-progress></span></div>
      </section>
      <section class="single-crystal-diagnostics" aria-label="Candidate 2A diagnostics">
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
    throw new Error('Unable to mount the Candidate 2A morphology fixture.');
  }

  let disposed = false;
  const configuration = createCandidate2AMorphologyScreenConfiguration();
  const unrelaxed = createInitialCandidate2AThermalState(configuration);
  let controller: ReturnType<
    typeof createCandidate2AGpuSnapshotController
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
    state: Candidate2AThermalState,
    initial: Candidate2AThermalState,
    snapshot: Candidate2AGpuSnapshotResult,
  ): Candidate2AMorphologyMetrics => {
    const metrics = measureCandidate2AMorphology(state, initial);
    readout.innerHTML = `
      <div><strong>${state.step}</strong><span>simulation step</span></div>
      <div><strong>${snapshot.triangleCount.toLocaleString()}</strong><span>GPU triangles</span></div>
      <div><strong>${metrics.diffuseMaturity.toFixed(3)}x</strong><span>diffuse maturity</span></div>
      <div><strong>${metrics.normalizedOpeningDepth.toFixed(3)}</strong><span>opening depth / radius</span></div>
    `;
    progress.style.setProperty(
      '--progress',
      `${(100 * state.step) / CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total}%`,
    );
    return metrics;
  };

  const run = async (): Promise<Candidate2AMorphologyFixtureResult> => {
    await nextPaint();
    if (disposed) throw new Error('Candidate 2A fixture disposed.');
    status.textContent =
      'Pre-relaxing the diffuse half-seed under the Candidate 2A energy...';
    const relaxation = preRelaxCandidate2ASurfaceSeed(unrelaxed, {
      maximumIterations: 2000,
      rateTolerance: 0.005,
    });
    if (!relaxation.converged) {
      throw new Error(
        `Surface-seed pre-relaxation did not converge; maximum rate ${relaxation.maximumRate}.`,
      );
    }
    let state = relaxation.state;
    const initial = state;
    controller = createCandidate2AGpuSnapshotController(canvas, initial);
    resize();
    const diagnostics = await controller.ready;
    if (disposed) throw new Error('Candidate 2A fixture disposed.');

    let snapshot = await controller.show(state);
    let checkpointCount = 1;
    let midpoint: Candidate2AThermalState | undefined;
    let late: Candidate2AThermalState | undefined;
    let final: Candidate2AThermalState | undefined;
    const checkpoints = [updateReadout(state, initial, snapshot)];
    status.textContent = `Step 0 uploaded and extracted on ${diagnostics.adapter.description || diagnostics.adapter.device || diagnostics.adapter.architecture}.`;

    while (state.step < CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total) {
      if (disposed) throw new Error('Candidate 2A fixture disposed.');
      const nextCheckpoint =
        Math.floor(
          state.step / CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.checkpointInterval,
        ) *
          CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.checkpointInterval +
        CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.checkpointInterval;
      const batch = Math.min(
        CPU_BATCH_STEPS,
        nextCheckpoint - state.step,
        CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total - state.step,
      );
      state = runCandidate2AThermalSteps(state, batch);
      if (
        state.step % CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.checkpointInterval ===
          0 ||
        state.step === CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total
      ) {
        snapshot = await controller.show(state);
        checkpointCount += 1;
        checkpoints.push(updateReadout(state, initial, snapshot));
        status.textContent = snapshot.overflow
          ? `Step ${state.step}: GPU vertex capacity overflow; the last valid mesh is retained.`
          : `Step ${state.step}: CPU fields uploaded, GPU marching cubes promoted ${snapshot.triangleCount.toLocaleString()} triangles.`;
        if (state.step === CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.midpoint) {
          midpoint = state;
        }
        if (state.step === CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.late) {
          late = state;
        }
        if (state.step === CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total) {
          final = state;
        }
        await holdCheckpoint();
      }
      await nextPaint();
    }

    if (!midpoint || !late || !final) {
      throw new Error('Candidate 2A morphology checkpoints were not retained.');
    }
    const screen = classifyCandidate2AMorphologyScreen({
      initial,
      midpoint,
      late,
      final,
    });
    status.textContent = `3D rejection screen: ${screen.classification}. Every 100-step checkpoint used GPU marching cubes.`;
    const result: Candidate2AMorphologyFixtureResult = {
      screen,
      checkpointCount,
      checkpoints,
      preRelaxation: {
        iterations: relaxation.iterations,
        converged: relaxation.converged,
        energyDecrease: relaxation.initialEnergy - relaxation.finalEnergy,
        relativeVolumeDrift: relaxation.relativeVolumeDrift,
        maximumRate: relaxation.maximumRate,
      },
      finalGpuSnapshot: snapshot,
      uncapturedErrors: [...controller.errors],
    };
    readout.dataset.result = JSON.stringify(screen);
    readout.dataset.fixture = JSON.stringify(result);
    return result;
  };

  window.__BISMUTH_CANDIDATE2A__ = run()
    .then((result) => ({ ok: true, result }) as const)
    .catch((error: unknown) => {
      const outcome = serializeError(error);
      if (!disposed && !outcome.ok) {
        status.textContent = `Candidate 2A fixture failed: ${outcome.error.message}`;
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
