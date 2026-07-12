import {
  StorageBufferAttribute,
  type ComputeNode,
  type Node,
  type Storage3DTexture,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  Fn,
  If,
  clamp,
  float,
  instanceIndex,
  max,
  storage,
  storageTexture3D,
  uniform,
  uint,
  uvec3,
  uvec4,
  vec3,
  vec4,
} from 'three/tsl';
import type { GpuCellCompaction } from './gpu-cell-compaction';
import {
  MARCHING_CUBES_CORNER_OFFSETS,
  MARCHING_CUBES_EDGE_CORNERS,
  MARCHING_CUBES_ISOVALUE,
  createOrientedTriangleEdgeLookup,
  createTriangleCountLookup,
  type ExtractionVec3,
  type GpuCellClassification,
} from './marching-cubes';

export interface VertexEmissionPlan {
  readonly requestedVertexCount: number;
  readonly emittedVertexCount: number;
  readonly overflow: boolean;
}

export interface GpuVertexEmission {
  readonly vertexCapacity: number;
  readonly positions: StorageBufferAttribute;
  /** Phase-gradient normal in xyz and non-negative surface age in w. */
  readonly normalAge: StorageBufferAttribute;
  /** `[requested vertices, emitted vertices, overflow flag, triangles]`. */
  readonly summary: StorageBufferAttribute;
  readonly updateSummary: ComputeNode;
  readonly emitVertices: ComputeNode;
  execute(renderer: WebGPURenderer): Promise<void>;
  setSimulatedTime(simulatedTime: number): void;
  dispose(): void;
}

export interface GpuVertexEmissionOptions {
  readonly spacing: number;
  readonly physicalOrigin: ExtractionVec3;
  readonly vertexCapacity: number;
  readonly simulatedTime: number;
}

type UintNode = Node<'uint'>;
type Uvec3Node = Node<'uvec3'>;

export function planVertexEmission(
  triangleCount: number,
  vertexCapacity: number,
): VertexEmissionPlan {
  if (!Number.isSafeInteger(triangleCount) || triangleCount < 0) {
    throw new RangeError('Triangle count must be a non-negative integer.');
  }
  if (
    !Number.isSafeInteger(vertexCapacity) ||
    vertexCapacity < 3 ||
    vertexCapacity % 3 !== 0
  ) {
    throw new RangeError(
      'Vertex capacity must be a positive triangle multiple.',
    );
  }
  const requestedVertexCount = triangleCount * 3;
  if (!Number.isSafeInteger(requestedVertexCount)) {
    throw new RangeError(
      'Requested vertex count exceeds safe integer capacity.',
    );
  }
  return {
    requestedVertexCount,
    emittedVertexCount: Math.min(requestedVertexCount, vertexCapacity),
    overflow: requestedVertexCount > vertexCapacity,
  };
}

export function interpolateSurfaceAge(
  birthTimeA: number,
  birthTimeB: number,
  interpolation: number,
  simulatedTime: number,
): number {
  if (
    ![birthTimeA, birthTimeB, interpolation, simulatedTime].every(
      Number.isFinite,
    ) ||
    interpolation < 0 ||
    interpolation > 1
  ) {
    throw new RangeError('Surface-age interpolation inputs are invalid.');
  }
  const birthTime =
    birthTimeA >= 0 && birthTimeB >= 0
      ? birthTimeA + (birthTimeB - birthTimeA) * interpolation
      : birthTimeA >= 0
        ? birthTimeA
        : birthTimeB >= 0
          ? birthTimeB
          : simulatedTime;
  return Math.max(0, simulatedTime - birthTime);
}

