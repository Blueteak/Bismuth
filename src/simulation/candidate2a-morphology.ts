import {
  KARMA_RAPPEL_IVF_CONSTANTS,
  candidate2ADiffuseSolidVolume,
  thinInterfaceCapillaryLength,
  type Candidate2AThermalConfiguration,
  type Candidate2AThermalState,
} from './candidate2a';

export const CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS = Object.freeze({
  total: 1600,
  checkpointInterval: 100,
  midpoint: 800,
  late: 1200,
});

export const CANDIDATE2A_MORPHOLOGY_SCREEN_CHECKPOINTS = Object.freeze(
  Array.from(
    {
      length:
        CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total /
          CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.checkpointInterval +
        1,
    },
    (_, index) =>
      index * CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.checkpointInterval,
  ),
);

export const CANDIDATE2A_MORPHOLOGY_SCREEN_THRESHOLDS = Object.freeze({
  maximumAbsoluteOrderParameter: 1.05,
  minimumMainComponentFraction: 0.999,
  maximumSecondaryComponentVoxels: 7,
  minimumFarBoundaryClearanceInInterfaceWidths: 2,
  minimumMidpointMaturity: 1.05,
  minimumFinalMaturity: 1.1,
  minimumOpeningDepthInInterfaceWidths: 1,
  minimumNormalizedOpeningDepth: 0.15,
  minimumLateNormalizedOpeningDepthIncrease: 0.03,
  minimumDominantRecessedFraction: 0.75,
  minimumOpeningProjectedFill: 0.05,
  maximumOpeningProjectedFill: 0.3,
  minimumProjectedConvexFill: 0.85,
});

const SCREEN_INTERFACE_WIDTH = 1.5;
const SCREEN_COUPLING_LAMBDA = 0.3;
const SCREEN_UNDERCOOLING = 1.4;

export const CANDIDATE2A_MORPHOLOGY_CRITICAL_WULFF_SCALE =
  (2 *
    thinInterfaceCapillaryLength(
      SCREEN_INTERFACE_WIDTH,
      SCREEN_COUPLING_LAMBDA,
    )) /
  SCREEN_UNDERCOOLING;

export const CANDIDATE2A_MORPHOLOGY_SEED_RADIUS =
  1.5 * CANDIDATE2A_MORPHOLOGY_CRITICAL_WULFF_SCALE;

export function createCandidate2AMorphologyScreenConfiguration(): Candidate2AThermalConfiguration {
  return {
    shape: [41, 25, 41],
    spacing: 0.75,
    timeStep: 0.005,
    thermalDiffusivity: 1,
    undercooling: SCREEN_UNDERCOOLING,
    interfaceWidth: SCREEN_INTERFACE_WIDTH,
    couplingLambda: SCREEN_COUPLING_LAMBDA,
    orientation: { x: -Math.PI / 2, y: 0, z: 0 },
    initialCondition: {
      kind: 'surface-attached-seed',
      center: [15, 0, 15],
      radius: CANDIDATE2A_MORPHOLOGY_SEED_RADIUS,
    },
    freeSurface: {
      enabled: true,
      biotNumber: 1,
      ambientTemperature: -1.5,
    },
  };
}

export type Candidate2AMorphologyClassification =
  | 'invalid'
  | 'disconnected'
  | 'boundary-limited'
  | 'immature'
  | 'non-hopper'
  | 'screen-pass';

