import {
  BufferGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Float32BufferAttribute,
  FloatType,
  Mesh,
  MeshStandardNodeMaterial,
  NearestFilter,
  PerspectiveCamera,
  RedFormat,
  Scene,
  Storage3DTexture,
  StorageBufferAttribute,
  Vector3,
  type ComputeNode,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  Fn,
  float,
  instanceIndex,
  storage,
  textureStore,
  transformNormalToView,
  uvec3,
  vec4,
} from 'three/tsl';
import { createGpuSurfaceExtractor } from '../extraction';
import {
  createWebGpuSession,
  type WebGpuDiagnostics,
  type WebGpuSession,
} from '../rendering/webgpu-capability';
import type { ScalarFieldSnapshot } from '../simulation/scalar-field-snapshot';

const DEFAULT_VERTEX_CAPACITY = 650_001;
const DEFAULT_DISPLAY_SPAN = 5.4;
const DEFAULT_LABEL = 'Scalar field';

export interface ScalarFieldGpuSnapshotResult {
  readonly step: number;
  readonly simulatedTime: number;
  readonly requestedVertices: number;
  readonly emittedVertices: number;
  readonly triangleCount: number;
  readonly overflow: boolean;
}

export interface ScalarFieldGpuSnapshotController {
  readonly ready: Promise<WebGpuDiagnostics>;
  readonly errors: readonly string[];
  show(state: ScalarFieldSnapshot): Promise<ScalarFieldGpuSnapshotResult>;
  resize(width: number, height: number, devicePixelRatio: number): void;
  dispose(): void;
}

export interface ScalarFieldGpuSnapshotControllerOptions {
  readonly vertexCapacity?: number;
  readonly displaySpan?: number;
  readonly label?: string;
}

interface ScalarFieldSnapshotLabels {
  readonly phase: string;
  readonly solidificationTime: string;
  readonly source: string;
  readonly shapeChanged: string;
  readonly invalidShape: string;
  readonly invalidVoxelCount: string;
  readonly invalidOrderParameterLength: string;
  readonly disposed: string;
  readonly scene: string;
  readonly camera: string;
  readonly mesh: string;
}

interface ScalarFieldSnapshotBridge {
  readonly phase: Storage3DTexture;
  readonly solidificationTime: Storage3DTexture;
  readonly upload: ComputeNode;
  readonly source: StorageBufferAttribute;
  write(renderer: WebGPURenderer, state: ScalarFieldSnapshot): Promise<void>;
  dispose(): void;
}

function createSnapshotLabels(label: string): ScalarFieldSnapshotLabels {
  return {
    phase: `${label} uploaded phase`,
    solidificationTime: `${label} unavailable solidification time`,
    source: `${label} CPU order-parameter upload`,
    shapeChanged: `${label} snapshot shape changed during review.`,
    invalidShape: `${label} snapshot shape must contain three integers greater than or equal to 2.`,
    invalidVoxelCount: `${label} snapshot voxelCount does not match its shape.`,
    invalidOrderParameterLength: `${label} snapshot order-parameter length does not match its shape.`,
    disposed: `${label} GPU snapshot controller disposed.`,
    scene: `${label} GPU morphology checkpoint scene`,
    camera: `${label} fixed morphology review camera`,
    mesh: `${label} GPU marching-cubes checkpoint mesh`,
  };
}

function assertSnapshotLayout(
  state: ScalarFieldSnapshot,
  labels: ScalarFieldSnapshotLabels,
  expectedShape?: ScalarFieldSnapshot['shape'],
): void {
  if (
    state.shape.length !== 3 ||
    state.shape.some((size) => !Number.isSafeInteger(size) || size < 2)
  ) {
    throw new RangeError(labels.invalidShape);
  }
  if (
    expectedShape &&
    state.shape.some((size, axis) => size !== expectedShape[axis])
  ) {
    throw new RangeError(labels.shapeChanged);
  }
  const shapeProduct = state.shape[0] * state.shape[1] * state.shape[2];
  if (
    !Number.isSafeInteger(shapeProduct) ||
    state.voxelCount !== shapeProduct
  ) {
    throw new RangeError(labels.invalidVoxelCount);
  }
  if (state.orderParameter.length !== shapeProduct) {
    throw new RangeError(labels.invalidOrderParameterLength);
  }
}

