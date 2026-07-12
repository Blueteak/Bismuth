import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  Scene,
} from 'three/webgpu';
import { storage } from 'three/tsl';
import { createGpuSurfaceExtractor } from '../extraction';
import { createWebGpuSession } from '../rendering/webgpu-capability';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
  type SimulationConfiguration,
} from '../simulation/config';
import { createGpuSingleCrystalSolver } from '../simulation/gpu-solver';
import {
  evaluateLiveExtractionSamples,
  planLiveExtractionCheckpoints,
  type LiveExtractionCadence,
  type LiveExtractionSample,
} from './live-extraction-validation';
import './single-crystal.css';

const DEFAULT_GRID_SIZE = 128;
const DEFAULT_STEPS = 50_000;
const VERTEX_CAPACITY = 300_000;
const CHECKPOINT_DISPLAY_MILLISECONDS = 500;

export interface LiveExtractionFixtureResult {
  readonly grid: number;
  readonly steps: number;
  readonly simulatedTime: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly overflow: boolean;
  readonly extractionSamples: readonly LiveExtractionSample[];
  readonly renderedCheckpointCount: number;
  readonly checkpointDisplayMilliseconds: number;
  readonly cadence: LiveExtractionCadence;
  readonly distinctVertexCounts: number;
  readonly extractionMilliseconds: number;
  readonly backend: 'webgpu';
  readonly uncapturedErrors: readonly string[];
  readonly passed: boolean;
}

type LiveExtractionFixtureOutcome =
  | { readonly ok: true; readonly result: LiveExtractionFixtureResult }
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
    __BISMUTH_LIVE_EXTRACTION__?: Promise<LiveExtractionFixtureOutcome>;
  }
}

function parseInteger(
  query: URLSearchParams,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = query.get(name);
  if (value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`Invalid ${name}: ${value}.`);
  }
  return parsed;
}

function createLiveConfiguration(gridSize: number): SimulationConfiguration {
  const base = createSimulationConfiguration('hopper');
  return {
    ...base,
    phaseOperator: 'conservative-flux',
    domainMode: 'full',
    parameters: {
      ...base.parameters,
      criticalRadius: 10,
      initialRadius: 20,
      interfaceWidth: 2,
      liquidDiffusivity: 1 / 12,
      farFieldChemicalPotential: 0.04,
      surfaceEnergyScale: 0.3203895937459951,
    },
    grid: {
      ...base.grid,
      shape: [gridSize, gridSize, gridSize],
      spacing: 2,
      timeStep: 0.01,
    },
    perturbations: {
      seed: 99_539_473,
      seedRadiusAmplitude: 0.3,
      seedRadiusCorrelationLength: 8,
      chemicalPotentialAmplitude: 0.006,
      chemicalPotentialCorrelationLength: 12,
      farFieldGradient: [0.00018, -0.0001, 0.00014],
    },
  };
}