export interface Candidate2AMorphologyMetrics {
  readonly step: number;
  readonly finite: boolean;
  readonly maximumAbsoluteOrderParameter: number;
  readonly solidVoxelCount: number;
  readonly mainComponentVoxelCount: number;
  readonly mainComponentFraction: number;
  readonly secondLargestComponentVoxelCount: number;
  readonly seedBelongsToMainComponent: boolean;
  readonly attachedToFreeSurface: boolean;
  /** Physical clearance to x=0/x=max/y=max/z=0/z=max; y=0 is excluded. */
  readonly fiveFaceClearance: number;
  /** Cube root of diffuse-solid volume relative to the supplied initial state. */
  readonly diffuseMaturity: number;
  readonly projectedVoxelCount: number;
  readonly projectedArea: number;
  readonly projectedEquivalentRadius: number;
  readonly rimHeight: number;
  readonly coreHeight: number;
  readonly openingDepth: number;
  readonly normalizedOpeningDepth: number;
  readonly recessedProjectedVoxelCount: number;
  readonly dominantRecessedVoxelCount: number;
  readonly dominantRecessedFraction: number;
  readonly openingProjectedFill: number;
  readonly projectedConvexFill: number;
}

export interface Candidate2AMorphologyMetricSet {
  readonly initial: Candidate2AMorphologyMetrics;
  readonly midpoint: Candidate2AMorphologyMetrics;
  readonly late: Candidate2AMorphologyMetrics;
  readonly final: Candidate2AMorphologyMetrics;
}

export interface Candidate2AMorphologyScreenStates {
  readonly initial: Candidate2AThermalState;
  readonly midpoint: Candidate2AThermalState;
  readonly late: Candidate2AThermalState;
  readonly final: Candidate2AThermalState;
}

export interface Candidate2AMorphologyScreenResult {
  readonly classification: Candidate2AMorphologyClassification;
  readonly metrics: Candidate2AMorphologyMetricSet;
}

type Point2 = readonly [number, number];

function linearIndex(
  x: number,
  y: number,
  z: number,
  shape: readonly [number, number, number],
): number {
  return x + shape[0] * (y + shape[1] * z);
}

function decodeIndex(
  index: number,
  shape: readonly [number, number, number],
): readonly [number, number, number] {
  const x = index % shape[0];
  const yz = (index - x) / shape[0];
  const y = yz % shape[1];
  return [x, y, (yz - y) / shape[1]];
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const position = fraction * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return (
    (sorted[lower] ?? Number.NaN) * (1 - weight) +
    (sorted[upper] ?? Number.NaN) * weight
  );
}

function cross(origin: Point2, left: Point2, right: Point2): number {
  return (
    (left[0] - origin[0]) * (right[1] - origin[1]) -
    (left[1] - origin[1]) * (right[0] - origin[0])
  );
}

