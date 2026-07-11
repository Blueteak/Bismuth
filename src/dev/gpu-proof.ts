import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  IndirectStorageBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  NearestFilter,
  OrthographicCamera,
  RGBAFormat,
  RenderTarget,
  Scene,
  Storage3DTexture,
  StorageBufferAttribute,
  UnsignedByteType,
  type ComputeNode,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  Fn,
  If,
  float,
  instanceIndex,
  storage,
  storageTexture3D,
  textureStore,
  uvec4,
  uvec3,
  vec4,
} from 'three/tsl';
import {
  createWebGpuSession,
  type WebGpuDiagnostics,
} from '../rendering/webgpu-capability';

const GRID_SIZE = 4;
const VOXEL_COUNT = GRID_SIZE ** 3;
const WORKGROUP_SIZE = [2, 2, 2] as const;
const COMPUTE_TOLERANCE = 1e-6;
const EXPECTED_POSITIONS = [
  -0.75, -0.6, 0, 1, 0.75, -0.6, 0, 1, 0, 0.75, 0, 1,
] as const;
const EXPECTED_INDIRECT_ARGS = [3, 1, 0, 0] as const;

export interface ComputeProofResult {
  readonly grid: readonly [number, number, number];
  readonly workgroup: readonly [number, number, number];
  readonly steps: number;
  readonly tolerance: number;
  readonly maxAbsoluteError: number;
  readonly sample: readonly number[];
  readonly passed: boolean;
}

export interface IndirectDrawProofResult {
  readonly positions: readonly number[];
  readonly indirectArguments: readonly number[];
  readonly expectedPositions: readonly number[];
  readonly expectedIndirectArguments: readonly number[];
  readonly renderCalls: number;
  readonly nonBlackPixelCount: number;
  readonly passed: boolean;
}

export interface TimingSummary {
  readonly minimum: number;
  readonly median: number;
  readonly p95: number;
  readonly maximum: number;
  readonly mean: number;
}

export interface GpuBenchmarkResult {
  readonly warmupIterations: number;
  readonly measuredIterations: number;
  readonly computeMilliseconds: TimingSummary;
  readonly indirectRenderMilliseconds: TimingSummary;
}

export interface GpuProofResult {
  readonly diagnostics: WebGpuDiagnostics;
  readonly compute: ComputeProofResult;
  readonly indirectDraw: IndirectDrawProofResult;
  readonly benchmark?: GpuBenchmarkResult;
  readonly uncapturedErrors: readonly string[];
}

export type GpuProofOutcome =
  | { readonly ok: true; readonly result: GpuProofResult }
  | {
      readonly ok: false;
      readonly error: {
        readonly name: string;
        readonly message: string;
        readonly stack: string | null;
        readonly browser: string;
      };
    };

interface TextureReadbackBackend {
  copyTextureToBuffer(
    texture: Storage3DTexture,
    x: number,
    y: number,
    width: number,
    height: number,
    depthSlice: number,
  ): Promise<ArrayBufferView>;
}

interface PingPongResources {
  readonly textureA: Storage3DTexture;
  readonly textureB: Storage3DTexture;
  readonly initializeA: ComputeNode;
  readonly stepAToB: ComputeNode;
  readonly stepBToA: ComputeNode;
  dispose(): void;
}

interface IndirectResources {
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicNodeMaterial;
  readonly positions: StorageBufferAttribute;
  readonly indirect: IndirectStorageBufferAttribute;
  readonly generate: ComputeNode;
  dispose(): void;
}

