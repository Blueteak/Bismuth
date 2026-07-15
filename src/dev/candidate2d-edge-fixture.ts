import {
  CANDIDATE2D_EDGE_MORPHOLOGY_CARRIER,
  candidate2DEdgeMorphologyAnalyticVolume,
  createCandidate2DEdgeMorphologySnapshot,
} from '../simulation/candidate2d-edge-morphology';
import {
  CANDIDATE2D_EDGE_SOURCE_PROOF,
  advanceCandidate2DEdgeSourceState,
  createCandidate2DEdgeSourceState,
  runCandidate2DEdgeSourceDiscriminator,
  setCandidate2DEdgeSourceHeatRemovalRate,
  type Candidate2DEdgeSourceState,
} from '../simulation/candidate2d-edge-source';
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

export type Candidate2DEdgeFixtureArm =
  | 'no-seed-empty'
  | 'initial-reversal-empty'
  | 'forward-initial'
  | 'forward-early'
  | 'post-emission-reversal-stalled'
  | 'forward-mid'
  | 'forward-final';

export interface Candidate2DEdgeFixtureCheckpoint {
  readonly arm: Candidate2DEdgeFixtureArm;
  readonly time: number;
  readonly sourceEvents: number;
  readonly frontDistance: number;
  readonly solidVolume: number;
  readonly heatRemovalRate: number;
  readonly gpu: ScalarFieldGpuSnapshotResult;
}

export interface Candidate2DEdgeFixtureResult {
  readonly classification: 'local-edge-3d-closeout' | 'invalid';
  readonly acceptedMorphology: false;
  readonly acceptedAsTargetSource: false;
  readonly persistentSupplyDemonstrated: false;
  readonly routeSelectionDemonstrated: false;
  readonly localSourceIsolationPasses: boolean;
  readonly scalarCarrierPasses: boolean;
  readonly emptyControlsPass: boolean;
  readonly postEmissionReversalStalls: boolean;
  readonly gpuPasses: boolean;
  readonly visualTargetPasses: false;
  readonly allFourReferencesPresented: boolean;
  readonly morphologyFailureReasons: readonly [
    'one-downward-ribbon-only',
    'no-hopper-opening',
    'no-recurring-elevations',
    'no-winding-ledges',
    'no-route-selection',
  ];
  readonly changedForwardMeshPromotions: number;
  readonly checkpoints: readonly Candidate2DEdgeFixtureCheckpoint[];
  readonly finalGpuSnapshot: ScalarFieldGpuSnapshotResult;
  readonly overflow: boolean;
  readonly uncapturedErrors: readonly string[];
}

export type Candidate2DEdgeFixtureOutcome =
  | { readonly ok: true; readonly result: Candidate2DEdgeFixtureResult }
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
    __BISMUTH_CANDIDATE2D_EDGE__?: Promise<Candidate2DEdgeFixtureOutcome>;
  }
}

