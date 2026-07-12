import {
  StorageBufferAttribute,
  type ComputeNode,
  type Storage3DTexture,
} from 'three/webgpu';
import {
  Fn,
  instanceIndex,
  storage,
  storageTexture3D,
  uint,
  uvec3,
} from 'three/tsl';
import { triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

export const MARCHING_CUBES_ISOVALUE = 0.5;

// Per-case counts derived from the canonical triTable shipped by pinned
// Three.js r185. The full edge sequence enters with vertex emission.
const TRIANGLE_COUNTS = new Uint32Array([
  0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 2, 1, 2, 2, 3, 2, 3, 3, 4, 2, 3,
  3, 4, 3, 4, 4, 3, 1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 3, 2, 3, 3, 2,
  3, 4, 4, 3, 3, 4, 4, 3, 4, 5, 5, 2, 1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4,
  4, 3, 2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 4, 2, 3, 3, 4, 3, 4, 2, 3,
  3, 4, 4, 5, 4, 5, 3, 2, 3, 4, 4, 3, 4, 5, 3, 2, 4, 5, 5, 4, 5, 2, 4, 1, 1, 2,
  2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 3, 2, 3, 3, 4, 3, 4, 4, 5, 3, 2, 4, 3,
  4, 3, 5, 2, 2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 4, 3, 4, 4, 3, 4, 5,
  5, 4, 4, 3, 5, 2, 5, 4, 2, 1, 2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 2, 3, 3, 2,
  3, 4, 4, 5, 4, 5, 5, 2, 4, 3, 5, 4, 3, 2, 4, 1, 3, 4, 4, 5, 4, 5, 3, 4, 4, 5,
  5, 2, 3, 4, 2, 1, 2, 3, 3, 2, 3, 4, 2, 1, 3, 2, 4, 1, 2, 1, 1, 0,
]);

/**
 * Standard Lorensen-Cline corner order. Bits set in a case index represent
 * samples on the solid side of the phase field (`phase <= isovalue`).
 */
export const MARCHING_CUBES_CORNER_OFFSETS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
] as const;

export const MARCHING_CUBES_EDGE_CORNERS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

const ORIENTED_TRIANGLE_EDGES = new Uint32Array(256 * 16).fill(0xffff_ffff);
for (let caseIndex = 0; caseIndex < 256; caseIndex += 1) {
  const triangleCount = TRIANGLE_COUNTS[caseIndex]!;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const source = caseIndex * 16 + triangle * 3;
    const target = source;
    ORIENTED_TRIANGLE_EDGES[target] = triTable[source]!;
    ORIENTED_TRIANGLE_EDGES[target + 1] = triTable[source + 2]!;
    ORIENTED_TRIANGLE_EDGES[target + 2] = triTable[source + 1]!;
  }
}

export type GridShape = readonly [number, number, number];
export type ExtractionVec3 = readonly [number, number, number];

export interface GpuCellClassification {
  readonly cellShape: GridShape;
  readonly cellCount: number;
  readonly cases: StorageBufferAttribute;
  readonly activeFlags: StorageBufferAttribute;
  readonly triangleCounts: StorageBufferAttribute;
  readonly classify: ComputeNode;
  dispose(): void;
}

function assertGridShape(shape: GridShape): void {
  if (shape.some((size) => !Number.isSafeInteger(size) || size < 2)) {
    throw new RangeError(
      'Marching-cubes grid dimensions must be integers >= 2.',
    );
  }
}

export function marchingCubesCellShape(shape: GridShape): GridShape {
  assertGridShape(shape);
  return [shape[0] - 1, shape[1] - 1, shape[2] - 1];
}

export function marchingCubesCellCount(shape: GridShape): number {
  const cellShape = marchingCubesCellShape(shape);
  return cellShape[0] * cellShape[1] * cellShape[2];
}

export function classifyMarchingCubesCell(
  samples: readonly number[],
  isovalue = MARCHING_CUBES_ISOVALUE,
): number {
  if (samples.length !== MARCHING_CUBES_CORNER_OFFSETS.length) {
    throw new RangeError('Marching-cubes classification requires 8 samples.');
  }
  if (!Number.isFinite(isovalue)) {
    throw new RangeError('Marching-cubes isovalue must be finite.');
  }

  let caseIndex = 0;
  samples.forEach((sample, corner) => {
    if (!Number.isFinite(sample)) {
      throw new RangeError('Marching-cubes samples must be finite.');
    }
    if (sample <= isovalue) {
      caseIndex |= 1 << corner;
    }
  });
  return caseIndex;
}

export function isActiveMarchingCubesCase(caseIndex: number): boolean {
  return Number.isInteger(caseIndex) && caseIndex > 0 && caseIndex < 255;
}

export function marchingCubesTriangleCount(caseIndex: number): number {
  if (!Number.isInteger(caseIndex) || caseIndex < 0 || caseIndex > 255) {
    throw new RangeError(
      'Marching-cubes case index must be an integer in 0..255.',
    );
  }
  return TRIANGLE_COUNTS[caseIndex]!;
}

