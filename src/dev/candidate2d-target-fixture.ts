import {
  CANDIDATE2D_MORPHOLOGY_CARRIER,
  createCandidate2DMorphologySnapshot,
} from '../simulation/candidate2d-morphology';
import {
  CANDIDATE2D_WINDING_PROOF,
  assessCandidate2DWindingState,
  candidate2DActiveSweepGeometry,
  createCandidate2DWindingState,
  runCandidate2DWindingSteps,
  type Candidate2DWindingState,
} from '../simulation/candidate2d-winding-ledge';
import {
  createScalarFieldGpuSnapshotController,
  type ScalarFieldGpuSnapshotResult,
} from './scalar-field-gpu-snapshot-controller';
import {
  CANDIDATE2D_TARGET_REFERENCES as TARGET_REFERENCES,
  type Candidate2DTargetReference as TargetReference,
} from './candidate2d-target-references';
import './candidate2d-target.css';

const CHECKPOINT_HOLD_MILLISECONDS = 180;

export interface Candidate2DFixtureCheckpoint {
  readonly step: number;
  readonly time: number;
  readonly completedTurns: number;
  readonly visibleElevationCount: number;
  readonly partialFrontCount: number;
  readonly sweptArea: number;
  readonly solidVolume: number;
  readonly gpu: ScalarFieldGpuSnapshotResult;
}

export interface Candidate2DFixtureResult {
  readonly classification: 'topology-extraction-proof' | 'invalid';
  readonly acceptedMorphology: false;
  readonly mechanismResolved: false;
  readonly topologyPasses: boolean;
  readonly gpuPasses: boolean;
  readonly visualTargetPasses: false;
  readonly morphologyFailureReasons: readonly [
    'opening-too-shallow-in-fixed-view',
    'insufficient-visible-bands',
    'reads-as-terrace-stack',
  ];
  readonly checkpointCount: number;
  readonly changedMeshPromotions: number;
  readonly checkpoints: readonly Candidate2DFixtureCheckpoint[];
  readonly finalGpuSnapshot: ScalarFieldGpuSnapshotResult;
  readonly overflow: boolean;
  readonly uncapturedErrors: readonly string[];
}

export type Candidate2DFixtureOutcome =
  | { readonly ok: true; readonly result: Candidate2DFixtureResult }
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
    __BISMUTH_CANDIDATE2D__?: Promise<Candidate2DFixtureOutcome>;
  }
}

