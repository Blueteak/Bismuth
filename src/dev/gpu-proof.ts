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
  compactActiveCellsReference,
  createGpuCellCompaction,
  createGpuCellClassification,
  createGpuLastValidMesh,
  createGpuVertexEmission,
  exclusiveScanReference,
  isActiveMarchingCubesCase,
  marchingCubesTriangleCount,
  type GpuCellCompaction,
  type GpuCellClassification,
  type GpuLastValidMesh,
  type GpuMeshPromotion,
  type GpuVertexEmission,
} from '../extraction';
import {
  createWebGpuSession,
  type WebGpuDiagnostics,
} from '../rendering/webgpu-capability';
import {
  runGpuSolverValidation,
  type GpuSolverValidationResult,
} from '../simulation/gpu-validation';

const GRID_SIZE = 4;
const VOXEL_COUNT = GRID_SIZE ** 3;
const ANALYTIC_PLANE_GRID_SIZE = 8;
const ANALYTIC_PLANE_TRIANGLE_COUNT = 98;
const ANALYTIC_PLANE_VERTEX_COUNT = ANALYTIC_PLANE_TRIANGLE_COUNT * 3;
const WORKGROUP_SIZE = [2, 2, 2] as const;
const COMPUTE_TOLERANCE = 1e-6;
const EXPECTED_ANALYTIC_SURFACE_AGE = 4;
const SURFACE_AGE_TOLERANCE = 4e-6;
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

export interface ExtractionClassificationProofResult {
  readonly cellShape: readonly [number, number, number];
  readonly cellCount: number;
  readonly representativeCaseRow: readonly number[];
  readonly activeCellCount: number;
  readonly expectedActiveCellCount: number;
  readonly triangleCount: number;
  readonly expectedTriangleCount: number;
  readonly activeScanLevelCount: number;
  readonly triangleScanLevelCount: number;
  readonly caseMismatchCount: number;
  readonly activeFlagMismatchCount: number;
  readonly triangleCountMismatchCount: number;
  readonly activeOffsetMismatchCount: number;
  readonly triangleOffsetMismatchCount: number;
  readonly compactedCellMismatchCount: number;
  readonly passed: boolean;
}

