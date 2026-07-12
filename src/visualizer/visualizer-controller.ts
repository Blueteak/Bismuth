import {
  BufferGeometry,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  Mesh,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from 'three/webgpu';
import { storage } from 'three/tsl';
import hdriUrl from '../../hdri.jpg?url';
import { createGpuSurfaceExtractorPair } from '../extraction';
import {
  validateEnvironmentPreset,
  type EnvironmentPreset,
} from '../rendering/environment-preset';
import {
  createWebGpuSession,
  type WebGpuDiagnostics,
  type WebGpuSession,
} from '../rendering/webgpu-capability';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
  type SimulationConfiguration,
} from '../simulation/config';
import {
  createGpuSingleCrystalSolver,
  type GpuSingleCrystalSolver,
} from '../simulation/gpu-solver';
import {
  createLiveControllerScheduler,
  type LiveControllerScheduler,
  summarizeLiveMeshUpdateCadence,
  type LiveControllerMeshUpdate,
  type LiveMeshUpdateCadence,
} from './live-controller-scheduler';

const initialEnvironmentPreset = validateEnvironmentPreset({
  id: 'initial-studio-jpg',
  hdriUrl,
  environmentRotation: 0,
  exposure: 1,
  sunDirection: [3, 5, 4],
  sunIntensity: 2.5,
  sunColor: '#fff4e8',
});

export const TARGET_LIVE_MESH_UPDATES_PER_SECOND = 30;
export const MINIMUM_LIVE_MESH_UPDATES_PER_SECOND = 15;

export interface FoundationDiagnostics {
  readonly webGpu: WebGpuDiagnostics;
  readonly environment: {
    readonly presetId: string;
    readonly url: string;
    readonly width: number;
    readonly height: number;
    readonly mapping: 'equirectangular-reflection';
  };
  readonly scene: {
    readonly background: '#000000';
    readonly objectCount: number;
    readonly directionalLightCount: 1;
    readonly camera: 'perspective';
  };
}

export interface VisualizerController {
  readonly ready: Promise<FoundationDiagnostics>;
  resize(width: number, height: number, devicePixelRatio: number): void;
  dispose(): void;
}

export interface LiveVisualizerControllerOptions {
  readonly gridSize?: number;
  readonly targetStepCount?: number;
  readonly simulationStepsPerMeshUpdate?: number;
  readonly vertexCapacity?: number;
}

export interface LiveVisualizerCompletion {
  readonly targetStepCount: number;
  readonly finalStepCount: number;
  readonly parityUpdateCounts: readonly [number, number];
  readonly cadence: LiveMeshUpdateCadence;
  readonly targetMeshUpdatesPerSecond: typeof TARGET_LIVE_MESH_UPDATES_PER_SECOND;
  readonly minimumMeshUpdatesPerSecond: typeof MINIMUM_LIVE_MESH_UPDATES_PER_SECOND;
  readonly rendererFrames: number;
  readonly uncapturedErrors: readonly string[];
  readonly passed: boolean;
}

export interface LiveVisualizerController extends VisualizerController {
  readonly completion: Promise<LiveVisualizerCompletion>;
}

class ControllerDisposedError extends Error {
  constructor() {
    super('The visualizer controller was disposed during initialization.');
    this.name = 'ControllerDisposedError';
  }
}

export function isControllerDisposedError(
  error: unknown,
): error is ControllerDisposedError {
  return error instanceof ControllerDisposedError;
}

function loadEnvironmentTexture(url: string): Promise<Texture> {
  return new TextureLoader().loadAsync(url);
}

function configureEnvironment(
  scene: Scene,
  texture: Texture,
  preset: EnvironmentPreset,
): void {
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  texture.name = `Environment: ${preset.id}`;
  scene.environment = texture;
  scene.environmentIntensity = 1;
  scene.environmentRotation.set(0, preset.environmentRotation, 0);
}

