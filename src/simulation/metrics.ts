import type { DerivedSimulationConfiguration, GridShape, Vec3 } from './config';
import type { SimulationPresetName } from './config';
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

export interface DirectionalReachMetrics {
  /** Axis-equivalent reach along the six <100> center rays. */
  readonly face: readonly number[];
  /** Axis-equivalent reach along the twelve <110> center rays. */
  readonly edge: readonly number[];
  /** Axis-equivalent reach along the eight <111> center rays. */
  readonly bodyDiagonal: readonly number[];
  readonly meanFace: number;
  readonly meanEdge: number;
  readonly meanBodyDiagonal: number;
  readonly bodyDiagonalToFaceRatio: number;
  readonly occupiedBodyDiagonalArms: number;
}

export interface TransitionMorphologyMetrics {
  readonly boundingBoxFillFraction: number;
  readonly surfaceVoxelCount: number;
  /** Surface-voxel count divided by thresholded solid-voxel count. */
  readonly surfaceToVolumeRatio: number;
  /** Surface-voxel count divided by volume^(2/3); about 6 for a large cube. */
  readonly surfaceComplexity: number;
  readonly directionalReach: DirectionalReachMetrics;
  readonly connectedComponentCount: number;
  readonly largestConnectedComponentFraction: number;
}

