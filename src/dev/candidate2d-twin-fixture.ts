import {
  CANDIDATE2D_TWIN_MORPHOLOGY_CARRIER,
  candidate2DTwinMorphologyAnalyticVolume,
  createCandidate2DTwinMorphologySnapshot,
} from '../simulation/candidate2d-twin-morphology';
import {
  CANDIDATE2D_TWIN_SOURCE_PROOF,
  advanceCandidate2DTwinSourceState,
  applyCandidate2DTwinSourceHeatRemoval,
  createCandidate2DTwinSourceState,
  runCandidate2DTwinSourceDiscriminator,
  type Candidate2DTwinSourceState,
} from '../simulation/candidate2d-twin-source';
import {
  createScalarFieldGpuSnapshotController,
  type ScalarFieldGpuSnapshotResult,
} from './scalar-field-gpu-snapshot-controller';
import {
  CANDIDATE2D_TARGET_REFERENCES as TARGET_REFERENCES,
  type Candidate2DTargetReference,
} from './candidate2d-target-references';
import './candidate2d-slice-review.css';

const CHECKPOINT_HOLD_MILLISECONDS = 180;
const VOLUME_TOLERANCE = 1e-12;

export type Candidate2DTwinFixtureArm =
  | 'no-twin-empty'
  | 'initial-reversal-empty'
  | 'forward-initial'
  | 'forward-early'
  | 'post-emission-reversal-stalled'
  | 'forward-mid'
  | 'forward-final';

export interface Candidate2DTwinFixtureCheckpoint {
  readonly arm: Candidate2DTwinFixtureArm;
  readonly time: number;
  readonly sourceEvents: number;
  readonly frontDistance: number;
  readonly solidVolume: number;
  readonly undercooling: number;
  readonly gpu: ScalarFieldGpuSnapshotResult;
}

export interface Candidate2DTwinFixtureResult {
  readonly classification: 'local-twin-3d-closeout' | 'invalid';
  readonly acceptedMorphology: false;
  readonly acceptedAsTargetSource: false;
  readonly localSourceIsolationPasses: boolean;
  readonly scalarCarrierPasses: boolean;
  readonly emptyControlsPass: boolean;
  readonly postEmissionReversalStalls: boolean;
  readonly gpuPasses: boolean;
  readonly visualTargetPasses: false;
  readonly allFourReferencesPresented: boolean;
  readonly morphologyFailureReasons: readonly [
    'one-local-strip-only',
    'no-hopper-opening',
    'no-recurring-elevations',
    'no-winding-ledges',
    'no-branching-intergrowth',
  ];
  readonly changedForwardMeshPromotions: number;
  readonly checkpoints: readonly Candidate2DTwinFixtureCheckpoint[];
  readonly finalGpuSnapshot: ScalarFieldGpuSnapshotResult;
  readonly overflow: boolean;
  readonly uncapturedErrors: readonly string[];
}

export type Candidate2DTwinFixtureOutcome =
  | { readonly ok: true; readonly result: Candidate2DTwinFixtureResult }
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
    __BISMUTH_CANDIDATE2D_TWIN__?: Promise<Candidate2DTwinFixtureOutcome>;
  }
}

