import {
  MARCHING_CUBES_CORNER_OFFSETS,
  MARCHING_CUBES_ISOVALUE,
  classifyMarchingCubesCell,
  interpolateMarchingCubesEdge,
  marchingCubesTriangleEdges,
  type ExtractionVec3,
  type GridShape,
} from './marching-cubes';

export interface MarchingCubesReferenceInput {
  readonly field: ArrayLike<number>;
  readonly shape: GridShape;
  readonly spacing: number;
  readonly physicalOrigin: ExtractionVec3;
  readonly isovalue?: number;
}

export interface MarchingCubesReferenceMesh {
  readonly positions: readonly ExtractionVec3[];
  readonly triangleCount: number;
}

function gridIndex(x: number, y: number, z: number, shape: GridShape): number {
  return x + shape[0] * (y + shape[1] * z);
}

export function extractMarchingCubesReference(
  input: MarchingCubesReferenceInput,
): MarchingCubesReferenceMesh {
  const [width, height, depth] = input.shape;
  const expectedLength = width * height * depth;
  if (input.field.length !== expectedLength) {
    throw new RangeError('Reference field length does not match its shape.');
  }
  if (!Number.isFinite(input.spacing) || input.spacing <= 0) {
    throw new RangeError('Reference extraction spacing must be positive.');
  }
  const isovalue = input.isovalue ?? MARCHING_CUBES_ISOVALUE;
  const positions: ExtractionVec3[] = [];

  for (let z = 0; z < depth - 1; z += 1) {
    for (let y = 0; y < height - 1; y += 1) {
      for (let x = 0; x < width - 1; x += 1) {
        const samples = MARCHING_CUBES_CORNER_OFFSETS.map(
          ([dx, dy, dz]) =>
            input.field[gridIndex(x + dx, y + dy, z + dz, input.shape)] ??
            Number.NaN,
        );
        const caseIndex = classifyMarchingCubesCell(samples, isovalue);
        const cellOrigin: ExtractionVec3 = [
          input.physicalOrigin[0] + x * input.spacing,
          input.physicalOrigin[1] + y * input.spacing,
          input.physicalOrigin[2] + z * input.spacing,
        ];
        for (const edgeIndex of marchingCubesTriangleEdges(caseIndex)) {
          positions.push(
            interpolateMarchingCubesEdge(
              cellOrigin,
              input.spacing,
              samples,
              edgeIndex,
              isovalue,
            ),
          );
        }
      }
    }
  }

  return { positions, triangleCount: positions.length / 3 };
}
