import type { DerivedSimulationConfiguration, GridShape, Vec3 } from './config';
import {
  gridCoordinates,
  gridIndex,
  type CpuSimulationState,
} from './cpu-reference';

export interface FieldSummary {
  readonly minimum: number;
  readonly maximum: number;
  readonly mean: number;
  readonly finiteCount: number;
  readonly nonFiniteCount: number;
}

export interface SolidBounds {
  readonly empty: boolean;
  readonly minimum: Vec3;
  readonly maximum: Vec3;
  readonly extent: Vec3;
  readonly voxelCount: number;
}

export interface SymmetryMetrics {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly maximum: number;
}

export type CartesianAxis = 'x' | 'y' | 'z';

export interface FaceDepression {
  readonly axis: CartesianAxis;
  readonly direction: -1 | 1;
  readonly outerRadius: number;
  readonly centerRadius: number;
  readonly depth: number;
}

export interface FaceCenterDepressionMetrics {
  readonly faces: readonly FaceDepression[];
  readonly meanDepth: number;
  readonly minimumDepth: number;
  readonly maximumDepth: number;
}

export interface MorphologyMetrics {
  readonly phase: FieldSummary;
  readonly chemicalPotential: FieldSummary;
  readonly solidificationTime: FieldSummary;
  readonly solidVolume: number;
  readonly bounds: SolidBounds;
  readonly symmetry: SymmetryMetrics;
  readonly faceCenterDepression: FaceCenterDepressionMetrics;
}

export function summarizeField(values: ArrayLike<number>): FieldSummary {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let finiteCount = 0;
  let nonFiniteCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? Number.NaN;
    if (!Number.isFinite(value)) {
      nonFiniteCount += 1;
      continue;
    }
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    sum += value;
    finiteCount += 1;
  }

  return {
    minimum: finiteCount > 0 ? minimum : Number.NaN,
    maximum: finiteCount > 0 ? maximum : Number.NaN,
    mean: finiteCount > 0 ? sum / finiteCount : Number.NaN,
    finiteCount,
    nonFiniteCount,
  };
}

function validateFieldLength(phase: Float32Array, shape: GridShape): void {
  const expected = shape[0] * shape[1] * shape[2];
  if (phase.length !== expected) {
    throw new RangeError('Field length does not match the configured grid.');
  }
}

function positionFromCoordinates(
  coordinates: readonly [number, number, number],
  config: DerivedSimulationConfiguration,
): Vec3 {
  const spacing = config.grid.spacing;
  return [
    coordinates[0] * spacing - config.domainCenter[0],
    coordinates[1] * spacing - config.domainCenter[1],
    coordinates[2] * spacing - config.domainCenter[2],
  ];
}

export function measureSolidBounds(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
  threshold = config.grid.solidificationThreshold,
): SolidBounds {
  validateFieldLength(phase, config.grid.shape);
  const minimum = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const maximum = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  let voxelCount = 0;

  for (let index = 0; index < phase.length; index += 1) {
    const value = phase[index] ?? Number.NaN;
    if (!Number.isFinite(value) || value > threshold) continue;
    const position = positionFromCoordinates(
      gridCoordinates(index, config.grid.shape),
      config,
    );
    for (const axis of [0, 1, 2] as const) {
      minimum[axis] = Math.min(minimum[axis] ?? Number.NaN, position[axis]);
      maximum[axis] = Math.max(maximum[axis] ?? Number.NaN, position[axis]);
    }
    voxelCount += 1;
  }

  if (voxelCount === 0) {
    return {
      empty: true,
      minimum: [Number.NaN, Number.NaN, Number.NaN],
      maximum: [Number.NaN, Number.NaN, Number.NaN],
      extent: [0, 0, 0],
      voxelCount: 0,
    };
  }

  const minimumVector: Vec3 = [
    minimum[0] ?? Number.NaN,
    minimum[1] ?? Number.NaN,
    minimum[2] ?? Number.NaN,
  ];
  const maximumVector: Vec3 = [
    maximum[0] ?? Number.NaN,
    maximum[1] ?? Number.NaN,
    maximum[2] ?? Number.NaN,
  ];
  return {
    empty: false,
    minimum: minimumVector,
    maximum: maximumVector,
    extent: [
      maximumVector[0] - minimumVector[0],
      maximumVector[1] - minimumVector[1],
      maximumVector[2] - minimumVector[2],
    ],
    voxelCount,
  };
}

function meanMirrorDifference(
  phase: Float32Array,
  shape: GridShape,
  axis: 0 | 1 | 2,
): number {
  let sum = 0;
  let count = 0;
  const axisSize = shape[axis];

  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        const coordinate = [x, y, z] as [number, number, number];
        if (coordinate[axis] >= axisSize / 2) continue;
        const mirrored = [...coordinate] as [number, number, number];
        mirrored[axis] = axisSize - 1 - coordinate[axis];
        sum += Math.abs(
          (phase[gridIndex(...coordinate, shape)] ?? Number.NaN) -
            (phase[gridIndex(...mirrored, shape)] ?? Number.NaN),
        );
        count += 1;
      }
    }
  }

  return count > 0 ? sum / count : 0;
}