function serializeError(error: unknown): Candidate2DFixtureOutcome {
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

function partialFrontCount(state: Candidate2DWindingState): number {
  return state.ledges.filter((ledge) => {
    const geometry = candidate2DActiveSweepGeometry(ledge, state.configuration);
    return (
      geometry !== null &&
      geometry.progressFraction > 1e-10 &&
      geometry.progressFraction < 1 - 1e-10
    );
  }).length;
}

function captureCheckpoint(
  state: Candidate2DWindingState,
  gpu: ScalarFieldGpuSnapshotResult,
): Candidate2DFixtureCheckpoint {
  return {
    step: state.step,
    time: state.time,
    completedTurns: state.ledges[0]?.turnOrdinal ?? 0,
    visibleElevationCount: state.ledges.filter(
      (ledge) => ledge.integratedSweptArea > 1e-10,
    ).length,
    partialFrontCount: partialFrontCount(state),
    sweptArea: state.integratedSweptArea,
    solidVolume: state.integratedSolidVolume,
    gpu,
  };
}

function referenceCard(reference: TargetReference): string {
  return `
    <figure class="candidate2d-target-card">
      <img src="${reference.source}" alt="${reference.alt}" />
      <figcaption>
        <strong>${reference.label}</strong>
        <span>${reference.emphasis}</span>
      </figcaption>
    </figure>
  `;
}

export function mountCandidate2DTargetFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="candidate2d-target-shell">
      <header class="candidate2d-target-header">
        <div>
          <p class="candidate2d-target-eyebrow">Candidate 2D - topology carrier slice</p>
          <h1>Open winding growth against the target</h1>
        </div>
        <p class="candidate2d-target-status" data-candidate-status>Preparing the explicit ledge state and production WebGPU extractor...</p>
      </header>
      <section class="candidate2d-proof-grid" aria-label="Candidate 2D generated carrier and primary targets">
        <article class="candidate2d-generated-card">
          <canvas class="candidate2d-generated-canvas" aria-label="Candidate 2D winding ledge carrier progression"></canvas>
          <div class="candidate2d-generated-label">
            <strong>Generated slice</strong>
            <span>Geometry only - source mechanism unresolved</span>
          </div>
        </article>
        ${referenceCard(TARGET_REFERENCES[0]!)}
        ${referenceCard(TARGET_REFERENCES[1]!)}
      </section>
      <section class="candidate2d-diagnostics" aria-label="Candidate 2D topology carrier diagnostics">
        <div data-candidate-readout><strong>0</strong><span>driver step</span></div>
        <div><strong data-candidate-turns>0</strong><span>completed turns</span></div>
        <div><strong data-candidate-elevations>0</strong><span>visible elevations</span></div>
        <div><strong data-candidate-fronts>0</strong><span>partial fronts</span></div>
        <div><strong data-candidate-triangles>0</strong><span>GPU triangles</span></div>
        <div class="candidate2d-progress" aria-hidden="true"><span data-candidate-progress></span></div>
      </section>
      <section class="candidate2d-boundary" aria-label="Candidate 2D proof boundary">
        <div>
          <strong>This slice can prove</strong>
          <span>Four-plane carrier, open non-self-intersecting winding, partial heads, connected swept solid, exact area/volume/latent ledger, and changing WebGPU meshes.</span>
        </div>
        <div>
          <strong>This slice cannot prove</strong>
          <span>Accepted morphology, a screw dislocation, twin-plane causation, source physics, branching, iridescent material, or production GPU-resident growth.</span>
        </div>
        <div class="candidate2d-later-targets">
          ${TARGET_REFERENCES.slice(2)
            .map(
              (reference) => `
                <figure>
                  <img src="${reference.source}" alt="${reference.alt}" />
                  <figcaption>${reference.label}: ${reference.emphasis}</figcaption>
                </figure>
              `,
            )
            .join('')}
        </div>
      </section>
    </main>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>(
    '.candidate2d-generated-canvas',
  );
  const status = root.querySelector<HTMLElement>('[data-candidate-status]');
  const readout = root.querySelector<HTMLElement>('[data-candidate-readout]');
  const turns = root.querySelector<HTMLElement>('[data-candidate-turns]');
  const elevations = root.querySelector<HTMLElement>(
    '[data-candidate-elevations]',
  );
  const fronts = root.querySelector<HTMLElement>('[data-candidate-fronts]');
  const triangles = root.querySelector<HTMLElement>(
    '[data-candidate-triangles]',
  );
  const progress = root.querySelector<HTMLElement>('[data-candidate-progress]');
  if (
    !canvas ||
    !status ||
    !readout ||
    !turns ||
    !elevations ||
    !fronts ||
    !triangles ||
    !progress
  ) {
    throw new Error('Unable to mount the Candidate 2D target fixture.');
  }

  const proof = CANDIDATE2D_WINDING_PROOF;
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

  const updateReadout = (checkpoint: Candidate2DFixtureCheckpoint): void => {
    readout.innerHTML = `<strong>${checkpoint.step}</strong><span>driver step</span>`;
    turns.textContent = String(checkpoint.completedTurns);
    elevations.textContent = String(checkpoint.visibleElevationCount);
    fronts.textContent = String(checkpoint.partialFrontCount);
    triangles.textContent = checkpoint.gpu.triangleCount.toLocaleString();
    progress.style.setProperty(
      '--progress',
      `${(100 * checkpoint.step) / proof.totalSteps}%`,
    );
  };

  const run = async (): Promise<Candidate2DFixtureResult> => {
    await nextPaint();
    if (disposed) throw new Error('Candidate 2D fixture disposed.');
    let state = createCandidate2DWindingState(proof.configuration);
    let scalar = createCandidate2DMorphologySnapshot(state);
    controller = createScalarFieldGpuSnapshotController(canvas, scalar, {
      vertexCapacity:
        CANDIDATE2D_MORPHOLOGY_CARRIER.maximumExtractionVertexCount,
      displaySpan: 5.7,
      label: 'Candidate 2D target topology carrier',
    });
    resize();
    const diagnostics = await controller.ready;
    if (disposed) throw new Error('Candidate 2D fixture disposed.');

    const checkpoints: Candidate2DFixtureCheckpoint[] = [];
    let gpu = await controller.show(scalar);
    let checkpoint = captureCheckpoint(state, gpu);
    checkpoints.push(checkpoint);
    updateReadout(checkpoint);
    status.textContent = `Base carrier extracted on ${diagnostics.adapter.description || diagnostics.adapter.device || diagnostics.adapter.architecture}.`;
    await holdCheckpoint();

    for (const checkpointStep of proof.checkpointSteps.slice(1)) {
      if (disposed) throw new Error('Candidate 2D fixture disposed.');
      state = runCandidate2DWindingSteps(state, checkpointStep - state.step);
      scalar = createCandidate2DMorphologySnapshot(state);
      gpu = await controller.show(scalar);
      checkpoint = captureCheckpoint(state, gpu);
      checkpoints.push(checkpoint);
      updateReadout(checkpoint);
      status.textContent = gpu.overflow
        ? `Step ${checkpoint.step}: GPU capacity overflow; the last valid mesh remains visible.`
        : `Step ${checkpoint.step}: ${checkpoint.completedTurns} turns and ${checkpoint.partialFrontCount} partial heads promoted as ${gpu.triangleCount.toLocaleString()} GPU triangles.`;
      await holdCheckpoint();
      await nextPaint();
    }

    const assessment = assessCandidate2DWindingState(state);
    const changedMeshPromotions = checkpoints.reduce(
      (count, current, index) =>
        index > 0 &&
        current.gpu.triangleCount !== checkpoints[index - 1]!.gpu.triangleCount
          ? count + 1
          : count,
      0,
    );
    const uncapturedErrors = [...controller.errors];
    const overflow = checkpoints.some((entry) => entry.gpu.overflow);
    const topologyPasses =
      assessment.classification === 'target-topology-carrier';
    const gpuPasses =
      checkpoints.length === proof.checkpointSteps.length &&
      changedMeshPromotions >= proof.minimumChangedMeshPromotions &&
      !overflow &&
      uncapturedErrors.length === 0;
    const result: Candidate2DFixtureResult = {
      classification:
        topologyPasses && gpuPasses ? 'topology-extraction-proof' : 'invalid',
      acceptedMorphology: false,
      mechanismResolved: false,
      topologyPasses,
      gpuPasses,
      visualTargetPasses: false,
      morphologyFailureReasons: [
        'opening-too-shallow-in-fixed-view',
        'insufficient-visible-bands',
        'reads-as-terrace-stack',
      ],
      checkpointCount: checkpoints.length,
      changedMeshPromotions,
      checkpoints,
      finalGpuSnapshot: gpu,
      overflow,
      uncapturedErrors,
    };
    status.textContent =
      result.classification === 'topology-extraction-proof'
        ? `State and extraction pass with ${changedMeshPromotions} changed meshes. Fixed-view morphology fails references 1 and 2: the result is shallow, sparse, and reads as a terrace stack.`
        : 'Candidate 2D carrier proof failed; inspect the published fixture result.';
    readout.dataset.result = JSON.stringify({
      classification: result.classification,
      acceptedMorphology: false,
      mechanismResolved: false,
      topologyPasses,
      gpuPasses,
      visualTargetPasses: false,
      changedMeshPromotions,
    });
    readout.dataset.fixture = JSON.stringify(result);
    return result;
  };

  window.__BISMUTH_CANDIDATE2D__ = run()
    .then((result) => ({ ok: true, result }) as const)
    .catch((error: unknown) => {
      const outcome = serializeError(error);
      if (!disposed && !outcome.ok) {
        status.textContent = `Candidate 2D fixture failed: ${outcome.error.message}`;
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