export function createGpuVertexEmission(
  phase: Storage3DTexture,
  solidificationTime: Storage3DTexture,
  classification: GpuCellClassification,
  compaction: GpuCellCompaction,
  options: GpuVertexEmissionOptions,
): GpuVertexEmission {
  planVertexEmission(0, options.vertexCapacity);
  if (!Number.isFinite(options.spacing) || options.spacing <= 0) {
    throw new RangeError(
      'Vertex-emission spacing must be positive and finite.',
    );
  }
  if (options.physicalOrigin.some((component) => !Number.isFinite(component))) {
    throw new RangeError('Vertex-emission origin must be finite.');
  }
  if (!Number.isFinite(options.simulatedTime) || options.simulatedTime < 0) {
    throw new RangeError(
      'Vertex-emission simulated time must be non-negative.',
    );
  }

  const positions = new StorageBufferAttribute(options.vertexCapacity, 4);
  positions.name = 'Marching-cubes emitted positions';
  const normalAge = new StorageBufferAttribute(options.vertexCapacity, 4);
  normalAge.name = 'Marching-cubes emitted normal and surface age';
  const summary = new StorageBufferAttribute(new Uint32Array(4), 4);
  summary.name = 'Marching-cubes vertex-emission summary';
  const positionStorage = storage(positions, 'vec4', options.vertexCapacity);
  const normalAgeStorage = storage(normalAge, 'vec4', options.vertexCapacity);
  const summaryStorage = storage(summary, 'uvec4', 1);
  const triangleTotal = storage(
    compaction.triangleScan.total,
    'uint',
    1,
  ).toReadOnly();
  const activeTotal = storage(
    compaction.activeScan.total,
    'uint',
    1,
  ).toReadOnly();
  const compactedCells = storage(
    compaction.compactedActiveCells,
    'uint',
    classification.cellCount,
  ).toReadOnly();
  const cases = storage(
    classification.cases,
    'uint',
    classification.cellCount,
  ).toReadOnly();
  const triangleOffsets = storage(
    compaction.triangleScan.offsets,
    'uint',
    classification.cellCount,
  ).toReadOnly();
  const triangleEdgeLookup = createOrientedTriangleEdgeLookup();
  const triangleCountOffset = triangleEdgeLookup.length;
  const triangleCountLookup = createTriangleCountLookup();
  const edgeCornerOffset = triangleCountOffset + triangleCountLookup.length;
  const edgeCornerLookup = MARCHING_CUBES_EDGE_CORNERS.flat();
  const cornerOffsetOffset = edgeCornerOffset + edgeCornerLookup.length;
  const packedCornerOffsets = MARCHING_CUBES_CORNER_OFFSETS.flatMap(
    (offset) => [offset[0], offset[1], offset[2], 0],
  );
  const packedLookup = new StorageBufferAttribute(
    new Uint32Array([
      ...triangleEdgeLookup,
      ...triangleCountLookup,
      ...edgeCornerLookup,
      ...packedCornerOffsets,
    ]),
    1,
  );
  packedLookup.name = 'Packed marching-cubes lookup data';
  const lookupStorage = storage(
    packedLookup,
    'uint',
    packedLookup.count,
  ).toReadOnly();
  const simulatedTime = uniform(options.simulatedTime);

  const updateSummary = Fn(() => {
    const triangles = triangleTotal.element(0);
    const requestedVertices = triangles.mul(3);
    const emittedVertices = requestedVertices
      .lessThan(options.vertexCapacity)
      .select(requestedVertices, uint(options.vertexCapacity));
    summaryStorage
      .element(0)
      .assign(
        uvec4(
          requestedVertices,
          emittedVertices,
          requestedVertices
            .greaterThan(options.vertexCapacity)
            .select(uint(1), uint(0)),
          triangles,
        ),
      );
  })().compute(1, [1, 1, 1]);

  const positionForEdge = Fn(
    ([cellOrigin, edgeIndex]: [Uvec3Node, UintNode]) => {
      const edgeLookupIndex = edgeIndex.mul(2).add(edgeCornerOffset);
      const cornerA = lookupStorage.element(edgeLookupIndex);
      const cornerB = lookupStorage.element(edgeLookupIndex.add(1));
      const offsetAIndex = cornerA.mul(4).add(cornerOffsetOffset);
      const offsetBIndex = cornerB.mul(4).add(cornerOffsetOffset);
      const offsetA = uvec3(
        lookupStorage.element(offsetAIndex),
        lookupStorage.element(offsetAIndex.add(1)),
        lookupStorage.element(offsetAIndex.add(2)),
      );
      const offsetB = uvec3(
        lookupStorage.element(offsetBIndex),
        lookupStorage.element(offsetBIndex.add(1)),
        lookupStorage.element(offsetBIndex.add(2)),
      );
      const coordinateA = cellOrigin.add(offsetA);
      const coordinateB = cellOrigin.add(offsetB);
      const valueA = storageTexture3D(phase).load(coordinateA).toReadOnly().r;
      const valueB = storageTexture3D(phase).load(coordinateB).toReadOnly().r;
      const interpolation = clamp(
        float(MARCHING_CUBES_ISOVALUE).sub(valueA).div(valueB.sub(valueA)),
        0,
        1,
      );
      const gridPosition = coordinateA
        .toVec3()
        .add(coordinateB.toVec3().sub(coordinateA.toVec3()).mul(interpolation));
      const physicalPosition = vec3(
        options.physicalOrigin[0],
        options.physicalOrigin[1],
        options.physicalOrigin[2],
      ).add(gridPosition.mul(options.spacing));
      return vec4(physicalPosition, 1);
    },
  );

  const phaseGradientAt = Fn(([coordinate]: [Uvec3Node]) => {
    const [width, height, depth] = classification.cellShape.map(
      (size) => size + 1,
    ) as [number, number, number];
    const xm = coordinate.x.equal(0).select(coordinate.x, coordinate.x.sub(1));
    const xp = coordinate.x
      .equal(width - 1)
      .select(coordinate.x, coordinate.x.add(1));
    const ym = coordinate.y.equal(0).select(coordinate.y, coordinate.y.sub(1));
    const yp = coordinate.y
      .equal(height - 1)
      .select(coordinate.y, coordinate.y.add(1));
    const zm = coordinate.z.equal(0).select(coordinate.z, coordinate.z.sub(1));
    const zp = coordinate.z
      .equal(depth - 1)
      .select(coordinate.z, coordinate.z.add(1));
    const phaseAt = (sampleCoordinate: Uvec3Node) =>
      storageTexture3D(phase).load(sampleCoordinate).toReadOnly().r;
    return vec3(
      phaseAt(uvec3(xp, coordinate.y, coordinate.z)).sub(
        phaseAt(uvec3(xm, coordinate.y, coordinate.z)),
      ),
      phaseAt(uvec3(coordinate.x, yp, coordinate.z)).sub(
        phaseAt(uvec3(coordinate.x, ym, coordinate.z)),
      ),
      phaseAt(uvec3(coordinate.x, coordinate.y, zp)).sub(
        phaseAt(uvec3(coordinate.x, coordinate.y, zm)),
      ),
    ).mul(0.5 / options.spacing);
  });

  const normalAgeForEdge = Fn(
    ([cellOrigin, edgeIndex]: [Uvec3Node, UintNode]) => {
      const edgeLookupIndex = edgeIndex.mul(2).add(edgeCornerOffset);
      const cornerA = lookupStorage.element(edgeLookupIndex);
      const cornerB = lookupStorage.element(edgeLookupIndex.add(1));
      const offsetAIndex = cornerA.mul(4).add(cornerOffsetOffset);
      const offsetBIndex = cornerB.mul(4).add(cornerOffsetOffset);
      const offsetA = uvec3(
        lookupStorage.element(offsetAIndex),
        lookupStorage.element(offsetAIndex.add(1)),
        lookupStorage.element(offsetAIndex.add(2)),
      );
      const offsetB = uvec3(
        lookupStorage.element(offsetBIndex),
        lookupStorage.element(offsetBIndex.add(1)),
        lookupStorage.element(offsetBIndex.add(2)),
      );
      const coordinateA = cellOrigin.add(offsetA);
      const coordinateB = cellOrigin.add(offsetB);
      const valueA = storageTexture3D(phase).load(coordinateA).toReadOnly().r;
      const valueB = storageTexture3D(phase).load(coordinateB).toReadOnly().r;
      const interpolation = clamp(
        float(MARCHING_CUBES_ISOVALUE).sub(valueA).div(valueB.sub(valueA)),
        0,
        1,
      );
      const gradientA = phaseGradientAt(coordinateA);
      const gradientB = phaseGradientAt(coordinateB);
      const gradient = gradientA.add(
        gradientB.sub(gradientA).mul(interpolation),
      );
      const normal = gradient.div(max(gradient.length(), 1e-12));
      const birthTimeA = storageTexture3D(solidificationTime)
        .load(coordinateA)
        .toReadOnly().r;
      const birthTimeB = storageTexture3D(solidificationTime)
        .load(coordinateB)
        .toReadOnly().r;
      const bothValid = birthTimeA
        .greaterThanEqual(0)
        .and(birthTimeB.greaterThanEqual(0));
      const interpolatedBirthTime = birthTimeA.add(
        birthTimeB.sub(birthTimeA).mul(interpolation),
      );
      const birthTime = bothValid.select(
        interpolatedBirthTime,
        birthTimeA
          .greaterThanEqual(0)
          .select(
            birthTimeA,
            birthTimeB.greaterThanEqual(0).select(birthTimeB, simulatedTime),
          ),
      );
      return vec4(normal, max(simulatedTime.sub(birthTime), 0));
    },
  );

  const [cellWidth, cellHeight] = classification.cellShape;
  const emitVertices = Fn(() => {
    If(instanceIndex.lessThan(activeTotal.element(0)), () => {
      const cellIndex = compactedCells.element(instanceIndex);
      const x = cellIndex.mod(cellWidth);
      const y = cellIndex.div(cellWidth).mod(cellHeight);
      const z = cellIndex.div(cellWidth * cellHeight);
      const cellOrigin = uvec3(x, y, z);
      const caseIndex = cases.element(cellIndex);
      const triangleCount = lookupStorage.element(
        caseIndex.add(triangleCountOffset),
      );
      const firstTriangle = triangleOffsets.element(cellIndex);
      const emittedVertexCount = summaryStorage.element(0).y;

      for (let triangle = 0; triangle < 5; triangle += 1) {
        const firstVertex = firstTriangle.add(triangle).mul(3);
        If(
          uint(triangle)
            .lessThan(triangleCount)
            .and(firstVertex.add(2).lessThan(emittedVertexCount)),
          () => {
            for (let vertex = 0; vertex < 3; vertex += 1) {
              const edgeIndex = lookupStorage.element(
                caseIndex.mul(16).add(triangle * 3 + vertex),
              );
              positionStorage
                .element(firstVertex.add(vertex))
                .assign(positionForEdge(cellOrigin, edgeIndex));
              normalAgeStorage
                .element(firstVertex.add(vertex))
                .assign(normalAgeForEdge(cellOrigin, edgeIndex));
            }
          },
        );
      }
    });
  })().compute(classification.cellCount, [128, 1, 1]);

  return {
    vertexCapacity: options.vertexCapacity,
    positions,
    normalAge,
    summary,
    updateSummary,
    emitVertices,
    async execute(renderer) {
      await renderer.computeAsync(updateSummary);
      await renderer.computeAsync(emitVertices);
    },
    setSimulatedTime(value) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError('Simulated time must be non-negative and finite.');
      }
      simulatedTime.value = value;
    },
    dispose() {
      updateSummary.dispose();
      emitVertices.dispose();
    },
  };
}