export interface MorphologyExpectation {
  readonly expected: SimulationPresetName;
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export interface GrowthMaturityMetrics {
  readonly directionalReach: DirectionalReachMetrics;
  readonly maximumDirectionalReach: number;
  readonly radiusMultiple: number;
  readonly farBoundaryDistance: number;
  readonly farBoundaryClearance: number;
  readonly farBoundaryClearanceRatio: number;
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
  if (config.domainMode === 'octant') {
    return {
      empty: false,
      minimum: [-maximumVector[0], -maximumVector[1], -maximumVector[2]],
      maximum: maximumVector,
      extent: [
        2 * maximumVector[0],
        2 * maximumVector[1],
        2 * maximumVector[2],
      ],
      voxelCount,
    };
  }
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
  domainMode: DerivedSimulationConfiguration['domainMode'] = 'full',
): SymmetryMetrics {
  validateFieldLength(phase, shape);
  if (domainMode === 'octant') {
    return { x: 0, y: 0, z: 0, maximum: 0 };
  }
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
  const firstCenters = new Set(
    config.domainMode === 'octant' ? [0] : centerIndices(shape[firstAxis]),
  );
  const secondCenters = new Set(
    config.domainMode === 'octant' ? [0] : centerIndices(shape[secondAxis]),
  );
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
    const signedRadius =
      config.domainMode === 'octant'
        ? position[axis]
        : direction * position[axis];
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

const FACE_DIRECTIONS = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
] as const;

const EDGE_DIRECTIONS = [
  [-1, -1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [1, 1, 0],
  [-1, 0, -1],
  [-1, 0, 1],
  [1, 0, -1],
  [1, 0, 1],
  [0, -1, -1],
  [0, -1, 1],
  [0, 1, -1],
  [0, 1, 1],
] as const;

const BODY_DIAGONAL_DIRECTIONS = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
] as const;

function mean(values: readonly number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function centeredRayReach(
  phase: Float32Array,
  shape: GridShape,
  spacing: number,
  threshold: number,
  direction: readonly [-1 | 0 | 1, -1 | 0 | 1, -1 | 0 | 1],
  octant: boolean,
): number {
  const sampledDirection = octant
    ? (direction.map((component) => Math.abs(component)) as [
        0 | 1,
        0 | 1,
        0 | 1,
      ])
    : direction;
  const stationaryAxes = ([0, 1, 2] as const).filter(
    (axis) => sampledDirection[axis] === 0,
  );
  const stationaryCombinations = octant ? 1 : 1 << stationaryAxes.length;
  let maximumReach = 0;

  for (
    let combination = 0;
    combination < stationaryCombinations;
    combination += 1
  ) {
    const start = [0, 0, 0] as [number, number, number];
    for (const axis of [0, 1, 2] as const) {
      const lowerCenter = Math.floor((shape[axis] - 1) / 2);
      const upperCenter = Math.ceil((shape[axis] - 1) / 2);
      if (octant) {
        start[axis] = 0;
      } else if (sampledDirection[axis] < 0) {
        start[axis] = lowerCenter;
      } else if (sampledDirection[axis] > 0) {
        start[axis] = upperCenter;
      } else {
        const bit = stationaryAxes.indexOf(axis);
        start[axis] =
          bit >= 0 && (combination & (1 << bit)) !== 0
            ? upperCenter
            : lowerCenter;
      }
    }

    for (let step = 0; ; step += 1) {
      const coordinate = start.map(
        (value, axis) => value + (sampledDirection[axis] ?? 0) * step,
      ) as [number, number, number];
      if (
        coordinate.some(
          (value, axis) => value < 0 || value >= (shape[axis] ?? 0),
        )
      ) {
        break;
      }
      if ((phase[gridIndex(...coordinate, shape)] ?? Number.NaN) <= threshold) {
        // Even grids place the origin halfway between the two central cells.
        const centerOffset =
          !octant && shape.some((size) => size % 2 === 0) ? 0.5 : 0;
        maximumReach = Math.max(maximumReach, (step + centerOffset) * spacing);
      }
    }
  }

  return maximumReach;
}

export function measureDirectionalReach(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
  threshold: number,
): DirectionalReachMetrics {
  const reach = (direction: readonly [-1 | 0 | 1, -1 | 0 | 1, -1 | 0 | 1]) =>
    centeredRayReach(
      phase,
      config.grid.shape,
      config.grid.spacing,
      threshold,
      direction,
      config.domainMode === 'octant',
    );
  const face = FACE_DIRECTIONS.map(reach);
  const edge = EDGE_DIRECTIONS.map(reach);
  const bodyDiagonal = BODY_DIAGONAL_DIRECTIONS.map(reach);
  const meanFace = mean(face);
  const meanBodyDiagonal = mean(bodyDiagonal);
  const maximumBodyDiagonal = Math.max(...bodyDiagonal);
  const occupiedBodyDiagonalArms = bodyDiagonal.filter(
    (value) =>
      value >= config.parameters.initialRadius &&
      value >= 0.8 * maximumBodyDiagonal,
  ).length;

  return {
    face,
    edge,
    bodyDiagonal,
    meanFace,
    meanEdge: mean(edge),
    meanBodyDiagonal,
    bodyDiagonalToFaceRatio:
      meanFace > 0 ? meanBodyDiagonal / meanFace : Number.POSITIVE_INFINITY,
    occupiedBodyDiagonalArms,
  };
}

export function measureGrowthMaturity(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
  threshold = config.grid.solidificationThreshold,
): GrowthMaturityMetrics {
  validateFieldLength(phase, config.grid.shape);
  const directionalReach = measureDirectionalReach(phase, config, threshold);
  const maximumDirectionalReach = Math.max(
    directionalReach.meanFace,
    directionalReach.meanEdge,
    directionalReach.meanBodyDiagonal,
  );
  const farBoundaryDistance = Math.min(
    ...config.domainMaximum.map((maximum, axis) =>
      config.domainMode === 'octant'
        ? maximum
        : Math.min(maximum, Math.abs(config.domainMinimum[axis] ?? Number.NaN)),
    ),
  );
  const farBoundaryClearance = farBoundaryDistance - maximumDirectionalReach;

  return {
    directionalReach,
    maximumDirectionalReach,
    radiusMultiple: maximumDirectionalReach / config.parameters.initialRadius,
    farBoundaryDistance,
    farBoundaryClearance,
    farBoundaryClearanceRatio:
      maximumDirectionalReach > 0
        ? farBoundaryClearance / maximumDirectionalReach
        : Number.POSITIVE_INFINITY,
  };
}

export function measureTransitionMorphology(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
  threshold = config.grid.solidificationThreshold,
): TransitionMorphologyMetrics {
  validateFieldLength(phase, config.grid.shape);
  const bounds = measureSolidBounds(phase, config, threshold);
  const occupancy = new Uint8Array(phase.length);
  let surfaceVoxelCount = 0;
  const [width, height, depth] = config.grid.shape;

  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = gridIndex(x, y, z, config.grid.shape);
        if ((phase[index] ?? Number.NaN) > threshold) continue;
        occupancy[index] = 1;
        const surface =
          (config.domainMode === 'full' && x === 0) ||
          x === width - 1 ||
          (config.domainMode === 'full' && y === 0) ||
          y === height - 1 ||
          (config.domainMode === 'full' && z === 0) ||
          z === depth - 1 ||
          (x > 0 &&
            (phase[gridIndex(x - 1, y, z, config.grid.shape)] ?? Number.NaN) >
              threshold) ||
          (phase[gridIndex(x + 1, y, z, config.grid.shape)] ?? Number.NaN) >
            threshold ||
          (y > 0 &&
            (phase[gridIndex(x, y - 1, z, config.grid.shape)] ?? Number.NaN) >
              threshold) ||
          (phase[gridIndex(x, y + 1, z, config.grid.shape)] ?? Number.NaN) >
            threshold ||
          (z > 0 &&
            (phase[gridIndex(x, y, z - 1, config.grid.shape)] ?? Number.NaN) >
              threshold) ||
          (phase[gridIndex(x, y, z + 1, config.grid.shape)] ?? Number.NaN) >
            threshold;
        if (surface) surfaceVoxelCount += 1;
      }
    }
  }

  const queue = new Uint32Array(bounds.voxelCount);
  let connectedComponentCount = 0;
  let largestConnectedComponent = 0;
  const plane = width * height;
  for (let seed = 0; seed < occupancy.length; seed += 1) {
    if (occupancy[seed] !== 1) continue;
    connectedComponentCount += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    occupancy[seed] = 2;

    while (head < tail) {
      const index = queue[head++] ?? 0;
      const z = Math.floor(index / plane);
      const remainder = index - z * plane;
      const y = Math.floor(remainder / width);
      const x = remainder - y * width;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
        z > 0 ? index - plane : -1,
        z + 1 < depth ? index + plane : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || occupancy[neighbor] !== 1) continue;
        occupancy[neighbor] = 2;
        queue[tail++] = neighbor;
      }
    }
    largestConnectedComponent = Math.max(largestConnectedComponent, tail);
  }

  const boundingVoxelCount = bounds.empty
    ? 0
    : bounds.extent.reduce(
        (product, extent) =>
          product *
          (Math.round(
            extent /
              config.grid.spacing /
              (config.domainMode === 'octant' ? 2 : 1),
          ) +
            1),
        1,
      );
  const solidVoxelCount = bounds.voxelCount;

  return {
    boundingBoxFillFraction:
      boundingVoxelCount > 0 ? solidVoxelCount / boundingVoxelCount : 0,
    surfaceVoxelCount,
    surfaceToVolumeRatio:
      solidVoxelCount > 0 ? surfaceVoxelCount / solidVoxelCount : 0,
    surfaceComplexity:
      solidVoxelCount > 0
        ? (surfaceVoxelCount / solidVoxelCount ** (2 / 3)) *
          (config.domainMode === 'octant' ? 2 : 1)
        : 0,
    directionalReach: measureDirectionalReach(phase, config, threshold),
    connectedComponentCount,
    largestConnectedComponentFraction:
      solidVoxelCount > 0 ? largestConnectedComponent / solidVoxelCount : 0,
  };
}