function serializeError(error: unknown): Candidate2DEdgeFixtureOutcome {
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
  arm: Candidate2DEdgeFixtureArm,
  state: Candidate2DEdgeSourceState,
  gpu: ScalarFieldGpuSnapshotResult,
): Candidate2DEdgeFixtureCheckpoint {
  return {
    arm,
    time: state.time,
    sourceEvents: state.events.length,
    frontDistance: state.front?.distance ?? 0,
    solidVolume: state.integratedSolidVolume,
    heatRemovalRate: state.heatRemovalRate,
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

export function mountCandidate2DEdgeFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="candidate2d-slice-shell">
      <header class="candidate2d-slice-header">
        <div>
          <p class="candidate2d-slice-eyebrow">Candidate 2D - edge/free-surface slice closeout</p>
          <h1>One wire-rooted front against the full ground truth</h1>
        </div>
        <div class="candidate2d-slice-verdict" data-candidate-verdict>
          <strong>RUNNING 3D GATE</strong>
          <span data-candidate-status>Preparing source-removed and reversed controls...</span>
        </div>
      </header>
      <section class="candidate2d-slice-grid" aria-label="Generated edge-source slice compared with all four bismuth targets">
        <article class="candidate2d-slice-generated">
          <canvas class="candidate2d-slice-canvas" aria-label="Three-dimensional one-front edge-source result"></canvas>
          <div class="candidate2d-slice-generated-label">
            <strong>Generated from source state</strong>
            <span>Exact Stefan-paid ribbon only; no seed body, hopper carrier, or target-shaped fallback</span>
          </div>
        </article>
        ${TARGET_REFERENCES.map(referenceCard).join('')}
      </section>
      <section class="candidate2d-slice-diagnostics" aria-label="Edge-source slice diagnostics">
        <div><strong data-candidate-arm>initializing</strong><span>review arm</span></div>
        <div><strong data-candidate-time>0.000</strong><span>model time</span></div>
        <div><strong data-candidate-events>0</strong><span>source events</span></div>
        <div><strong data-candidate-distance>0.000</strong><span>front distance</span></div>
        <div><strong data-candidate-volume>0.000</strong><span>solid volume</span></div>
        <div><strong data-candidate-triangles>0</strong><span>GPU triangles</span></div>
      </section>
      <section class="candidate2d-slice-boundary" aria-label="Edge-source proof and rejection boundary">
        <div>
          <strong>What this slice tests</strong>
          <span>One existing seed at a real solid-liquid-free-surface contact emits one front under positive signed Stefan heat removal; source removal and reversal stay empty or stalled.</span>
        </div>
        <div>
          <strong>Ground-truth verdict</strong>
          <span>Rejected as target source and morphology: one downward ribbon supplies no recurrence, route selection, deep opening, or winding ledges.</span>
        </div>
        <div>
          <strong>Reference scope</strong>
          <span>References 1 and 2 are the current single-hopper gate. References 3 and 4 remain visible regression constraints for later connected branching.</span>
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
    throw new Error('Unable to mount the Candidate 2D edge-source fixture.');
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
    checkpoint: Candidate2DEdgeFixtureCheckpoint,
  ): void => {
    armReadout.textContent = checkpoint.arm;
    timeReadout.textContent = checkpoint.time.toFixed(3);
    eventsReadout.textContent = String(checkpoint.sourceEvents);
    distanceReadout.textContent = checkpoint.frontDistance.toFixed(3);
    volumeReadout.textContent = checkpoint.solidVolume.toFixed(4);
    trianglesReadout.textContent =
      checkpoint.gpu.triangleCount.toLocaleString();
  };

  const run = async (): Promise<Candidate2DEdgeFixtureResult> => {
    await nextPaint();
    if (disposed) throw new Error('Candidate 2D edge-source fixture disposed.');
    const targetImages = await loadTargetReferences(root);
    const discriminator = runCandidate2DEdgeSourceDiscriminator();
    const configuration = CANDIDATE2D_EDGE_SOURCE_PROOF.configuration;
    const forwardInitial = createCandidate2DEdgeSourceState(configuration);
    const forwardEarly = advanceCandidate2DEdgeSourceState(forwardInitial, 2);
    const forwardMid = advanceCandidate2DEdgeSourceState(forwardInitial, 4);
    const forwardFinal = advanceCandidate2DEdgeSourceState(
      forwardInitial,
      CANDIDATE2D_EDGE_SOURCE_PROOF.evaluationTime,
    );
    const reversedAfterEmission = advanceCandidate2DEdgeSourceState(
      setCandidate2DEdgeSourceHeatRemovalRate(
        forwardEarly,
        -configuration.initialHeatRemovalRate,
      ),
      2,
    );
    const arms = [
      { arm: 'no-seed-empty', state: discriminator.noSeed },
      { arm: 'initial-reversal-empty', state: discriminator.reversed },
      { arm: 'forward-initial', state: forwardInitial },
      { arm: 'forward-early', state: forwardEarly },
      {
        arm: 'post-emission-reversal-stalled',
        state: reversedAfterEmission,
      },
      { arm: 'forward-mid', state: forwardMid },
      { arm: 'forward-final', state: forwardFinal },
    ] as const;

    controller = createScalarFieldGpuSnapshotController(
      canvas,
      createCandidate2DEdgeMorphologySnapshot(discriminator.noSeed),
      {
        vertexCapacity:
          CANDIDATE2D_EDGE_MORPHOLOGY_CARRIER.maximumExtractionVertexCount,
        displaySpan: 4.6,
        label: 'Candidate 2D edge-source closeout',
      },
    );
    resize();
    const diagnostics = await controller.ready;
    if (disposed) throw new Error('Candidate 2D edge-source fixture disposed.');

    const checkpoints: Candidate2DEdgeFixtureCheckpoint[] = [];
    for (const entry of arms) {
      if (disposed)
        throw new Error('Candidate 2D edge-source fixture disposed.');
      const gpu = await controller.show(
        createCandidate2DEdgeMorphologySnapshot(entry.state),
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
    ) as Record<Candidate2DEdgeFixtureArm, Candidate2DEdgeFixtureCheckpoint>;
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
      checkpointByArm['no-seed-empty'],
      checkpointByArm['initial-reversal-empty'],
      checkpointByArm['forward-initial'],
    ].every(
      (checkpoint) =>
        checkpoint.solidVolume === 0 && checkpoint.gpu.triangleCount === 0,
    );
    const postEmissionReversalStalls =
      reversedAfterEmission.heatRemovalRate < 0 &&
      approximatelyEqual(
        reversedAfterEmission.integratedSolidVolume,
        forwardEarly.integratedSolidVolume,
      ) &&
      checkpointByArm['post-emission-reversal-stalled'].gpu.triangleCount ===
        checkpointByArm['forward-early'].gpu.triangleCount;
    const scalarCarrierPasses =
      approximatelyEqual(
        candidate2DEdgeMorphologyAnalyticVolume(forwardFinal),
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
        ? 'local-edge-3d-closeout'
        : 'invalid';
    const result: Candidate2DEdgeFixtureResult = {
      classification,
      acceptedMorphology: false,
      acceptedAsTargetSource: false,
      persistentSupplyDemonstrated: false,
      routeSelectionDemonstrated: false,
      localSourceIsolationPasses: discriminator.localSourceIsolationPasses,
      scalarCarrierPasses,
      emptyControlsPass,
      postEmissionReversalStalls,
      gpuPasses,
      visualTargetPasses: false,
      allFourReferencesPresented,
      morphologyFailureReasons: [
        'one-downward-ribbon-only',
        'no-hopper-opening',
        'no-recurring-elevations',
        'no-winding-ledges',
        'no-route-selection',
      ],
      changedForwardMeshPromotions,
      checkpoints,
      finalGpuSnapshot,
      overflow,
      uncapturedErrors,
    };

    verdict.dataset.result = classification;
    verdict.classList.add(
      classification === 'local-edge-3d-closeout' ? 'is-closed' : 'is-invalid',
    );
    verdict.querySelector('strong')!.textContent =
      classification === 'local-edge-3d-closeout'
        ? 'LOCAL SOURCE PASS / TARGET SOURCE FAIL'
        : '3D CLOSEOUT INVALID';
    status.textContent =
      classification === 'local-edge-3d-closeout'
        ? `Exact one-front state extracted on ${diagnostics.adapter.description || diagnostics.adapter.device || diagnostics.adapter.architecture}; controls are empty and reversal stalls. Persistent supply and target morphology both fail.`
        : 'Edge-source 3D closeout failed; inspect the published fixture result.';
    verdict.dataset.fixture = JSON.stringify(result);
    return result;
  };

  window.__BISMUTH_CANDIDATE2D_EDGE__ = run()
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