export function measureSymmetry(
  phase: Float32Array,
  shape: GridShape,
): SymmetryMetrics {
  validateFieldLength(phase, shape);
  const x = meanMirrorDifference(phase, shape, 0);
  const y = meanMirrorDifference(phase, shape, 1);
  const z = meanMirrorDifference(phase, shape, 2);
  return { x, y, z, maximum: Math.max(x, y, z) };
}

function centerIndices(size: number): readonly number[] {
  const upper = Math.floor(size / 2);
  return size % 2 === 0 ? [upper - 1, upper] : [upper];
}

function faceDepression(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
  threshold: number,
  axis: 0 | 1 | 2,
  direction: -1 | 1,
): FaceDepression {
  const { shape } = config.grid;
  const orthogonalAxes: readonly [0 | 1 | 2, 0 | 1 | 2] =
    axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
  const [firstAxis, secondAxis] = orthogonalAxes;
  const firstCenters = new Set(centerIndices(shape[firstAxis]));
  const secondCenters = new Set(centerIndices(shape[secondAxis]));
  let centerRadius = 0;
  let firstHalfExtent = 0;
  let secondHalfExtent = 0;
  const lineRadii = new Map<
    string,
    { readonly first: number; readonly second: number; radius: number }
  >();

  for (let index = 0; index < phase.length; index += 1) {
    const value = phase[index] ?? Number.NaN;
    if (!Number.isFinite(value) || value > threshold) continue;
    const coordinates = gridCoordinates(index, shape);
    const position = positionFromCoordinates(coordinates, config);
    const signedRadius = direction * position[axis];
    if (signedRadius < 0) continue;
    const firstPosition = position[firstAxis];
    const secondPosition = position[secondAxis];
    firstHalfExtent = Math.max(firstHalfExtent, Math.abs(firstPosition));
    secondHalfExtent = Math.max(secondHalfExtent, Math.abs(secondPosition));
    const key = `${coordinates[firstAxis]},${coordinates[secondAxis]}`;
    const existing = lineRadii.get(key);
    if (!existing || signedRadius > existing.radius) {
      lineRadii.set(key, {
        first: firstPosition,
        second: secondPosition,
        radius: signedRadius,
      });
    }
    if (
      firstCenters.has(coordinates[firstAxis]) &&
      secondCenters.has(coordinates[secondAxis])
    ) {
      centerRadius = Math.max(centerRadius, signedRadius);
    }
  }

  const rimRadii = [...lineRadii.values()]
    .filter(({ first, second }) => {
      const normalizedFirst =
        firstHalfExtent > 0 ? Math.abs(first) / firstHalfExtent : 0;
      const normalizedSecond =
        secondHalfExtent > 0 ? Math.abs(second) / secondHalfExtent : 0;
      return Math.max(normalizedFirst, normalizedSecond) >= 0.4;
    })
    .map(({ radius }) => radius)
    .sort((left, right) => left - right);
  // A face rim is a distributed feature, not one off-axis voxel. The upper
  // quartile is robust to both a few lagging lines and isolated leading spurs.
  const outerRadius =
    rimRadii.length >= 8
      ? (rimRadii[Math.floor((rimRadii.length - 1) * 0.75)] ?? centerRadius)
      : centerRadius;

  const axisName = (['x', 'y', 'z'] as const)[axis];
  return {
    axis: axisName,
    direction,
    outerRadius,
    centerRadius,
    depth: Math.max(0, outerRadius - centerRadius),
  };
}

export function measureFaceCenterDepression(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
  threshold = config.grid.solidificationThreshold,
): FaceCenterDepressionMetrics {
  validateFieldLength(phase, config.grid.shape);
  const faces: readonly FaceDepression[] = [
    faceDepression(phase, config, threshold, 0, -1),
    faceDepression(phase, config, threshold, 0, 1),
    faceDepression(phase, config, threshold, 1, -1),
    faceDepression(phase, config, threshold, 1, 1),
    faceDepression(phase, config, threshold, 2, -1),
    faceDepression(phase, config, threshold, 2, 1),
  ];
  const depths = faces.map((face) => face.depth);

  return {
    faces,
    meanDepth: depths.reduce((sum, depth) => sum + depth, 0) / depths.length,
    minimumDepth: Math.min(...depths),
    maximumDepth: Math.max(...depths),
  };
}

export function measureMorphology(
  state: CpuSimulationState,
): MorphologyMetrics {
  const voxelVolume = state.config.grid.spacing ** 3;
  let solidVolume = 0;
  for (const phi of state.phase) {
    solidVolume += (1 - phi) * voxelVolume;
  }

  return {
    phase: summarizeField(state.phase),
    chemicalPotential: summarizeField(state.chemicalPotential),
    solidificationTime: summarizeField(state.solidificationTime),
    solidVolume,
    bounds: measureSolidBounds(state.phase, state.config),
    symmetry: measureSymmetry(state.phase, state.config.grid.shape),
    faceCenterDepression: measureFaceCenterDepression(
      state.phase,
      state.config,
    ),
  };
}