function monotonicChain(points: readonly Point2[]): Point2[] {
  const sorted = [...points].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1],
  );
  if (sorted.length <= 1) return sorted;

  const lower: Point2[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Point2[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function polygonArea(points: readonly Point2[]): number {
  if (points.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    twiceArea += current[0] * next[1] - current[1] * next[0];
  }
  return Math.abs(twiceArea) / 2;
}

/**
 * Area of the convex hull of projected voxel squares. The monotonic chain is
 * built over voxel centers, then expanded by the axis-aligned half-cell square.
 */
function projectedConvexArea(
  points: readonly Point2[],
  spacing: number,
): number {
  if (points.length === 0) return 0;
  const hull = monotonicChain(points);
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;
  for (const point of hull) {
    minimumX = Math.min(minimumX, point[0]);
    maximumX = Math.max(maximumX, point[0]);
    minimumZ = Math.min(minimumZ, point[1]);
    maximumZ = Math.max(maximumZ, point[1]);
  }
  return (
    polygonArea(hull) +
    spacing * (maximumX - minimumX + maximumZ - minimumZ) +
    spacing ** 2
  );
}

interface SolidComponents {
  readonly labels: Int32Array;
  readonly sizes: readonly number[];
  readonly mainLabel: number;
  readonly seedBelongsToMainComponent: boolean;
}

function labelSolidComponents(
  solid: Uint8Array,
  state: Candidate2AThermalState,
): SolidComponents {
  const { shape, spacing, initialCondition } = state.config;
  const labels = new Int32Array(solid.length);
  labels.fill(-1);
  const queue = new Int32Array(solid.length);
  const sizes: number[] = [];
  let label = 0;

  for (let start = 0; start < solid.length; start += 1) {
    if (solid[start] === 0 || labels[start] !== -1) continue;
    let head = 0;
    let tail = 1;
    let size = 0;
    queue[0] = start;
    labels[start] = label;
    while (head < tail) {
      const index = queue[head++]!;
      size += 1;
      const [x, y, z] = decodeIndex(index, shape);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < shape[0] ? index + 1 : -1,
        y > 0 ? index - shape[0] : -1,
        y + 1 < shape[1] ? index + shape[0] : -1,
        z > 0 ? index - shape[0] * shape[1] : -1,
        z + 1 < shape[2] ? index + shape[0] * shape[1] : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && solid[neighbor] !== 0 && labels[neighbor] === -1) {
          labels[neighbor] = label;
          queue[tail++] = neighbor;
        }
      }
    }
    sizes.push(size);
    label += 1;
  }

  let largestLabel = -1;
  let largestSize = 0;
  for (let index = 0; index < sizes.length; index += 1) {
    if ((sizes[index] ?? 0) > largestSize) {
      largestSize = sizes[index] ?? 0;
      largestLabel = index;
    }
  }

  let seedLabel = -1;
  if (initialCondition.kind === 'surface-attached-seed') {
    const seedX = Math.round(initialCondition.center[0] / spacing);
    const seedZ = Math.round(initialCondition.center[2] / spacing);
    if (seedX >= 0 && seedX < shape[0] && seedZ >= 0 && seedZ < shape[2]) {
      seedLabel = labels[linearIndex(seedX, 0, seedZ, shape)] ?? -1;
    }
  }
  const mainLabel = seedLabel >= 0 ? seedLabel : largestLabel;
  return {
    labels,
    sizes,
    mainLabel,
    seedBelongsToMainComponent: seedLabel >= 0 && seedLabel === mainLabel,
  };
}

interface RecessedComponents {
  readonly dominantSize: number;
  readonly totalSize: number;
}

function measureRecessedComponents(
  recessed: Uint8Array,
  width: number,
  depth: number,
): RecessedComponents {
  const visited = new Uint8Array(recessed.length);
  const queue = new Int32Array(recessed.length);
  let dominantSize = 0;
  let totalSize = 0;
  for (let start = 0; start < recessed.length; start += 1) {
    if (recessed[start] === 0 || visited[start] !== 0) continue;
    let head = 0;
    let tail = 1;
    let size = 0;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++]!;
      size += 1;
      const x = index % width;
      const z = (index - x) / width;
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dz === 0) continue;
          const nextX = x + dx;
          const nextZ = z + dz;
          if (nextX < 0 || nextX >= width || nextZ < 0 || nextZ >= depth) {
            continue;
          }
          const neighbor = nextX + width * nextZ;
          if (recessed[neighbor] !== 0 && visited[neighbor] === 0) {
            visited[neighbor] = 1;
            queue[tail++] = neighbor;
          }
        }
      }
    }
    totalSize += size;
    dominantSize = Math.max(dominantSize, size);
  }
  return { dominantSize, totalSize };
}

function invalidMetrics(
  state: Candidate2AThermalState,
): Candidate2AMorphologyMetrics {
  return {
    step: state.step,
    finite: false,
    maximumAbsoluteOrderParameter: Number.POSITIVE_INFINITY,
    solidVoxelCount: 0,
    mainComponentVoxelCount: 0,
    mainComponentFraction: 0,
    secondLargestComponentVoxelCount: 0,
    seedBelongsToMainComponent: false,
    attachedToFreeSurface: false,
    fiveFaceClearance: 0,
    diffuseMaturity: 0,
    projectedVoxelCount: 0,
    projectedArea: 0,
    projectedEquivalentRadius: 0,
    rimHeight: Number.NaN,
    coreHeight: Number.NaN,
    openingDepth: 0,
    normalizedOpeningDepth: 0,
    recessedProjectedVoxelCount: 0,
    dominantRecessedVoxelCount: 0,
    dominantRecessedFraction: 0,
    openingProjectedFill: 0,
    projectedConvexFill: 0,
  };
}