export function evaluateExpectedMorphology(
  expected: SimulationPresetName,
  transition: TransitionMorphologyMetrics,
  depression: FaceCenterDepressionMetrics,
  config: DerivedSimulationConfiguration,
): MorphologyExpectation {
  const failures: string[] = [];
  const require = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };
  const resolvedDepth = 3 * config.grid.spacing;

  require(transition.largestConnectedComponentFraction >=
    0.98, 'largest connected component must contain at least 98% of solid voxels');

  if (expected === 'cube') {
    require(transition.boundingBoxFillFraction >=
      0.9, 'cube bounding-box fill must be at least 0.9');
    require(depression.meanDepth <
      resolvedDepth, 'cube must not have a three-cell mean face recession');
  } else if (expected === 'hopper') {
    require(transition.boundingBoxFillFraction <
      0.9, 'hopper bounding-box fill must be below 0.9');
    require(depression.meanDepth >=
      resolvedDepth, 'hopper mean face recession must span at least three cells');
    require(depression.faces.filter((face) => face.depth >= resolvedDepth)
      .length >=
      4, 'hopper must have resolved recession on at least four faces');
  } else if (expected === 'fractal') {
    require(transition.boundingBoxFillFraction <
      0.8, 'fractal bounding-box fill must be below 0.8');
    require(transition.surfaceComplexity >=
      8, 'fractal surface complexity must be at least 8');
    require(transition.directionalReach.occupiedBodyDiagonalArms >=
      6, 'fractal must occupy at least six <111> arms');
  } else {
    require(transition.boundingBoxFillFraction <
      0.65, 'dendritic bounding-box fill must be below 0.65');
    require(transition.directionalReach.bodyDiagonalToFaceRatio >=
      1.15, 'dendritic <111>/<100> reach ratio must be at least 1.15');
    require(transition.directionalReach.occupiedBodyDiagonalArms >=
      6, 'dendritic morphology must occupy at least six <111> arms');
  }

  return { expected, passed: failures.length === 0, failures };
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
    symmetry: measureSymmetry(
      state.phase,
      state.config.grid.shape,
      state.config.domainMode,
    ),
    faceCenterDepression: measureFaceCenterDepression(
      state.phase,
      state.config,
    ),
  };
}