function serializeError(error: unknown): Candidate2DTwinFixtureOutcome {
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

function referenceCard(reference: Candidate2DTargetReference): string {
  return `
    <figure class="candidate2d-slice-reference">
      <img src="${reference.source}" alt="${reference.alt}" />
      <figcaption>
        <strong>${reference.label}</strong>
        <span>${reference.emphasis}</span>
      </figcaption>
    </figure>
  `;
}

function captureCheckpoint(
  arm: Candidate2DTwinFixtureArm,
  state: Candidate2DTwinSourceState,
  gpu: ScalarFieldGpuSnapshotResult,
): Candidate2DTwinFixtureCheckpoint {
  return {
    arm,
    time: state.time,
    sourceEvents: state.events.length,
    frontDistance: state.front?.distance ?? 0,
    solidVolume: state.integratedSolidVolume,
    undercooling: state.undercooling,
    gpu,
  };
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= VOLUME_TOLERANCE;
}

async function loadTargetReferences(
  root: HTMLElement,
): Promise<readonly HTMLImageElement[]> {
  const images = [
    ...root.querySelectorAll<HTMLImageElement>(
      '.candidate2d-slice-reference img',
    ),
  ];
  if (images.length !== TARGET_REFERENCES.length) {
    throw new Error('Candidate 2D closeout is missing a target reference.');
  }
  await Promise.all(images.map((image) => image.decode()));
  if (
    images.some(
      (image) =>
        !image.complete ||
        image.naturalWidth <= 0 ||
        image.naturalHeight <= 0 ||
        image.getBoundingClientRect().width <= 0 ||
        image.getBoundingClientRect().height <= 0,
    )
  ) {
    throw new Error(
      'Candidate 2D closeout could not present every target reference.',
    );
  }
  return images;
}

export function mountCandidate2DTwinFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="candidate2d-slice-shell">
      <header class="candidate2d-slice-header">
        <div>
          <p class="candidate2d-slice-eyebrow">Candidate 2D - twin-source slice closeout</p>
          <h1>One local front against the full ground truth</h1>
        </div>
        <div class="candidate2d-slice-verdict" data-candidate-verdict>
          <strong>RUNNING 3D GATE</strong>
          <span data-candidate-status>Preparing empty controls and the fixed WebGPU view...</span>
        </div>
      </header>
      <section class="candidate2d-slice-grid" aria-label="Generated twin-source slice compared with all four bismuth targets">
        <article class="candidate2d-slice-generated">
          <canvas class="candidate2d-slice-canvas" aria-label="Three-dimensional one-front twin-source result"></canvas>
          <div class="candidate2d-slice-generated-label">
            <strong>Generated from source state</strong>
            <span>Exact swept prism only; no hopper body or target-shaped fallback</span>
          </div>
        </article>
        ${TARGET_REFERENCES.map(referenceCard).join('')}
      </section>
      <section class="candidate2d-slice-diagnostics" aria-label="Twin-source slice diagnostics">
        <div><strong data-candidate-arm>initializing</strong><span>review arm</span></div>
        <div><strong data-candidate-time>0.000</strong><span>model time</span></div>
        <div><strong data-candidate-events>0</strong><span>source events</span></div>
        <div><strong data-candidate-distance>0.000</strong><span>front distance</span></div>
        <div><strong data-candidate-volume>0.000</strong><span>solid volume</span></div>
        <div><strong data-candidate-triangles>0</strong><span>GPU triangles</span></div>
      </section>
      <section class="candidate2d-slice-boundary" aria-label="Twin-source proof and rejection boundary">
        <div>
          <strong>What this slice tests</strong>
          <span>A single eligible twin/facet source emits one connected front, conserves its swept volume, extracts in 3D, disappears without the twin or positive driving, and stalls after driving reversal.</span>
        </div>
        <div>
          <strong>Ground-truth verdict</strong>
          <span>Rejected as target morphology: one thin strip has no deep hopper opening, recurring elevations, winding ledges, rhombohedral-pyramidal sector assembly, or branching intergrowth.</span>
        </div>
        <div>
          <strong>Reference scope</strong>
          <span>References 1 and 2 are the current single-hopper gate. References 3 and 4 remain visible regression constraints and become formal when sector branching is introduced.</span>
        </div>
      </section>
    </main>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>(
    '.candidate2d-slice-canvas',
  );
  const verdict = root.querySelector<HTMLElement>('[data-candidate-verdict]');
  const status = root.querySelector<HTMLElement>('[data-candidate-status]');
  const armReadout = root.querySelector<HTMLElement>('[data-candidate-arm]');
  const timeReadout = root.querySelector<HTMLElement>('[data-candidate-time]');
  const eventsReadout = root.querySelector<HTMLElement>(
    '[data-candidate-events]',
  );
  const distanceReadout = root.querySelector<HTMLElement>(
    '[data-candidate-distance]',
  );
  const volumeReadout = root.querySelector<HTMLElement>(
    '[data-candidate-volume]',
  );
  const trianglesReadout = root.querySelector<HTMLElement>(
    '[data-candidate-triangles]',
  );
  if (
    !canvas ||
    !verdict ||
    !status ||
    !armReadout ||
    !timeReadout ||
    !eventsReadout ||
    !distanceReadout ||
    !volumeReadout ||
    !trianglesReadout
  ) {
    throw new Error('Unable to mount the Candidate 2D twin-source fixture.');
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
    checkpoint: Candidate2DTwinFixtureCheckpoint,
  ): void => {
    armReadout.textContent = checkpoint.arm;
    timeReadout.textContent = checkpoint.time.toFixed(3);
    eventsReadout.textContent = String(checkpoint.sourceEvents);
    distanceReadout.textContent = checkpoint.frontDistance.toFixed(3);
    volumeReadout.textContent = checkpoint.solidVolume.toFixed(4);
    trianglesReadout.textContent =
      checkpoint.gpu.triangleCount.toLocaleString();
  };

  const run = async (): Promise<Candidate2DTwinFixtureResult> => {
    await nextPaint();
    if (disposed) throw new Error('Candidate 2D twin-source fixture disposed.');
    const targetImages = await loadTargetReferences(root);

    const discriminator = runCandidate2DTwinSourceDiscriminator();
    const configuration = CANDIDATE2D_TWIN_SOURCE_PROOF.configuration;
    const forwardInitial = createCandidate2DTwinSourceState(configuration);
    const forwardEarly = advanceCandidate2DTwinSourceState(forwardInitial, 2);
    const forwardMid = advanceCandidate2DTwinSourceState(forwardInitial, 4);
    const forwardFinal = advanceCandidate2DTwinSourceState(
      forwardInitial,
      CANDIDATE2D_TWIN_SOURCE_PROOF.evaluationTime,
    );
    const reversalHeat =
      -configuration.effectiveHeatCapacity * (forwardEarly.undercooling + 0.2);
    const reversedAfterEmission = advanceCandidate2DTwinSourceState(
      applyCandidate2DTwinSourceHeatRemoval(forwardEarly, reversalHeat),
      2,
    );
    const arms = [
      {
        arm: 'no-twin-empty',
        state: discriminator.noTwin,
      },
      {
        arm: 'initial-reversal-empty',
        state: discriminator.reversed,
      },
      {
        arm: 'forward-initial',
        state: forwardInitial,
      },
      {
        arm: 'forward-early',
        state: forwardEarly,
      },
      {
        arm: 'post-emission-reversal-stalled',
        state: reversedAfterEmission,
      },
      {
        arm: 'forward-mid',
        state: forwardMid,
      },
      {
        arm: 'forward-final',
        state: forwardFinal,
      },
    ] as const;

    const initialScalar = createCandidate2DTwinMorphologySnapshot(
      discriminator.noTwin,
    );
    controller = createScalarFieldGpuSnapshotController(canvas, initialScalar, {
      vertexCapacity:
        CANDIDATE2D_TWIN_MORPHOLOGY_CARRIER.maximumExtractionVertexCount,
      displaySpan: 5.4,
      label: 'Candidate 2D twin-source closeout',
    });
    resize();
    const diagnostics = await controller.ready;
    if (disposed) throw new Error('Candidate 2D twin-source fixture disposed.');

    const checkpoints: Candidate2DTwinFixtureCheckpoint[] = [];
    for (const entry of arms) {
      if (disposed) {
        throw new Error('Candidate 2D twin-source fixture disposed.');
      }
      const gpu = await controller.show(
        createCandidate2DTwinMorphologySnapshot(entry.state),
      );
      const checkpoint = captureCheckpoint(entry.arm, entry.state, gpu);
      checkpoints.push(checkpoint);
      updateReadout(checkpoint);
      status.textContent = `${entry.arm}: ${checkpoint.frontDistance.toFixed(3)} travel, ${checkpoint.solidVolume.toFixed(4)} volume, ${gpu.triangleCount.toLocaleString()} GPU triangles.`;
      await holdCheckpoint();
      await nextPaint();
    }

    const checkpointByArm = Object.fromEntries(
      checkpoints.map((checkpoint) => [checkpoint.arm, checkpoint]),
    ) as Record<Candidate2DTwinFixtureArm, Candidate2DTwinFixtureCheckpoint>;
    const forwardCheckpoints = [
      checkpointByArm['forward-initial'],
      checkpointByArm['forward-early'],
      checkpointByArm['forward-mid'],
      checkpointByArm['forward-final'],
    ];
    const changedForwardMeshPromotions = forwardCheckpoints.reduce(
      (count, current, index) =>
        index > 0 &&
        current.gpu.triangleCount !==
          forwardCheckpoints[index - 1]!.gpu.triangleCount
          ? count + 1
          : count,
      0,
    );
    const emptyControlsPass = [
      checkpointByArm['no-twin-empty'],
      checkpointByArm['initial-reversal-empty'],
      checkpointByArm['forward-initial'],
    ].every(
      (checkpoint) =>
        checkpoint.solidVolume === 0 && checkpoint.gpu.triangleCount === 0,
    );
    const postEmissionReversalStalls =
      reversedAfterEmission.undercooling < 0 &&
      approximatelyEqual(
        reversedAfterEmission.integratedSolidVolume,
        forwardEarly.integratedSolidVolume,
      ) &&
      checkpointByArm['post-emission-reversal-stalled'].gpu.triangleCount ===
        checkpointByArm['forward-early'].gpu.triangleCount;
    const scalarCarrierPasses =
      approximatelyEqual(
        candidate2DTwinMorphologyAnalyticVolume(forwardFinal),
        forwardFinal.integratedSolidVolume,
      ) && checkpointByArm['forward-final'].gpu.triangleCount > 0;
    const uncapturedErrors = [...controller.errors];
    const overflow = checkpoints.some((checkpoint) => checkpoint.gpu.overflow);
    const gpuPasses =
      emptyControlsPass &&
      postEmissionReversalStalls &&
      changedForwardMeshPromotions >= 2 &&
      !overflow &&
      uncapturedErrors.length === 0;
    const allFourReferencesPresented =
      TARGET_REFERENCES.length === 4 &&
      targetImages.length === 4 &&
      targetImages.every(
        (image) =>
          image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      );
    const finalGpuSnapshot = checkpointByArm['forward-final'].gpu;
    const classification =
      discriminator.localSourceIsolationPasses &&
      scalarCarrierPasses &&
      gpuPasses &&
      allFourReferencesPresented
        ? 'local-twin-3d-closeout'
        : 'invalid';
    const result: Candidate2DTwinFixtureResult = {
      classification,
      acceptedMorphology: false,
      acceptedAsTargetSource: false,
      localSourceIsolationPasses: discriminator.localSourceIsolationPasses,
      scalarCarrierPasses,
      emptyControlsPass,
      postEmissionReversalStalls,
      gpuPasses,
      visualTargetPasses: false,
      allFourReferencesPresented,
      morphologyFailureReasons: [
        'one-local-strip-only',
        'no-hopper-opening',
        'no-recurring-elevations',
        'no-winding-ledges',
        'no-branching-intergrowth',
      ],
      changedForwardMeshPromotions,
      checkpoints,
      finalGpuSnapshot,
      overflow,
      uncapturedErrors,
    };

    verdict.dataset.result = classification;
    verdict.classList.add(
      classification === 'local-twin-3d-closeout' ? 'is-closed' : 'is-invalid',
    );
    verdict.querySelector('strong')!.textContent =
      classification === 'local-twin-3d-closeout'
        ? 'LOCAL SOURCE PASS / TARGET MORPHOLOGY FAIL'
        : '3D CLOSEOUT INVALID';
    status.textContent =
      classification === 'local-twin-3d-closeout'
        ? `Exact one-front state extracted on ${diagnostics.adapter.description || diagnostics.adapter.device || diagnostics.adapter.architecture}; controls are empty and reversal stalls. The result visibly fails all target-shape requirements.`
        : 'Twin-source 3D closeout failed; inspect the published fixture result.';
    verdict.dataset.fixture = JSON.stringify(result);
    return result;
  };

  window.__BISMUTH_CANDIDATE2D_TWIN__ = run()
    .then((result) => ({ ok: true, result }) as const)
    .catch((error: unknown) => {
      const outcome = serializeError(error);
      if (!disposed && !outcome.ok) {
        verdict.classList.add('is-invalid');
        verdict.querySelector('strong')!.textContent = '3D CLOSEOUT FAILED';
        status.textContent = outcome.error.message;
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