async function runLiveExtractionFixture(
  canvas: HTMLCanvasElement,
  status: HTMLElement,
  progress: HTMLElement,
  readout: HTMLElement,
): Promise<LiveExtractionFixtureResult> {
  const query = new URLSearchParams(location.search);
  const gridSize = parseInteger(query, 'grid', DEFAULT_GRID_SIZE, 32, 128);
  const steps = parseInteger(query, 'steps', DEFAULT_STEPS, 1, DEFAULT_STEPS);
  const extractionCheckpoints = planLiveExtractionCheckpoints(steps);
  const configuration = deriveSimulationConfiguration(
    createLiveConfiguration(gridSize),
  );
  const session = await createWebGpuSession(canvas);
  const solver = createGpuSingleCrystalSolver(
    session.renderer,
    session.device,
    configuration,
  );
  let extractor: ReturnType<typeof createGpuSurfaceExtractor> | undefined;

  try {
    await solver.initialize();
    const displaySpacing = 5.4 / gridSize;
    const displayMinimum = (-(gridSize - 1) / 2) * displaySpacing;
    const extractionSource = solver.currentTextures;
    extractor = createGpuSurfaceExtractor(
      extractionSource.phase,
      extractionSource.solidificationTime,
      configuration.grid.shape,
      {
        spacing: displaySpacing,
        physicalOrigin: [displayMinimum, displayMinimum, displayMinimum],
        vertexCapacity: VERTEX_CAPACITY,
        initialSimulatedTime: solver.simulatedTime,
      },
    );

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(3), 3),
    );
    geometry.setIndirect(extractor.lastValidMesh.indirect);
    const material = new MeshStandardNodeMaterial({
      color: 0xc2d0d4,
      metalness: 0.78,
      roughness: 0.28,
    });
    const positionStorage = storage(
      extractor.lastValidMesh.positions,
      'vec4',
      VERTEX_CAPACITY,
    );
    const normalAgeStorage = storage(
      extractor.lastValidMesh.normalAge,
      'vec4',
      VERTEX_CAPACITY,
    );
    material.positionNode = positionStorage.toAttribute().xyz;
    material.normalNode = normalAgeStorage.toAttribute().xyz;
    const mesh = new Mesh(geometry, material);
    mesh.name = 'Live GPU marching-cubes hopper';
    mesh.frustumCulled = false;

    const scene = new Scene();
    scene.background = new Color(0x000000);
    const ambient = new AmbientLight(0x91b4c2, 1.4);
    const key = new DirectionalLight(0xffe7d0, 4.8);
    key.position.set(4, 6, 5);
    const fill = new DirectionalLight(0x72a8ca, 2.4);
    fill.position.set(-4, 1, -3);
    scene.add(mesh, ambient, key, fill);
    const camera = new PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(4.2, 3.1, 4.6);
    camera.lookAt(0, 0, 0);

    const resize = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth));
      const height = Math.max(1, Math.floor(canvas.clientHeight));
      session.renderer.setPixelRatio(
        Math.min(Math.max(window.devicePixelRatio, 1), 2),
      );
      session.renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    session.renderer.toneMappingExposure = 1.15;
    await session.renderer.compileAsync(scene, camera);

    const batchSize = 100;
    const extractionSamples: LiveExtractionSample[] = [];
    let renderedCheckpointCount = 0;
    let completed = 0;
    let checkpointIndex = 0;
    while (completed < steps) {
      const nextCheckpoint = extractionCheckpoints[checkpointIndex]!;
      const count = Math.min(batchSize, nextCheckpoint - completed);
      await solver.step(count);
      completed += count;
      progress.style.setProperty(
        '--progress',
        `${((completed / steps) * 100).toFixed(2)}%`,
      );
      status.textContent = `Evolving the live GPU field: ${completed.toLocaleString()} / ${steps.toLocaleString()} steps`;

      if (completed === nextCheckpoint) {
        const currentTextures = solver.currentTextures;
        if (
          currentTextures.phase !== extractionSource.phase ||
          currentTextures.solidificationTime !==
            extractionSource.solidificationTime
        ) {
          throw new Error(
            'Repeated extraction left the retained solver texture parity.',
          );
        }
        status.textContent = `Extracting checkpoint ${checkpointIndex + 1} / ${extractionCheckpoints.length} at t=${solver.simulatedTime.toFixed(2)}...`;
        const extractionStartedAt = performance.now();
        await extractor.extract(session.renderer, solver.simulatedTime);
        await session.device.queue.onSubmittedWorkDone();
        const extractionMilliseconds = performance.now() - extractionStartedAt;
        const summary = Array.from(
          new Uint32Array(
            await session.renderer.getArrayBufferAsync(
              extractor.candidate.summary,
            ),
          ),
        );
        const indirect = Array.from(
          new Uint32Array(
            await session.renderer.getArrayBufferAsync(
              extractor.lastValidMesh.indirect,
            ),
          ),
        );
        const sample: LiveExtractionSample = {
          stepCount: completed,
          simulatedTime: solver.simulatedTime,
          vertexCount: indirect[0] ?? 0,
          triangleCount: summary[3] ?? 0,
          overflow: summary[2] === 1,
          extractionMilliseconds,
        };
        extractionSamples.push(sample);
        session.renderer.render(scene, camera);
        await session.device.queue.onSubmittedWorkDone();
        renderedCheckpointCount += 1;
        readout.dataset.renderedCheckpoints = String(renderedCheckpointCount);
        readout.dataset.renderedStep = String(sample.stepCount);
        readout.dataset.renderedVertexCount = String(sample.vertexCount);
        readout.innerHTML = `
          <div><strong>${sample.vertexCount.toLocaleString()}</strong><span>rendered vertices</span></div>
          <div><strong>${sample.triangleCount.toLocaleString()}</strong><span>rendered triangles</span></div>
          <div><strong>${sample.extractionMilliseconds.toFixed(1)} ms</strong><span>checkpoint extraction</span></div>
          <div><strong>${renderedCheckpointCount} / ${extractionCheckpoints.length}</strong><span>rendered checkpoints</span></div>
        `;
        status.textContent = `Rendered checkpoint ${renderedCheckpointCount} / ${extractionCheckpoints.length} at t=${solver.simulatedTime.toFixed(2)}. Continuing GPU growth...`;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => {
            window.setTimeout(resolve, CHECKPOINT_DISPLAY_MILLISECONDS);
          }),
        );
        checkpointIndex += 1;
      }

      if (completed % 1000 === 0) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
    }

    const validation = evaluateLiveExtractionSamples(extractionSamples, steps);
    const finalSample = extractionSamples.at(-1)!;
    const vertexCount = finalSample.vertexCount;
    const triangleCount = finalSample.triangleCount;
    const overflow = finalSample.overflow;
    const renderTrackingPassed =
      renderedCheckpointCount === extractionSamples.length;
    if (
      !validation.passed ||
      !renderTrackingPassed ||
      session.errors.length > 0
    ) {
      throw new Error(
        `Live extraction failed: ${validation.failures.join('; ') || (!renderTrackingPassed ? 'not every promoted checkpoint was rendered' : 'uncaptured WebGPU error')}.`,
      );
    }

    const orbitStartedAt = performance.now();
    const render = () => {
      const angle = (performance.now() - orbitStartedAt) * 0.00004 + 0.7;
      camera.position.set(Math.cos(angle) * 5.6, 3.1, Math.sin(angle) * 5.6);
      camera.lookAt(0, 0, 0);
      session.renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    render();

    const result: LiveExtractionFixtureResult = {
      grid: gridSize,
      steps,
      simulatedTime: solver.simulatedTime,
      vertexCount,
      triangleCount,
      overflow,
      extractionSamples,
      renderedCheckpointCount,
      checkpointDisplayMilliseconds: CHECKPOINT_DISPLAY_MILLISECONDS,
      cadence: validation.cadence,
      distinctVertexCounts: validation.distinctVertexCounts,
      extractionMilliseconds: validation.cadence.firstSampleMilliseconds,
      backend: session.diagnostics.backend,
      uncapturedErrors: [...session.errors],
      passed:
        validation.passed &&
        renderTrackingPassed &&
        session.errors.length === 0,
    };
    status.textContent = `Live solver isosurface tracked through ${extractionSamples.length} checkpoints to t=${solver.simulatedTime.toFixed(2)}. GPU extraction and indirect draw; no field or mesh readback.`;
    readout.innerHTML = `
      <div><strong>${vertexCount.toLocaleString()}</strong><span>vertices</span></div>
      <div><strong>${triangleCount.toLocaleString()}</strong><span>triangles</span></div>
      <div><strong>${validation.cadence.warmMedianMilliseconds.toFixed(1)} ms</strong><span>warm extraction median</span></div>
      <div><strong>${extractionSamples.length}</strong><span>tracked checkpoints</span></div>
    `;
    readout.dataset.result = JSON.stringify(result);
    return result;
  } catch (error) {
    extractor?.dispose();
    solver.dispose();
    session.dispose();
    throw error;
  }
}