function createStorageTexture(name: string): Storage3DTexture {
  const texture = new Storage3DTexture(GRID_SIZE, GRID_SIZE, GRID_SIZE);
  texture.name = name;
  texture.format = RGBAFormat;
  texture.type = FloatType;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function voxelCoordinate() {
  const x = instanceIndex.mod(GRID_SIZE);
  const y = instanceIndex.div(GRID_SIZE).mod(GRID_SIZE);
  const z = instanceIndex.div(GRID_SIZE * GRID_SIZE);
  return uvec3(x, y, z);
}

function createPingPongResources(): PingPongResources {
  const textureA = createStorageTexture('0B phase proof A');
  const textureB = createStorageTexture('0B phase proof B');

  const initializeA = Fn(() => {
    const coordinate = voxelCoordinate();
    const value = float(instanceIndex).mul(0.25).add(1);
    textureStore(textureA, coordinate, vec4(value)).toWriteOnly();
  })().compute(VOXEL_COUNT, [...WORKGROUP_SIZE]);

  const stepAToB = Fn(() => {
    const coordinate = voxelCoordinate();
    const source = storageTexture3D(textureA).load(coordinate).toReadOnly();
    textureStore(textureB, coordinate, source.add(2)).toWriteOnly();
  })().compute(VOXEL_COUNT, [...WORKGROUP_SIZE]);

  const stepBToA = Fn(() => {
    const coordinate = voxelCoordinate();
    const source = storageTexture3D(textureB).load(coordinate).toReadOnly();
    textureStore(textureA, coordinate, source.mul(0.5)).toWriteOnly();
  })().compute(VOXEL_COUNT, [...WORKGROUP_SIZE]);

  return {
    textureA,
    textureB,
    initializeA,
    stepAToB,
    stepBToA,
    dispose() {
      initializeA.dispose();
      stepAToB.dispose();
      stepBToA.dispose();
      textureA.dispose();
      textureB.dispose();
    },
  };
}

function createIndirectResources(): IndirectResources {
  const positions = new StorageBufferAttribute(3, 4);
  positions.name = '0B compute-generated triangle positions';
  const indirect = new IndirectStorageBufferAttribute(
    new Uint32Array(EXPECTED_INDIRECT_ARGS.length),
    4,
  );
  indirect.name = '0B indirect draw arguments';

  const positionStorage = storage(positions, 'vec4', 3);
  const indirectStorage = storage(indirect, 'uvec4', 1);

  const generate = Fn(() => {
    const position = instanceIndex
      .equal(0)
      .select(
        vec4(-0.75, -0.6, 0, 1),
        instanceIndex
          .equal(1)
          .select(vec4(0.75, -0.6, 0, 1), vec4(0, 0.75, 0, 1)),
      );
    positionStorage.element(instanceIndex).assign(position);

    If(instanceIndex.equal(0), () => {
      indirectStorage.element(0).assign(uvec4(3, 1, 0, 0));
    });
  })().compute(3, [3, 1, 1]);

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(3 * 3), 3),
  );
  geometry.setIndirect(indirect);

  const material = new MeshBasicNodeMaterial({
    color: 0x59d8ff,
    side: DoubleSide,
  });
  material.positionNode = positionStorage.toAttribute().xyz;

  const scene = new Scene();
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  camera.lookAt(0, 0, 0);

  return {
    scene,
    camera,
    geometry,
    material,
    positions,
    indirect,
    generate,
    dispose() {
      generate.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

async function readTextureValues(
  renderer: WebGPURenderer,
  texture: Storage3DTexture,
): Promise<number[]> {
  const backend = renderer.backend as unknown as TextureReadbackBackend;
  const values: number[] = [];
  const floatsPerAlignedRow = 256 / Float32Array.BYTES_PER_ELEMENT;

  for (let z = 0; z < GRID_SIZE; z += 1) {
    const view = await backend.copyTextureToBuffer(
      texture,
      0,
      0,
      GRID_SIZE,
      GRID_SIZE,
      z,
    );
    const layer = new Float32Array(
      view.buffer,
      view.byteOffset,
      view.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        values.push(layer[y * floatsPerAlignedRow + x * 4] ?? Number.NaN);
      }
    }
  }

  return values;
}

async function runComputeProof(
  renderer: WebGPURenderer,
  resources: PingPongResources,
): Promise<ComputeProofResult> {
  await renderer.computeAsync(resources.initializeA);
  await renderer.computeAsync(resources.stepAToB);
  await renderer.computeAsync(resources.stepBToA);

  const actual = await readTextureValues(renderer, resources.textureA);
  const expected = actual.map((_, index) => (1 + index * 0.25 + 2) * 0.5);
  const maxAbsoluteError = actual.reduce(
    (maximum, value, index) =>
      Math.max(maximum, Math.abs(value - (expected[index] ?? Number.NaN))),
    0,
  );

  return {
    grid: [GRID_SIZE, GRID_SIZE, GRID_SIZE],
    workgroup: WORKGROUP_SIZE,
    steps: 3,
    tolerance: COMPUTE_TOLERANCE,
    maxAbsoluteError,
    sample: actual.slice(0, 8),
    passed:
      actual.length === VOXEL_COUNT &&
      Number.isFinite(maxAbsoluteError) &&
      maxAbsoluteError <= COMPUTE_TOLERANCE,
  };
}

async function runIndirectProof(
  renderer: WebGPURenderer,
  device: GPUDevice,
  resources: IndirectResources,
): Promise<IndirectDrawProofResult> {
  await renderer.computeAsync(resources.generate);
  renderer.setClearColor(0x000000, 1);
  const renderTarget = new RenderTarget(64, 64, {
    depthBuffer: false,
    type: UnsignedByteType,
  });
  renderer.setRenderTarget(renderTarget);
  await renderer.compileAsync(resources.scene, resources.camera);
  renderer.render(resources.scene, resources.camera);
  await device.queue.onSubmittedWorkDone();
  const pixels = await renderer.readRenderTargetPixelsAsync(
    renderTarget,
    0,
    0,
    64,
    64,
  );
  let nonBlackPixelCount = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      (pixels[index] ?? 0) > 0 ||
      (pixels[index + 1] ?? 0) > 0 ||
      (pixels[index + 2] ?? 0) > 0
    ) {
      nonBlackPixelCount += 1;
    }
  }
  renderTarget.dispose();

  renderer.setRenderTarget(null);
  renderer.setSize(256, 256, false);
  await renderer.compileAsync(resources.scene, resources.camera);
  renderer.render(resources.scene, resources.camera);
  await device.queue.onSubmittedWorkDone();

  const positions = Array.from(
    new Float32Array(await renderer.getArrayBufferAsync(resources.positions)),
  );
  const indirectArguments = Array.from(
    new Uint32Array(await renderer.getArrayBufferAsync(resources.indirect)),
  );

  const positionsMatch = positions.every(
    (value, index) =>
      Math.abs(value - (EXPECTED_POSITIONS[index] ?? Number.NaN)) <=
      COMPUTE_TOLERANCE,
  );
  const argumentsMatch = indirectArguments.every(
    (value, index) => value === EXPECTED_INDIRECT_ARGS[index],
  );

  return {
    positions,
    indirectArguments,
    expectedPositions: EXPECTED_POSITIONS,
    expectedIndirectArguments: EXPECTED_INDIRECT_ARGS,
    renderCalls: renderer.info.render.calls,
    nonBlackPixelCount,
    passed:
      positions.length === EXPECTED_POSITIONS.length &&
      indirectArguments.length === EXPECTED_INDIRECT_ARGS.length &&
      positionsMatch &&
      argumentsMatch &&
      nonBlackPixelCount > 0,
  };
}