export function measureCandidate2AMorphology(
  state: Candidate2AThermalState,
  initial: Candidate2AThermalState,
): Candidate2AMorphologyMetrics {
  const { shape, spacing, voxelCount } = state.config;
  if (
    state.orderParameter.length !== voxelCount ||
    state.temperature.length !== voxelCount ||
    initial.orderParameter.length !== initial.config.voxelCount ||
    initial.temperature.length !== initial.config.voxelCount ||
    shape.some((size, axis) => size !== initial.config.shape[axis]) ||
    spacing !== initial.config.spacing
  ) {
    return invalidMetrics(state);
  }

  const solid = new Uint8Array(voxelCount);
  let finite = true;
  let maximumAbsoluteOrderParameter = 0;
  let solidVoxelCount = 0;
  let fiveFaceClearance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < voxelCount; index += 1) {
    const value = state.orderParameter[index] ?? Number.NaN;
    const temperature = state.temperature[index] ?? Number.NaN;
    if (!Number.isFinite(value) || !Number.isFinite(temperature))
      finite = false;
    maximumAbsoluteOrderParameter = Math.max(
      maximumAbsoluteOrderParameter,
      Math.abs(value),
    );
    if (!(value >= 0)) continue;
    solid[index] = 1;
    solidVoxelCount += 1;
    const [x, y, z] = decodeIndex(index, shape);
    fiveFaceClearance = Math.min(
      fiveFaceClearance,
      x * spacing,
      (shape[0] - 1 - x) * spacing,
      (shape[1] - 1 - y) * spacing,
      z * spacing,
      (shape[2] - 1 - z) * spacing,
    );
  }
  if (!finite) return invalidMetrics(state);
  if (solidVoxelCount === 0) fiveFaceClearance = 0;

  const components = labelSolidComponents(solid, state);
  const mainComponentVoxelCount =
    components.mainLabel >= 0
      ? (components.sizes[components.mainLabel] ?? 0)
      : 0;
  let secondLargestComponentVoxelCount = 0;
  for (let label = 0; label < components.sizes.length; label += 1) {
    if (label === components.mainLabel) continue;
    secondLargestComponentVoxelCount = Math.max(
      secondLargestComponentVoxelCount,
      components.sizes[label] ?? 0,
    );
  }

  let attachedToFreeSurface = false;
  const projectedHeights = new Float64Array(shape[0] * shape[2]);
  projectedHeights.fill(Number.NaN);
  const projectedPoints: Point2[] = [];
  for (let z = 0; z < shape[2]; z += 1) {
    for (let x = 0; x < shape[0]; x += 1) {
      let top = -1;
      for (let y = 0; y < shape[1]; y += 1) {
        const index = linearIndex(x, y, z, shape);
        if (components.labels[index] !== components.mainLabel) continue;
        if (y === 0) attachedToFreeSurface = true;
        top = y;
      }
      if (top < 0) continue;
      const projectionIndex = x + shape[0] * z;
      let height = top * spacing;
      if (top + 1 < shape[1]) {
        const inside =
          state.orderParameter[linearIndex(x, top, z, shape)] ?? Number.NaN;
        const outside =
          state.orderParameter[linearIndex(x, top + 1, z, shape)] ?? Number.NaN;
        if (inside >= 0 && outside < 0 && inside !== outside) {
          height = (top + inside / (inside - outside)) * spacing;
        }
      }
      projectedHeights[projectionIndex] = height;
      projectedPoints.push([x * spacing, z * spacing]);
    }
  }

  const projectedVoxelCount = projectedPoints.length;
  const projectedArea = projectedVoxelCount * spacing ** 2;
  const projectedEquivalentRadius = Math.sqrt(projectedArea / Math.PI);
  let centroidX = 0;
  let centroidZ = 0;
  for (const point of projectedPoints) {
    centroidX += point[0];
    centroidZ += point[1];
  }
  if (projectedVoxelCount > 0) {
    centroidX /= projectedVoxelCount;
    centroidZ /= projectedVoxelCount;
  }

  const rimHeights: number[] = [];
  const coreHeights: number[] = [];
  for (let z = 0; z < shape[2]; z += 1) {
    for (let x = 0; x < shape[0]; x += 1) {
      const height = projectedHeights[x + shape[0] * z] ?? Number.NaN;
      if (!Number.isFinite(height) || !(projectedEquivalentRadius > 0)) {
        continue;
      }
      const rho =
        Math.hypot(x * spacing - centroidX, z * spacing - centroidZ) /
        projectedEquivalentRadius;
      if (rho >= 0.5 && rho <= 0.8) rimHeights.push(height);
      if (rho <= 0.3) coreHeights.push(height);
    }
  }
  const rimHeight = percentile(rimHeights, 0.75);
  const coreHeight = percentile(coreHeights, 0.5);
  const openingDepth =
    Number.isFinite(rimHeight) && Number.isFinite(coreHeight)
      ? Math.max(0, rimHeight - coreHeight)
      : 0;
  const normalizedOpeningDepth =
    projectedEquivalentRadius > 0
      ? openingDepth / projectedEquivalentRadius
      : 0;

  const recessed = new Uint8Array(shape[0] * shape[2]);
  if (Number.isFinite(rimHeight) && projectedEquivalentRadius > 0) {
    for (let z = 0; z < shape[2]; z += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        const projectionIndex = x + shape[0] * z;
        const height = projectedHeights[projectionIndex] ?? Number.NaN;
        const rho =
          Math.hypot(x * spacing - centroidX, z * spacing - centroidZ) /
          projectedEquivalentRadius;
        if (
          Number.isFinite(height) &&
          rho <= 0.45 &&
          height <= rimHeight - state.config.interfaceWidth
        ) {
          recessed[projectionIndex] = 1;
        }
      }
    }
  }
  const recessedComponents = measureRecessedComponents(
    recessed,
    shape[0],
    shape[2],
  );
  const convexArea = projectedConvexArea(projectedPoints, spacing);
  const initialVolume = candidate2ADiffuseSolidVolume(initial);
  const currentVolume = candidate2ADiffuseSolidVolume(state);

  return {
    step: state.step,
    finite,
    maximumAbsoluteOrderParameter,
    solidVoxelCount,
    mainComponentVoxelCount,
    mainComponentFraction:
      solidVoxelCount > 0 ? mainComponentVoxelCount / solidVoxelCount : 0,
    secondLargestComponentVoxelCount,
    seedBelongsToMainComponent: components.seedBelongsToMainComponent,
    attachedToFreeSurface,
    fiveFaceClearance,
    diffuseMaturity:
      initialVolume > 0 ? Math.cbrt(currentVolume / initialVolume) : 0,
    projectedVoxelCount,
    projectedArea,
    projectedEquivalentRadius,
    rimHeight,
    coreHeight,
    openingDepth,
    normalizedOpeningDepth,
    recessedProjectedVoxelCount: recessedComponents.totalSize,
    dominantRecessedVoxelCount: recessedComponents.dominantSize,
    dominantRecessedFraction:
      recessedComponents.totalSize > 0
        ? recessedComponents.dominantSize / recessedComponents.totalSize
        : 0,
    openingProjectedFill:
      projectedVoxelCount > 0
        ? recessedComponents.dominantSize / projectedVoxelCount
        : 0,
    projectedConvexFill:
      convexArea > 0 ? Math.min(1, projectedArea / convexArea) : 0,
  };
}