export function marchingCubesTriangleEdges(caseIndex: number): number[] {
  const triangleCount = marchingCubesTriangleCount(caseIndex);
  const start = caseIndex * 16;
  return Array.from(
    ORIENTED_TRIANGLE_EDGES.slice(start, start + triangleCount * 3),
  );
}

export function interpolateMarchingCubesEdge(
  cellOrigin: ExtractionVec3,
  spacing: number,
  samples: readonly number[],
  edgeIndex: number,
  isovalue = MARCHING_CUBES_ISOVALUE,
): ExtractionVec3 {
  if (samples.length !== MARCHING_CUBES_CORNER_OFFSETS.length) {
    throw new RangeError('Marching-cubes interpolation requires 8 samples.');
  }
  if (
    !Number.isInteger(edgeIndex) ||
    edgeIndex < 0 ||
    edgeIndex >= MARCHING_CUBES_EDGE_CORNERS.length
  ) {
    throw new RangeError('Marching-cubes edge index must be in 0..11.');
  }
  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new RangeError('Marching-cubes spacing must be positive and finite.');
  }
  if (
    !Number.isFinite(isovalue) ||
    cellOrigin.some((component) => !Number.isFinite(component)) ||
    samples.some((sample) => !Number.isFinite(sample))
  ) {
    throw new RangeError('Marching-cubes interpolation inputs must be finite.');
  }

  const [cornerA, cornerB] = MARCHING_CUBES_EDGE_CORNERS[edgeIndex]!;
  const offsetA = MARCHING_CUBES_CORNER_OFFSETS[cornerA];
  const offsetB = MARCHING_CUBES_CORNER_OFFSETS[cornerB];
  const valueA = samples[cornerA]!;
  const valueB = samples[cornerB]!;
  if (valueA === valueB) {
    throw new RangeError(
      'Marching-cubes interpolation edge has equal samples.',
    );
  }
  const interpolation = Math.min(
    1,
    Math.max(0, (isovalue - valueA) / (valueB - valueA)),
  );
  return [0, 1, 2].map(
    (axis) =>
      cellOrigin[axis]! +
      (offsetA[axis]! + (offsetB[axis]! - offsetA[axis]!) * interpolation) *
        spacing,
  ) as unknown as ExtractionVec3;
}

export function createOrientedTriangleEdgeLookup(): Uint32Array {
  return new Uint32Array(ORIENTED_TRIANGLE_EDGES);
}

export function createTriangleCountLookup(): Uint32Array {
  return new Uint32Array(TRIANGLE_COUNTS);
}

export function createGpuCellClassification(
  phase: Storage3DTexture,
  gridShape: GridShape,
): GpuCellClassification {
  const cellShape = marchingCubesCellShape(gridShape);
  const cellCount = marchingCubesCellCount(gridShape);
  const cases = new StorageBufferAttribute(new Uint32Array(cellCount), 1);
  cases.name = 'Marching-cubes case indices';
  const activeFlags = new StorageBufferAttribute(new Uint32Array(cellCount), 1);
  activeFlags.name = 'Marching-cubes active-cell flags';
  const triangleCounts = new StorageBufferAttribute(
    new Uint32Array(cellCount),
    1,
  );
  triangleCounts.name = 'Marching-cubes triangle counts';
  const triangleCountLookup = new StorageBufferAttribute(
    new Uint32Array(TRIANGLE_COUNTS),
    1,
  );
  triangleCountLookup.name = 'Marching-cubes triangle-count lookup';
  const caseStorage = storage(cases, 'uint', cellCount);
  const activeStorage = storage(activeFlags, 'uint', cellCount);
  const triangleStorage = storage(triangleCounts, 'uint', cellCount);
  const triangleLookupStorage = storage(
    triangleCountLookup,
    'uint',
    TRIANGLE_COUNTS.length,
  ).toReadOnly();

  const classify = Fn(() => {
    const x = instanceIndex.mod(cellShape[0]);
    const y = instanceIndex.div(cellShape[0]).mod(cellShape[1]);
    const z = instanceIndex.div(cellShape[0] * cellShape[1]);
    const origin = uvec3(x, y, z);
    const caseIndex = uint(0).toVar();

    for (
      let corner = 0;
      corner < MARCHING_CUBES_CORNER_OFFSETS.length;
      corner += 1
    ) {
      const offset = MARCHING_CUBES_CORNER_OFFSETS[corner]!;
      const sample = storageTexture3D(phase)
        .load(origin.add(uvec3(offset[0], offset[1], offset[2])))
        .toReadOnly().r;
      caseIndex.addAssign(
        sample
          .lessThanEqual(MARCHING_CUBES_ISOVALUE)
          .select(uint(1 << corner), uint(0)),
      );
    }

    caseStorage.element(instanceIndex).assign(caseIndex);
    const triangleCount = triangleLookupStorage.element(caseIndex).toVar();
    triangleStorage.element(instanceIndex).assign(triangleCount);
    activeStorage
      .element(instanceIndex)
      .assign(triangleCount.greaterThan(0).select(uint(1), uint(0)));
  })().compute(cellCount, [64, 1, 1]);

  return {
    cellShape,
    cellCount,
    cases,
    activeFlags,
    triangleCounts,
    classify,
    dispose() {
      classify.dispose();
    },
  };
}