export function createFoundationVisualizerController(
  canvas: HTMLCanvasElement,
): VisualizerController {
  let disposed = false;
  let session: WebGpuSession | undefined;
  let environmentTexture: Texture | undefined;
  let scene: Scene | undefined;
  let camera: PerspectiveCamera | undefined;
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  let devicePixelRatio = window.devicePixelRatio;

  const assertActive = () => {
    if (disposed) {
      throw new ControllerDisposedError();
    }
  };

  const render = () => {
    if (!session || !scene || !camera || disposed) {
      return;
    }

    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    session.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1), 2));
    session.renderer.setSize(safeWidth, safeHeight, false);
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
    session.renderer.render(scene, camera);
  };

  const ready = (async (): Promise<FoundationDiagnostics> => {
    try {
      session = await createWebGpuSession(canvas);
      assertActive();

      scene = new Scene();
      scene.name = 'Bismuth foundation scene';
      scene.background = new Color(0x000000);

      camera = new PerspectiveCamera(35, 1, 0.1, 100);
      camera.name = 'Bismuth foundation camera';
      camera.position.set(0, 0, 6);
      camera.lookAt(0, 0, 0);

      const light = new DirectionalLight(
        initialEnvironmentPreset.sunColor,
        initialEnvironmentPreset.sunIntensity,
      );
      light.name = 'Bismuth environment key light';
      light.position.copy(
        new Vector3(...initialEnvironmentPreset.sunDirection).normalize(),
      );
      light.castShadow = true;
      scene.add(light);

      session.renderer.setClearColor(0x000000, 1);
      session.renderer.toneMappingExposure = initialEnvironmentPreset.exposure;
      session.renderer.shadowMap.enabled = true;

      environmentTexture = await loadEnvironmentTexture(
        initialEnvironmentPreset.hdriUrl,
      );
      assertActive();
      configureEnvironment(scene, environmentTexture, initialEnvironmentPreset);

      session.renderer.initTexture(environmentTexture);
      render();
      await session.device.queue.onSubmittedWorkDone();
      assertActive();

      const image = environmentTexture.image as HTMLImageElement;

      return {
        webGpu: session.diagnostics,
        environment: {
          presetId: initialEnvironmentPreset.id,
          url: initialEnvironmentPreset.hdriUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
          mapping: 'equirectangular-reflection',
        },
        scene: {
          background: '#000000',
          objectCount: scene.children.length,
          directionalLightCount: 1,
          camera: 'perspective',
        },
      };
    } catch (error) {
      environmentTexture?.dispose();
      environmentTexture = undefined;
      session?.dispose();
      session = undefined;
      throw error;
    }
  })();

  return {
    ready,
    resize(nextWidth, nextHeight, nextDevicePixelRatio) {
      if (disposed) {
        return;
      }

      width = nextWidth;
      height = nextHeight;
      devicePixelRatio = nextDevicePixelRatio;
      render();
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      environmentTexture?.dispose();
      environmentTexture = undefined;
      session?.dispose();
      session = undefined;
      scene = undefined;
      camera = undefined;
    },
  };
}

