import {
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from 'three/webgpu';
import hdriUrl from '../../hdri.jpg?url';
import {
  validateEnvironmentPreset,
  type EnvironmentPreset,
} from '../rendering/environment-preset';
import {
  createWebGpuSession,
  type WebGpuDiagnostics,
  type WebGpuSession,
} from '../rendering/webgpu-capability';

const initialEnvironmentPreset = validateEnvironmentPreset({
  id: 'initial-studio-jpg',
  hdriUrl,
  environmentRotation: 0,
  exposure: 1,
  sunDirection: [3, 5, 4],
  sunIntensity: 2.5,
  sunColor: '#fff4e8',
});

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