function summarizeTimings(values: readonly number[]): TimingSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ??
    Number.NaN;

  return {
    minimum: sorted[0] ?? Number.NaN,
    median: percentile(0.5),
    p95: percentile(0.95),
    maximum: sorted.at(-1) ?? Number.NaN,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

async function measureGpuOperation(
  device: GPUDevice,
  operation: () => void,
  warmupIterations: number,
  measuredIterations: number,
): Promise<TimingSummary> {
  for (let iteration = 0; iteration < warmupIterations; iteration += 1) {
    operation();
    await device.queue.onSubmittedWorkDone();
  }

  const timings: number[] = [];
  for (let iteration = 0; iteration < measuredIterations; iteration += 1) {
    const startedAt = performance.now();
    operation();
    await device.queue.onSubmittedWorkDone();
    timings.push(performance.now() - startedAt);
  }

  return summarizeTimings(timings);
}

async function runBenchmark(
  renderer: WebGPURenderer,
  device: GPUDevice,
  pingPong: PingPongResources,
  indirect: IndirectResources,
): Promise<GpuBenchmarkResult> {
  const warmupIterations = 5;
  const measuredIterations = 30;
  let writeToB = true;

  const computeMilliseconds = await measureGpuOperation(
    device,
    () => {
      void renderer.compute(writeToB ? pingPong.stepAToB : pingPong.stepBToA);
      writeToB = !writeToB;
    },
    warmupIterations,
    measuredIterations,
  );
  const indirectRenderMilliseconds = await measureGpuOperation(
    device,
    () => renderer.render(indirect.scene, indirect.camera),
    warmupIterations,
    measuredIterations,
  );

  return {
    warmupIterations,
    measuredIterations,
    computeMilliseconds,
    indirectRenderMilliseconds,
  };
}

export async function runGpuProof(
  canvas: HTMLCanvasElement,
  includeBenchmark: boolean,
): Promise<GpuProofResult> {
  const session = await createWebGpuSession(canvas);
  const pingPong = createPingPongResources();
  const indirect = createIndirectResources();

  try {
    const compute = await runComputeProof(session.renderer, pingPong);
    const indirectDraw = await runIndirectProof(
      session.renderer,
      session.device,
      indirect,
    );
    const benchmark = includeBenchmark
      ? await runBenchmark(session.renderer, session.device, pingPong, indirect)
      : undefined;

    return {
      diagnostics: session.diagnostics,
      compute,
      indirectDraw,
      ...(benchmark ? { benchmark } : {}),
      uncapturedErrors: [...session.errors],
    };
  } finally {
    pingPong.dispose();
    indirect.dispose();
    session.dispose();
  }
}

export function serializeGpuProofError(error: unknown): GpuProofOutcome {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return {
    ok: false,
    error: {
      name: normalized.name,
      message: normalized.message,
      stack: normalized.stack ?? null,
      browser: navigator.userAgent,
    },
  };
}