function serializeError(error: unknown): LiveExtractionFixtureOutcome {
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

export function mountLiveExtractionFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="single-crystal-shell">
      <canvas class="single-crystal-canvas" aria-label="Live GPU extracted hopper crystal"></canvas>
      <section class="single-crystal-header">
        <p class="eyebrow">Developer-only Milestone 2 validation</p>
        <h1>Live solver surface extraction</h1>
        <p data-live-status>Initializing the hardware solver...</p>
        <div class="single-crystal-progress" aria-hidden="true"><span data-live-progress></span></div>
      </section>
      <section class="single-crystal-diagnostics" aria-label="Live extraction diagnostics">
        <div class="single-crystal-readout" data-live-readout></div>
      </section>
    </main>
  `;
  const canvas = root.querySelector<HTMLCanvasElement>(
    '.single-crystal-canvas',
  );
  const status = root.querySelector<HTMLElement>('[data-live-status]');
  const progress = root.querySelector<HTMLElement>('[data-live-progress]');
  const readout = root.querySelector<HTMLElement>('[data-live-readout]');
  if (!canvas || !status || !progress || !readout) {
    throw new Error('Unable to mount the live extraction fixture.');
  }

  window.__BISMUTH_LIVE_EXTRACTION__ = runLiveExtractionFixture(
    canvas,
    status,
    progress,
    readout,
  )
    .then((result): LiveExtractionFixtureOutcome => ({ ok: true, result }))
    .catch(serializeError);
  void window.__BISMUTH_LIVE_EXTRACTION__.then((outcome) => {
    if (!outcome.ok) {
      status.textContent = `Live extraction failed: ${outcome.error.message}`;
    }
  });
}