export interface ExtractionEmissionProofResult {
  readonly requestedVertexCount: number;
  readonly emittedVertexCount: number;
  readonly boundsMinimum: readonly [number, number, number];
  readonly boundsMaximum: readonly [number, number, number];
  readonly positionMismatchCount: number;
  readonly windingMismatchCount: number;
  readonly normalMismatchCount: number;
  readonly surfaceAgeMismatchCount: number;
  readonly expectedSurfaceAge: number;
  readonly surfaceAgeTolerance: number;
  readonly surfaceAgeMinimum: number;
  readonly surfaceAgeMaximum: number;
  readonly retainedPositionMismatchCount: number;
  readonly completeSummary: readonly number[];
  readonly overflowSummary: readonly number[];
  readonly completeIndirectArguments: readonly number[];
  readonly retainedIndirectArguments: readonly number[];
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
  readonly singleCrystal: GpuSolverValidationResult;
  readonly extractionClassification: ExtractionClassificationProofResult;
  readonly extractionEmission: ExtractionEmissionProofResult;
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

interface AnalyticPlaneResources {
  readonly phase: Storage3DTexture;
  readonly solidificationTime: Storage3DTexture;
  readonly initialize: ComputeNode;
  readonly classification: GpuCellClassification;
  readonly compaction: GpuCellCompaction;
  readonly completeEmission: GpuVertexEmission;
  readonly overflowEmission: GpuVertexEmission;
  readonly lastValidMesh: GpuLastValidMesh;
  readonly completePromotion: GpuMeshPromotion;
  readonly overflowPromotion: GpuMeshPromotion;
  dispose(): void;
}

function createStorageTexture(
  name: string,
  size = GRID_SIZE,
): Storage3DTexture {
  const texture = new Storage3DTexture(size, size, size);
  texture.name = name;
  texture.format = RGBAFormat;
  texture.type = FloatType;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function voxelCoordinate(size = GRID_SIZE) {
  const x = instanceIndex.mod(size);
  const y = instanceIndex.div(size).mod(size);
  const z = instanceIndex.div(size * size);
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

function createAnalyticPlaneResources(): AnalyticPlaneResources {
  const phase = createStorageTexture(
    'Milestone 2 analytic plane phase field',
    ANALYTIC_PLANE_GRID_SIZE,
  );
  const solidificationTime = createStorageTexture(
    'Milestone 2 analytic plane solidification time',
    ANALYTIC_PLANE_GRID_SIZE,
  );
  const initialize = Fn(() => {
    const coordinate = voxelCoordinate(ANALYTIC_PLANE_GRID_SIZE);
    const value = float(coordinate.x).div(ANALYTIC_PLANE_GRID_SIZE - 1);
    textureStore(phase, coordinate, vec4(value)).toWriteOnly();
    const birthTime = coordinate.x.lessThanEqual(3).select(float(2), float(-1));
    textureStore(solidificationTime, coordinate, vec4(birthTime)).toWriteOnly();
  })().compute(ANALYTIC_PLANE_GRID_SIZE ** 3, [...WORKGROUP_SIZE]);
  const classification = createGpuCellClassification(phase, [
    ANALYTIC_PLANE_GRID_SIZE,
    ANALYTIC_PLANE_GRID_SIZE,
    ANALYTIC_PLANE_GRID_SIZE,
  ]);
  const compaction = createGpuCellCompaction(classification);
  const completeEmission = createGpuVertexEmission(
    phase,
    solidificationTime,
    classification,
    compaction,
    {
      spacing: 1,
      physicalOrigin: [0, 0, 0],
      vertexCapacity: ANALYTIC_PLANE_VERTEX_COUNT,
      simulatedTime: 10,
    },
  );
  const overflowEmission = createGpuVertexEmission(
    phase,
    solidificationTime,
    classification,
    compaction,
    {
      spacing: 1,
      physicalOrigin: [0, 0, 0],
      vertexCapacity: ANALYTIC_PLANE_VERTEX_COUNT - 3,
      simulatedTime: 10,
    },
  );
  const lastValidMesh = createGpuLastValidMesh(ANALYTIC_PLANE_VERTEX_COUNT);
  const completePromotion = lastValidMesh.createPromotion(completeEmission);
  const overflowPromotion = lastValidMesh.createPromotion(overflowEmission);

  return {
    phase,
    solidificationTime,
    initialize,
    classification,
    compaction,
    completeEmission,
    overflowEmission,
    lastValidMesh,
    completePromotion,
    overflowPromotion,
    dispose() {
      initialize.dispose();
      classification.dispose();
      compaction.dispose();
      completeEmission.dispose();
      overflowEmission.dispose();
      completePromotion.dispose();
      overflowPromotion.dispose();
      phase.dispose();
      solidificationTime.dispose();
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

async function runExtractionClassificationProof(
  renderer: WebGPURenderer,
  resources: AnalyticPlaneResources,
): Promise<ExtractionClassificationProofResult> {
  await renderer.computeAsync(resources.initialize);
  await renderer.computeAsync(resources.classification.classify);
  await resources.compaction.execute(renderer);
  const caseIndices = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(resources.classification.cases),
    ),
  );
  const activeFlags = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(resources.classification.activeFlags),
    ),
  );
  const triangleCounts = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(
        resources.classification.triangleCounts,
      ),
    ),
  );
  const activeOffsets = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(
        resources.compaction.activeScan.offsets,
      ),
    ),
  );
  const triangleOffsets = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(
        resources.compaction.triangleScan.offsets,
      ),
    ),
  );
  const activeCellCount = new Uint32Array(
    await renderer.getArrayBufferAsync(resources.compaction.activeScan.total),
  )[0]!;
  const triangleCount = new Uint32Array(
    await renderer.getArrayBufferAsync(resources.compaction.triangleScan.total),
  )[0]!;
  const compactedActiveCells = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(
        resources.compaction.compactedActiveCells,
      ),
    ),
  );
  const expectedCaseIndices: number[] = [];
  const [width, height, depth] = resources.classification.cellShape;
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        expectedCaseIndices.push(x < 3 ? 255 : x === 3 ? 153 : 0);
      }
    }
  }
  const expectedActiveFlags = expectedCaseIndices.map((caseIndex) =>
    isActiveMarchingCubesCase(caseIndex) ? 1 : 0,
  );
  const expectedTriangleCounts = expectedCaseIndices.map(
    marchingCubesTriangleCount,
  );
  const expectedActiveScan = exclusiveScanReference(expectedActiveFlags);
  const expectedTriangleScan = exclusiveScanReference(expectedTriangleCounts);
  const expectedCompaction = compactActiveCellsReference(expectedActiveFlags);
  const expectedActiveCellCount = height * depth;
  const expectedTriangleCount = expectedActiveCellCount * 2;
  const mismatchCount = (
    actual: ArrayLike<number>,
    expected: ArrayLike<number>,
  ) =>
    Array.from(actual).filter((value, index) => value !== expected[index])
      .length;
  const caseMismatchCount = mismatchCount(caseIndices, expectedCaseIndices);
  const activeFlagMismatchCount = mismatchCount(
    activeFlags,
    expectedActiveFlags,
  );
  const triangleCountMismatchCount = mismatchCount(
    triangleCounts,
    expectedTriangleCounts,
  );
  const activeOffsetMismatchCount = mismatchCount(
    activeOffsets,
    expectedActiveScan.offsets,
  );
  const triangleOffsetMismatchCount = mismatchCount(
    triangleOffsets,
    expectedTriangleScan.offsets,
  );
  const compactedCellMismatchCount = mismatchCount(
    compactedActiveCells.slice(0, expectedCompaction.indices.length),
    expectedCompaction.indices,
  );

  return {
    cellShape: resources.classification.cellShape,
    cellCount: resources.classification.cellCount,
    representativeCaseRow: expectedCaseIndices.slice(0, width),
    activeCellCount,
    expectedActiveCellCount,
    triangleCount,
    expectedTriangleCount,
    activeScanLevelCount: resources.compaction.activeScan.levelCount,
    triangleScanLevelCount: resources.compaction.triangleScan.levelCount,
    caseMismatchCount,
    activeFlagMismatchCount,
    triangleCountMismatchCount,
    activeOffsetMismatchCount,
    triangleOffsetMismatchCount,
    compactedCellMismatchCount,
    passed:
      caseMismatchCount === 0 &&
      activeFlagMismatchCount === 0 &&
      triangleCountMismatchCount === 0 &&
      activeOffsetMismatchCount === 0 &&
      triangleOffsetMismatchCount === 0 &&
      compactedCellMismatchCount === 0 &&
      activeCellCount === expectedActiveCellCount &&
      triangleCount === expectedTriangleCount &&
      resources.compaction.activeScan.levelCount === 2 &&
      resources.compaction.triangleScan.levelCount === 2,
  };
}