function createScalarStorageTexture(
  name: string,
  width: number,
  height: number,
  depth: number,
): Storage3DTexture {
  const texture = new Storage3DTexture(width, height, depth);
  texture.name = name;
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createSnapshotBridge(
  shape: ScalarFieldSnapshot['shape'],
  labels: ScalarFieldSnapshotLabels,
): ScalarFieldSnapshotBridge {
  const [width, height, depth] = shape;
  const voxelCount = width * height * depth;
  const phase = createScalarStorageTexture(labels.phase, width, height, depth);
  const solidificationTime = createScalarStorageTexture(
    labels.solidificationTime,
    width,
    height,
    depth,
  );
  const source = new StorageBufferAttribute(new Float32Array(voxelCount), 1);
  source.name = labels.source;
  source.setUsage(DynamicDrawUsage);
  const sourceStorage = storage(source, 'float', voxelCount).toReadOnly();
  const upload = Fn(() => {
    const x = instanceIndex.mod(width);
    const y = instanceIndex.div(width).mod(height);
    const z = instanceIndex.div(width * height);
    const coordinate = uvec3(x, y, z);
    const extractionPhase = float(1)
      .sub(sourceStorage.element(instanceIndex))
      .mul(0.5);
    textureStore(
      phase,
      coordinate,
      vec4(extractionPhase, 0, 0, 1),
    ).toWriteOnly();
    textureStore(
      solidificationTime,
      coordinate,
      vec4(-1, 0, 0, 1),
    ).toWriteOnly();
  })().compute(voxelCount, [64, 1, 1]);

  return {
    phase,
    solidificationTime,
    upload,
    source,
    async write(renderer, state) {
      assertSnapshotLayout(state, labels, shape);
      (source.array as Float32Array).set(state.orderParameter);
      source.needsUpdate = true;
      await renderer.computeAsync(upload);
    },
    dispose() {
      upload.dispose();
      phase.dispose();
      solidificationTime.dispose();
    },
  };
}

export function createScalarFieldGpuSnapshotController(
  canvas: HTMLCanvasElement,
  initial: ScalarFieldSnapshot,
  options: ScalarFieldGpuSnapshotControllerOptions = {},
): ScalarFieldGpuSnapshotController {
  const vertexCapacity = options.vertexCapacity ?? DEFAULT_VERTEX_CAPACITY;
  const displaySpan = options.displaySpan ?? DEFAULT_DISPLAY_SPAN;
  const label = options.label ?? DEFAULT_LABEL;
  const labels = createSnapshotLabels(label);
  assertSnapshotLayout(initial, labels);
  if (!Number.isFinite(displaySpan) || displaySpan <= 0) {
    throw new RangeError(`${label} display span must be positive and finite.`);
  }
  const shape: ScalarFieldSnapshot['shape'] = [
    initial.shape[0],
    initial.shape[1],
    initial.shape[2],
  ];
  let disposed = false;
  let session: WebGpuSession | undefined;
  let bridge: ScalarFieldSnapshotBridge | undefined;
  let extractor: ReturnType<typeof createGpuSurfaceExtractor> | undefined;
  let scene: Scene | undefined;
  let camera: PerspectiveCamera | undefined;
  let geometry: BufferGeometry | undefined;
  let material: MeshStandardNodeMaterial | undefined;
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  let devicePixelRatio = window.devicePixelRatio;
  let viewportDirty = true;

  const assertActive = () => {
    if (disposed) throw new Error(labels.disposed);
  };

  const render = () => {
    if (!session || !scene || !camera || disposed) return;
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
  };

  const ready = (async () => {
    session = await createWebGpuSession(canvas);
    assertActive();
    const [gridWidth, gridHeight, gridDepth] = shape;
    const longestCellSpan = Math.max(
      gridWidth - 1,
      gridHeight - 1,
      gridDepth - 1,
    );
    const displaySpacing = displaySpan / longestCellSpan;
    const physicalOrigin: [number, number, number] = [
      (-(gridWidth - 1) * displaySpacing) / 2,
      (-(gridHeight - 1) * displaySpacing) / 2,
      (-(gridDepth - 1) * displaySpacing) / 2,
    ];

    scene = new Scene();
    scene.name = labels.scene;
    scene.background = new Color(0x010305);
    camera = new PerspectiveCamera(34, 1, 0.1, 100);
    camera.name = labels.camera;
    camera.position.set(6.2, 4.8, 6.4);
    camera.lookAt(0, -0.35, 0);
    const light = new DirectionalLight(0xe8f5ff, 4.2);
    light.position.copy(new Vector3(0.7, 1, 0.45).normalize());
    scene.add(light);
    session.renderer.setClearColor(0x010305, 1);

    bridge = createSnapshotBridge(shape, labels);
    extractor = createGpuSurfaceExtractor(
      bridge.phase,
      bridge.solidificationTime,
      shape,
      {
        spacing: displaySpacing,
        physicalOrigin,
        vertexCapacity,
        initialSimulatedTime: initial.simulatedTime,
      },
    );
    geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(3), 3),
    );
    geometry.setIndirect(extractor.lastValidMesh.indirect);
    material = new MeshStandardNodeMaterial({
      color: 0xc7d2d6,
      metalness: 0.38,
      roughness: 0.34,
    });
    material.positionNode = storage(
      extractor.lastValidMesh.positions,
      'vec4',
      vertexCapacity,
    ).toAttribute().xyz;
    material.normalNode = transformNormalToView(
      storage(
        extractor.lastValidMesh.normalAge,
        'vec4',
        vertexCapacity,
      ).toAttribute().xyz,
    ).normalize();
    const mesh = new Mesh(geometry, material);
    mesh.name = labels.mesh;
    mesh.frustumCulled = false;
    scene.add(mesh);
    render();
    await session.renderer.compileAsync(scene, camera);
    return session.diagnostics;
  })();

  return {
    ready,
    get errors() {
      return session ? [...session.errors] : [];
    },
    async show(state) {
      await ready;
      assertActive();
      await bridge!.write(session!.renderer, state);
      await extractor!.extract(session!.renderer, state.simulatedTime);
      render();
      const summaryBuffer = await session!.renderer.getArrayBufferAsync(
        extractor!.candidate.summary,
      );
      const summary = new Uint32Array(summaryBuffer);
      return {
        step: state.step,
        simulatedTime: state.simulatedTime,
        requestedVertices: summary[0] ?? 0,
        emittedVertices: summary[1] ?? 0,
        overflow: (summary[2] ?? 0) !== 0,
        triangleCount: summary[3] ?? 0,
      };
    },
    resize(nextWidth, nextHeight, nextDevicePixelRatio) {
      width = nextWidth;
      height = nextHeight;
      devicePixelRatio = nextDevicePixelRatio;
      viewportDirty = true;
      render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      extractor?.dispose();
      bridge?.dispose();
      geometry?.dispose();
      material?.dispose();
      session?.dispose();
      extractor = undefined;
      bridge = undefined;
      geometry = undefined;
      material = undefined;
      session = undefined;
      scene = undefined;
      camera = undefined;
    },
  };
}