function disconnected(metrics: Candidate2AMorphologyMetrics): boolean {
  const thresholds = CANDIDATE2A_MORPHOLOGY_SCREEN_THRESHOLDS;
  return (
    metrics.solidVoxelCount === 0 ||
    metrics.mainComponentFraction < thresholds.minimumMainComponentFraction ||
    metrics.secondLargestComponentVoxelCount >
      thresholds.maximumSecondaryComponentVoxels ||
    !metrics.seedBelongsToMainComponent ||
    !metrics.attachedToFreeSurface
  );
}

export function classifyCandidate2AMorphologyMetrics(
  metrics: Candidate2AMorphologyMetricSet,
): Candidate2AMorphologyClassification {
  const thresholds = CANDIDATE2A_MORPHOLOGY_SCREEN_THRESHOLDS;
  const orderedMetrics = [
    metrics.initial,
    metrics.midpoint,
    metrics.late,
    metrics.final,
  ];
  const expectedSteps = [
    0,
    CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.midpoint,
    CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.late,
    CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total,
  ];
  if (
    orderedMetrics.some(
      (metric, index) =>
        !metric.finite ||
        metric.maximumAbsoluteOrderParameter >
          thresholds.maximumAbsoluteOrderParameter ||
        metric.step !== expectedSteps[index],
    )
  ) {
    return 'invalid';
  }

  const evolvedMetrics = [metrics.midpoint, metrics.late, metrics.final];
  if (evolvedMetrics.some(disconnected)) return 'disconnected';

  const minimumClearance =
    thresholds.minimumFarBoundaryClearanceInInterfaceWidths *
    SCREEN_INTERFACE_WIDTH;
  if (
    evolvedMetrics.some(
      (metric) => metric.fiveFaceClearance + 1e-12 < minimumClearance,
    )
  ) {
    return 'boundary-limited';
  }

  if (
    metrics.midpoint.diffuseMaturity < thresholds.minimumMidpointMaturity ||
    metrics.final.diffuseMaturity < thresholds.minimumFinalMaturity
  ) {
    return 'immature';
  }

  const final = metrics.final;
  if (
    final.openingDepth <
      thresholds.minimumOpeningDepthInInterfaceWidths *
        SCREEN_INTERFACE_WIDTH ||
    final.normalizedOpeningDepth < thresholds.minimumNormalizedOpeningDepth ||
    final.normalizedOpeningDepth - metrics.late.normalizedOpeningDepth <
      thresholds.minimumLateNormalizedOpeningDepthIncrease ||
    final.dominantRecessedFraction <
      thresholds.minimumDominantRecessedFraction ||
    final.openingProjectedFill < thresholds.minimumOpeningProjectedFill ||
    final.openingProjectedFill > thresholds.maximumOpeningProjectedFill ||
    final.projectedConvexFill < thresholds.minimumProjectedConvexFill
  ) {
    return 'non-hopper';
  }
  return 'screen-pass';
}

export function classifyCandidate2AMorphologyScreen(
  states: Candidate2AMorphologyScreenStates,
): Candidate2AMorphologyScreenResult {
  const metrics: Candidate2AMorphologyMetricSet = {
    initial: measureCandidate2AMorphology(states.initial, states.initial),
    midpoint: measureCandidate2AMorphology(states.midpoint, states.initial),
    late: measureCandidate2AMorphology(states.late, states.initial),
    final: measureCandidate2AMorphology(states.final, states.initial),
  };
  return {
    classification: classifyCandidate2AMorphologyMetrics(metrics),
    metrics,
  };
}

/** Exact reference value kept visible for configuration/evidence reporting. */
export const CANDIDATE2A_MORPHOLOGY_REFERENCE_CAPILLARY_LENGTH =
  (KARMA_RAPPEL_IVF_CONSTANTS.a1 * SCREEN_INTERFACE_WIDTH) /
  SCREEN_COUPLING_LAMBDA;