async function runExtractionEmissionProof(
  renderer: WebGPURenderer,
  resources: AnalyticPlaneResources,
): Promise<ExtractionEmissionProofResult> {
  await resources.completeEmission.execute(renderer);
  await resources.completePromotion.execute(renderer);
  const promotedPositionsBeforeOverflow = new Float32Array(
    await renderer.getArrayBufferAsync(resources.lastValidMesh.positions),
  );
  const completeIndirectArguments = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(resources.lastValidMesh.indirect),
    ),
  );
  await resources.overflowEmission.execute(renderer);
  await resources.overflowPromotion.execute(renderer);
  const promotedPositionsAfterOverflow = new Float32Array(
    await renderer.getArrayBufferAsync(resources.lastValidMesh.positions),
  );
  const retainedIndirectArguments = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(resources.lastValidMesh.indirect),
    ),
  );
  const completeSummary = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(resources.completeEmission.summary),
    ),
  );
  const overflowSummary = Array.from(
    new Uint32Array(
      await renderer.getArrayBufferAsync(resources.overflowEmission.summary),
    ),
  );
  const packedPositions = new Float32Array(
    await renderer.getArrayBufferAsync(resources.completeEmission.positions),
  );
  const packedNormalAge = new Float32Array(
    await renderer.getArrayBufferAsync(resources.completeEmission.normalAge),
  );
  const requestedVertexCount = completeSummary[0] ?? 0;
  const emittedVertexCount = completeSummary[1] ?? 0;
  const boundsMinimum: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const boundsMaximum: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  let positionMismatchCount = 0;
  for (let vertex = 0; vertex < emittedVertexCount; vertex += 1) {
    const base = vertex * 4;
    const position = [
      packedPositions[base] ?? Number.NaN,
      packedPositions[base + 1] ?? Number.NaN,
      packedPositions[base + 2] ?? Number.NaN,
    ] as const;
    for (let axis = 0; axis < 3; axis += 1) {
      boundsMinimum[axis] = Math.min(boundsMinimum[axis]!, position[axis]!);
      boundsMaximum[axis] = Math.max(boundsMaximum[axis]!, position[axis]!);
    }
    if (
      !position.every(Number.isFinite) ||
      Math.abs(position[0] - 3.5) > COMPUTE_TOLERANCE ||
      position[1] < 0 ||
      position[1] > 7 ||
      position[2] < 0 ||
      position[2] > 7 ||
      Math.abs(position[1] - Math.round(position[1])) > COMPUTE_TOLERANCE ||
      Math.abs(position[2] - Math.round(position[2])) > COMPUTE_TOLERANCE ||
      Math.abs((packedPositions[base + 3] ?? Number.NaN) - 1) >
        COMPUTE_TOLERANCE
    ) {
      positionMismatchCount += 1;
    }
  }

  let windingMismatchCount = 0;
  for (let triangle = 0; triangle < emittedVertexCount / 3; triangle += 1) {
    const first = triangle * 12;
    const ax = packedPositions[first] ?? Number.NaN;
    const ay = packedPositions[first + 1] ?? Number.NaN;
    const az = packedPositions[first + 2] ?? Number.NaN;
    const abx = (packedPositions[first + 4] ?? Number.NaN) - ax;
    const aby = (packedPositions[first + 5] ?? Number.NaN) - ay;
    const abz = (packedPositions[first + 6] ?? Number.NaN) - az;
    const acx = (packedPositions[first + 8] ?? Number.NaN) - ax;
    const acy = (packedPositions[first + 9] ?? Number.NaN) - ay;
    const acz = (packedPositions[first + 10] ?? Number.NaN) - az;
    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;
    if (
      crossX <= 0 ||
      Math.abs(crossY) > COMPUTE_TOLERANCE ||
      Math.abs(crossZ) > COMPUTE_TOLERANCE
    ) {
      windingMismatchCount += 1;
    }
  }

  let normalMismatchCount = 0;
  let surfaceAgeMismatchCount = 0;
  let surfaceAgeMinimum = Number.POSITIVE_INFINITY;
  let surfaceAgeMaximum = Number.NEGATIVE_INFINITY;
  let retainedPositionMismatchCount = 0;
  for (let vertex = 0; vertex < emittedVertexCount; vertex += 1) {
    const base = vertex * 4;
    if (
      Math.abs((packedNormalAge[base] ?? Number.NaN) - 1) > COMPUTE_TOLERANCE ||
      Math.abs(packedNormalAge[base + 1] ?? Number.NaN) > COMPUTE_TOLERANCE ||
      Math.abs(packedNormalAge[base + 2] ?? Number.NaN) > COMPUTE_TOLERANCE
    ) {
      normalMismatchCount += 1;
    }
    const surfaceAge = packedNormalAge[base + 3] ?? Number.NaN;
    surfaceAgeMinimum = Math.min(surfaceAgeMinimum, surfaceAge);
    surfaceAgeMaximum = Math.max(surfaceAgeMaximum, surfaceAge);
    if (
      Math.abs(surfaceAge - EXPECTED_ANALYTIC_SURFACE_AGE) >
      SURFACE_AGE_TOLERANCE
    ) {
      surfaceAgeMismatchCount += 1;
    }
    for (let component = 0; component < 4; component += 1) {
      const index = base + component;
      if (
        Math.abs(
          (promotedPositionsBeforeOverflow[index] ?? Number.NaN) -
            (promotedPositionsAfterOverflow[index] ?? Number.NaN),
        ) > COMPUTE_TOLERANCE
      ) {
        retainedPositionMismatchCount += 1;
      }
    }
  }

  return {
    requestedVertexCount,
    emittedVertexCount,
    boundsMinimum,
    boundsMaximum,
    positionMismatchCount,
    windingMismatchCount,
    normalMismatchCount,
    surfaceAgeMismatchCount,
    expectedSurfaceAge: EXPECTED_ANALYTIC_SURFACE_AGE,
    surfaceAgeTolerance: SURFACE_AGE_TOLERANCE,
    surfaceAgeMinimum,
    surfaceAgeMaximum,
    retainedPositionMismatchCount,
    completeSummary,
    overflowSummary,
    completeIndirectArguments,
    retainedIndirectArguments,
    passed:
      requestedVertexCount === ANALYTIC_PLANE_VERTEX_COUNT &&
      emittedVertexCount === ANALYTIC_PLANE_VERTEX_COUNT &&
      boundsMinimum.every(
        (value, axis) =>
          Math.abs(value - ([3.5, 0, 0][axis] ?? Number.NaN)) <=
          COMPUTE_TOLERANCE,
      ) &&
      boundsMaximum.every(
        (value, axis) =>
          Math.abs(value - ([3.5, 7, 7][axis] ?? Number.NaN)) <=
          COMPUTE_TOLERANCE,
      ) &&
      positionMismatchCount === 0 &&
      windingMismatchCount === 0 &&
      normalMismatchCount === 0 &&
      surfaceAgeMismatchCount === 0 &&
      retainedPositionMismatchCount === 0 &&
      JSON.stringify(completeSummary) === JSON.stringify([294, 294, 0, 98]) &&
      JSON.stringify(overflowSummary) === JSON.stringify([294, 291, 1, 98]) &&
      JSON.stringify(completeIndirectArguments) ===
        JSON.stringify([294, 1, 0, 0]) &&
      JSON.stringify(retainedIndirectArguments) ===
        JSON.stringify([294, 1, 0, 0]),
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
  const analyticPlane = createAnalyticPlaneResources();
  const indirect = createIndirectResources();

  try {
    const compute = await runComputeProof(session.renderer, pingPong);
    const singleCrystal = await runGpuSolverValidation(
      session.renderer,
      session.device,
    );
    const extractionClassification = await runExtractionClassificationProof(
      session.renderer,
      analyticPlane,
    );
    const extractionEmission = await runExtractionEmissionProof(
      session.renderer,
      analyticPlane,
    );
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
      singleCrystal,
      extractionClassification,
      extractionEmission,
      indirectDraw,
      ...(benchmark ? { benchmark } : {}),
      uncapturedErrors: [...session.errors],
    };
  } finally {
    pingPong.dispose();
    analyticPlane.dispose();
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