function createLiveSimulationConfiguration(
  gridSize: number,
): SimulationConfiguration {
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

export function createLiveVisualizerController(
  canvas: HTMLCanvasElement,
  options: LiveVisualizerControllerOptions = {},
): LiveVisualizerController {
  const gridSize = options.gridSize ?? 128;
  const targetStepCount = options.targetStepCount ?? 50_000;
  const simulationStepsPerMeshUpdate =
    options.simulationStepsPerMeshUpdate ?? 49;
  const vertexCapacity = options.vertexCapacity ?? 300_000;
  const configuration = deriveSimulationConfiguration(
    createLiveSimulationConfiguration(gridSize),
  );
  let disposed = false;
  let cleanedUp = false;
  let session: WebGpuSession | undefined;
  let environmentTexture: Texture | undefined;
  let scene: Scene | undefined;
  let camera: PerspectiveCamera | undefined;
  let solver: GpuSingleCrystalSolver | undefined;
  let extractorPair:
    ReturnType<typeof createGpuSurfaceExtractorPair> | undefined;
  let scheduler: LiveControllerScheduler | undefined;
  let geometry: BufferGeometry | undefined;
  let material: MeshStandardNodeMaterial | undefined;
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  let devicePixelRatio = window.devicePixelRatio;
  let viewportDirty = true;
  let rendererFrames = 0;
  let initializationError: unknown;
  let resolveCompletion: (result: LiveVisualizerCompletion) => void = () =>
    undefined;
  const completion = new Promise<LiveVisualizerCompletion>((resolve) => {
    resolveCompletion = resolve;
  });
  let completionSettled = false;

  const assertActive = () => {
    if (disposed) {
      throw new ControllerDisposedError();
    }
  };

  const render = () => {
    if (!session || !scene || !camera || disposed) {
      return;
    }
    if (viewportDirty) {
      const safeWidth = Math.max(1, Math.floor(width));
      const safeHeight = Math.max(1, Math.floor(height));
      session.renderer.setPixelRatio(
        Math.min(Math.max(devicePixelRatio, 1), 2),
      );
      session.renderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
      viewportDirty = false;
    }
    session.renderer.render(scene, camera);
    rendererFrames += 1;
  };

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    extractorPair?.dispose();
    solver?.dispose();
    geometry?.dispose();
    material?.dispose();
    environmentTexture?.dispose();
    session?.dispose();
    extractorPair = undefined;
    solver = undefined;
    geometry = undefined;
    material = undefined;
    environmentTexture = undefined;
    session = undefined;
    scene = undefined;
    camera = undefined;
  };

  const settleCompletion = (updates: readonly LiveControllerMeshUpdate[]) => {
    if (completionSettled) {
      return;
    }
    completionSettled = true;
    const finalStepCount = updates.at(-1)?.stepCount ?? solver?.stepCount ?? 0;
    const uncapturedErrors = session ? [...session.errors] : [];
    const parityUpdateCounts = updates.reduce(
      (counts, update) => {
        counts[update.textureParity] += 1;
        return counts;
      },
      [0, 0] as [number, number],
    );
    const cadence = summarizeLiveMeshUpdateCadence(updates);
    const minimumIntervalBudgetMilliseconds =
      1000 / MINIMUM_LIVE_MESH_UPDATES_PER_SECOND;
    resolveCompletion({
      targetStepCount,
      finalStepCount,
      parityUpdateCounts,
      cadence,
      targetMeshUpdatesPerSecond: TARGET_LIVE_MESH_UPDATES_PER_SECOND,
      minimumMeshUpdatesPerSecond: MINIMUM_LIVE_MESH_UPDATES_PER_SECOND,
      rendererFrames,
      uncapturedErrors,
      passed:
        initializationError === undefined &&
        finalStepCount === targetStepCount &&
        parityUpdateCounts.every((count) => count > 0) &&
        cadence.updatesPerSecond >= MINIMUM_LIVE_MESH_UPDATES_PER_SECOND &&
        cadence.percentile95IntervalMilliseconds <=
          minimumIntervalBudgetMilliseconds &&
        rendererFrames >= updates.length &&
        uncapturedErrors.length === 0,
    });
  };

  const ready = (async (): Promise<FoundationDiagnostics> => {
    try {
      session = await createWebGpuSession(canvas);
      assertActive();
      scene = new Scene();
      scene.name = 'Bismuth live extraction controller scene';
      scene.background = new Color(0x000000);
      camera = new PerspectiveCamera(34, 1, 0.1, 100);
      camera.name = 'Bismuth live extraction controller camera';
      camera.position.set(4.2, 3.1, 4.6);
      camera.lookAt(0, 0, 0);

      const light = new DirectionalLight(
        initialEnvironmentPreset.sunColor,
        initialEnvironmentPreset.sunIntensity,
      );
      light.name = 'Bismuth environment key light';
      light.position.copy(
        new Vector3(...initialEnvironmentPreset.sunDirection).normalize(),
      );
      light.castShadow = true;
      scene.add(light);
      session.renderer.setClearColor(0x000000, 1);
      session.renderer.toneMappingExposure = initialEnvironmentPreset.exposure;
      session.renderer.shadowMap.enabled = true;

      environmentTexture = await loadEnvironmentTexture(
        initialEnvironmentPreset.hdriUrl,
      );
      assertActive();
      configureEnvironment(scene, environmentTexture, initialEnvironmentPreset);
      session.renderer.initTexture(environmentTexture);

      solver = createGpuSingleCrystalSolver(
        session.renderer,
        session.device,
        configuration,
      );
      await solver.initialize();
      assertActive();
      const displaySpacing = 5.4 / gridSize;
      const displayMinimum = (-(gridSize - 1) / 2) * displaySpacing;
      extractorPair = createGpuSurfaceExtractorPair(
        solver.textureParities,
        configuration.grid.shape,
        {
          spacing: displaySpacing,
          physicalOrigin: [displayMinimum, displayMinimum, displayMinimum],
          vertexCapacity,
          initialSimulatedTime: solver.simulatedTime,
        },
      );

      geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(new Float32Array(3), 3),
      );
      geometry.setIndirect(extractorPair.lastValidMesh.indirect);
      material = new MeshStandardNodeMaterial({
        color: 0xc2d0d4,
        metalness: 0.78,
        roughness: 0.28,
      });
      material.positionNode = storage(
        extractorPair.lastValidMesh.positions,
        'vec4',
        vertexCapacity,
      ).toAttribute().xyz;
      material.normalNode = storage(
        extractorPair.lastValidMesh.normalAge,
        'vec4',
        vertexCapacity,
      ).toAttribute().xyz;
      const mesh = new Mesh(geometry, material);
      mesh.name = 'Controller-owned live GPU marching-cubes hopper';
      mesh.frustumCulled = false;
      scene.add(mesh);
      render();
      await session.renderer.compileAsync(scene, camera);
      await extractorPair.extract(
        session.renderer,
        solver.currentTextureParity,
        solver.simulatedTime,
      );
      await session.device.queue.onSubmittedWorkDone();
      assertActive();

      scheduler = createLiveControllerScheduler(
        {
          async step(count) {
            await solver!.step(count);
            return {
              stepCount: solver!.stepCount,
              simulatedTime: solver!.simulatedTime,
              textureParity: solver!.currentTextureParity,
            };
          },
          extract(snapshot) {
            return extractorPair!.extract(
              session!.renderer,
              snapshot.textureParity,
              snapshot.simulatedTime,
            );
          },
          render,
          onError(error) {
            initializationError = error;
          },
        },
        { simulationStepsPerMeshUpdate, targetStepCount },
      );
      void scheduler.completion.then(settleCompletion);
      scheduler.start();

      const image = environmentTexture.image as HTMLImageElement;
      return {
        webGpu: session.diagnostics,
        environment: {
          presetId: initialEnvironmentPreset.id,
          url: initialEnvironmentPreset.hdriUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
          mapping: 'equirectangular-reflection',
        },
        scene: {
          background: '#000000',
          objectCount: scene.children.length,
          directionalLightCount: 1,
          camera: 'perspective',
        },
      };
    } catch (error) {
      initializationError = error;
      settleCompletion([]);
      cleanup();
      throw error;
    }
  })();

  return {
    ready,
    completion,
    resize(nextWidth, nextHeight, nextDevicePixelRatio) {
      if (disposed) {
        return;
      }
      width = nextWidth;
      height = nextHeight;
      devicePixelRatio = nextDevicePixelRatio;
      viewportDirty = true;
      render();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      if (scheduler) {
        void scheduler.dispose().then(cleanup);
      } else {
        cleanup();
      }
    },
  };
}
