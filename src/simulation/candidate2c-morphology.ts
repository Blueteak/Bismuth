import {
  candidate2CFacetedLoopPolygon,
  type Candidate2CFacetedFrame,
  type Candidate2CFacetedVec2,
} from './candidate2c-faceted';
import {
  CANDIDATE2C_FACETED_THERMAL_ISOLATION,
  type Candidate2CFacetedThermalConfiguration,
  type Candidate2CFacetedThermalState,
} from './candidate2c-faceted-thermal';
import type { GridShape } from './config';
import type { ScalarFieldSnapshot } from './scalar-field-snapshot';

export type Candidate2CFacetedMorphologyVec3 = readonly [
  number,
  number,
  number,
];

/**
 * Lightweight authoritative projection consumed by the observational carrier.
 * Thermal fields are deliberately excluded so aligned checkpoints can be kept
 * for GPU review without retaining full CPU volumes.
 */
export type Candidate2CFacetedMorphologyState = Pick<
  Candidate2CFacetedThermalState,
  | 'configuration'
  | 'activeLoopOffsets'
  | 'completedLayers'
  | 'emittedLayers'
  | 'integratedSolidVolume'
  | 'loopCrossingDetected'
  | 'time'
  | 'step'
>;

const GRID_SPACING = 0.0625;
const GRID_SHAPE = Object.freeze([158, 42, 158] as const);
const HALF_SHIFTED_XZ_ORIGIN = -((GRID_SHAPE[0] - 1) * GRID_SPACING) / 2;

/**
 * Fixed observational carrier for the first Candidate 2C extraction screen.
 * The transition width only regularizes marching-cubes interpolation. It is
 * not a phase-field interface width and never feeds back into growth.
 */
export const CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER = Object.freeze({
  shape: GRID_SHAPE,
  spacing: GRID_SPACING,
  physicalOrigin: Object.freeze([
    HALF_SHIFTED_XZ_ORIGIN,
    -4.5 * GRID_SPACING,
    HALF_SHIFTED_XZ_ORIGIN,
  ] as const),
  observationalTransitionWidth: 2 * GRID_SPACING,
  baseLayerCount: 1,
  maximumTotalLayerCount: 8,
  maximumExtractionVertexCount: 650_001,
});

export const CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN = Object.freeze({
  evaluationTime: 1.5,
  totalSteps: 1600,
  timeStep: 1.5 / 1600,
  checkpointInterval: 100,
  checkpointSteps: Object.freeze(
    Array.from({ length: 17 }, (_, index) => index * 100),
  ),
});

export function createCandidate2CFacetedMorphologyScreenConfiguration(): Candidate2CFacetedThermalConfiguration {
  return {
    ...CANDIDATE2C_FACETED_THERMAL_ISOLATION,
    timeStep: CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.timeStep,
  };
}

export function projectCandidate2CFacetedMorphologyState(
  state: Candidate2CFacetedThermalState,
): Candidate2CFacetedMorphologyState {
  return {
    configuration: state.configuration,
    activeLoopOffsets: [...state.activeLoopOffsets],
    completedLayers: state.completedLayers,
    emittedLayers: state.emittedLayers,
    integratedSolidVolume: state.integratedSolidVolume,
    loopCrossingDetected: state.loopCrossingDetected,
    time: state.time,
    step: state.step,
  };
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function assertCarrierState(state: Candidate2CFacetedMorphologyState): void {
  if (
    !Number.isFinite(state.configuration.stepHeight) ||
    state.configuration.stepHeight <= 0 ||
    !Number.isFinite(state.integratedSolidVolume) ||
    state.integratedSolidVolume < 0
  ) {
    throw new RangeError(
      'Candidate 2C carrier geometry and swept volume must be finite.',
    );
  }
  if (!Number.isSafeInteger(state.step) || state.step < 0) {
    throw new RangeError('Candidate 2C carrier step must be nonnegative.');
  }
  if (!Number.isFinite(state.time) || state.time < 0) {
    throw new RangeError('Candidate 2C carrier time must be nonnegative.');
  }
  if (
    !Number.isSafeInteger(state.completedLayers) ||
    state.completedLayers < 0
  ) {
    throw new RangeError(
      'Candidate 2C carrier completed-layer count must be nonnegative.',
    );
  }
  if (state.loopCrossingDetected) {
    throw new RangeError('Candidate 2C carrier cannot hide a loop crossing.');
  }
  for (let index = 0; index < state.activeLoopOffsets.length; index += 1) {
    const offset = state.activeLoopOffsets[index] ?? Number.NaN;
    if (
      !Number.isFinite(offset) ||
      offset < 0 ||
      offset >= state.configuration.facetInradius
    ) {
      throw new RangeError(
        'Candidate 2C carrier loop offsets must lie inside the facet.',
      );
    }
    if (
      index > 0 &&
      !((state.activeLoopOffsets[index - 1] ?? Number.NaN) > offset)
    ) {
      throw new RangeError(
        'Candidate 2C carrier loops must remain strictly nested.',
      );
    }
  }
  const totalLayerCount =
    CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.baseLayerCount +
    state.completedLayers +
    state.activeLoopOffsets.length;
  if (
    totalLayerCount >
    CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.maximumTotalLayerCount
  ) {
    throw new RangeError(
      'Candidate 2C carrier layer stack exceeds its fixed extraction capacity.',
    );
  }
  if (
    state.emittedLayers !==
    state.completedLayers + state.activeLoopOffsets.length
  ) {
    throw new RangeError(
      'Candidate 2C carrier emitted-layer count must match its loop stack.',
    );
  }
  const { physicalOrigin, shape, spacing } =
    CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER;
  const maximumY = physicalOrigin[1] + (shape[1] - 1) * spacing;
  const maximumSolidHeight = totalLayerCount * state.configuration.stepHeight;
  if (maximumY - maximumSolidHeight < 4 * spacing) {
    throw new RangeError(
      'Candidate 2C carrier layer stack violates extraction clearance.',
    );
  }
  const minimumX = physicalOrigin[0];
  const maximumX = physicalOrigin[0] + (shape[0] - 1) * spacing;
  const minimumZ = physicalOrigin[2];
  const maximumZ = physicalOrigin[2] + (shape[2] - 1) * spacing;
  for (const vertex of state.configuration.frame.outerPolygon.vertices) {
    const worldX =
      vertex[0] * state.configuration.frame.tangentU[0] +
      vertex[1] * state.configuration.frame.tangentV[0];
    const worldZ =
      vertex[0] * state.configuration.frame.tangentU[2] +
      vertex[1] * state.configuration.frame.tangentV[2];
    if (
      worldX - minimumX < 4 * spacing ||
      maximumX - worldX < 4 * spacing ||
      worldZ - minimumZ < 4 * spacing ||
      maximumZ - worldZ < 4 * spacing
    ) {
      throw new RangeError(
        'Candidate 2C carrier facet violates extraction clearance.',
      );
    }
  }
}

function dynamicAnalyticVolume(
  state: Candidate2CFacetedMorphologyState,
): number {
  const { frame, stepHeight } = state.configuration;
  const outerArea = frame.outerPolygon.area;
  return (
    stepHeight *
    (state.completedLayers * outerArea +
      state.activeLoopOffsets.reduce(
        (sum, offset) =>
          sum + outerArea - candidate2CFacetedLoopPolygon(frame, offset).area,
        0,
      ))
  );
}

/** Exact volume represented by the carrier, including its one closed base. */
export function candidate2CFacetedMorphologyAnalyticVolume(
  state: Candidate2CFacetedMorphologyState,
): number {
  assertCarrierState(state);
  const dynamicVolume = dynamicAnalyticVolume(state);
  const ledgerScale = Math.max(
    1,
    Math.abs(dynamicVolume),
    Math.abs(state.integratedSolidVolume),
  );
  if (
    Math.abs(dynamicVolume - state.integratedSolidVolume) >
    1e-10 * ledgerScale
  ) {
    throw new RangeError(
      'Candidate 2C carrier geometry disagrees with the swept-volume ledger.',
    );
  }
  return (
    dynamicVolume +
    state.configuration.frame.outerPolygon.area *
      state.configuration.stepHeight *
      CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.baseLayerCount
  );
}

function fullPrismLevel(
  outerLevel: number,
  y: number,
  upperHeight: number,
): number {
  return Math.max(outerLevel, -y, y - upperHeight);
}

function dot3(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function localFacetPoint(
  frame: Candidate2CFacetedFrame,
  position: Candidate2CFacetedMorphologyVec3,
): Candidate2CFacetedVec2 {
  const recenteredWorldPoint = [position[0], 0, position[2]] as const;
  return [
    dot3(recenteredWorldPoint, frame.tangentU),
    dot3(recenteredWorldPoint, frame.tangentV),
  ];
}

function facetedLevel(
  frame: Candidate2CFacetedFrame,
  inwardOffset: number,
  point: Candidate2CFacetedVec2,
): number {
  return frame.normals2D.reduce(
    (level, normal, index) =>
      Math.max(
        level,
        normal[0] * point[0] +
          normal[1] * point[1] -
          ((frame.outerPolygon.supports[index] ?? Number.NaN) - inwardOffset),
      ),
    Number.NEGATIVE_INFINITY,
  );
}

/**
 * Signed observational level: negative is solid and positive is liquid. The
 * union contains a closed base prism plus one exact annular prism per active
 * ledge. No value produced here is consumed by the thermal-step solver.
 */
export function candidate2CFacetedMorphologyLevel(
  state: Candidate2CFacetedMorphologyState,
  position: Candidate2CFacetedMorphologyVec3,
): number {
  assertCarrierState(state);
  if (!position.every(Number.isFinite)) {
    throw new RangeError('Candidate 2C carrier position must be finite.');
  }
  return morphologyLevelUnchecked(state, position);
}

function morphologyLevelUnchecked(
  state: Candidate2CFacetedMorphologyState,
  position: Candidate2CFacetedMorphologyVec3,
): number {
  const { frame, stepHeight } = state.configuration;
  const point = localFacetPoint(frame, position);
  const outerLevel = facetedLevel(frame, 0, point);
  const fixedLayerCount =
    CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.baseLayerCount +
    state.completedLayers;
  let level = fullPrismLevel(
    outerLevel,
    position[1],
    fixedLayerCount * stepHeight,
  );

  for (let index = 0; index < state.activeLoopOffsets.length; index += 1) {
    const offset = state.activeLoopOffsets[index] ?? Number.NaN;
    const lowerHeight = (fixedLayerCount + index) * stepHeight;
    const upperHeight = lowerHeight + stepHeight;
    const loopLevel = facetedLevel(frame, offset, point);
    const annularPrismLevel = Math.max(
      outerLevel,
      -loopLevel,
      lowerHeight - position[1],
      position[1] - upperHeight,
    );
    level = Math.min(level, annularPrismLevel);
  }
  return level;
}

function observationalValueFromLevel(level: number): number {
  const transitionWidth =
    CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.observationalTransitionWidth;
  return clamp((-2 * level) / transitionWidth, -1, 1);
}

export function sampleCandidate2CFacetedMorphology(
  state: Candidate2CFacetedMorphologyState,
  position: Candidate2CFacetedMorphologyVec3,
): number {
  const level = candidate2CFacetedMorphologyLevel(state, position);
  return observationalValueFromLevel(level);
}

function gridPosition(
  x: number,
  y: number,
  z: number,
): Candidate2CFacetedMorphologyVec3 {
  const { physicalOrigin, spacing } = CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER;
  return [
    physicalOrigin[0] + x * spacing,
    physicalOrigin[1] + y * spacing,
    physicalOrigin[2] + z * spacing,
  ];
}

export function createCandidate2CFacetedMorphologySnapshot(
  state: Candidate2CFacetedMorphologyState,
): ScalarFieldSnapshot {
  candidate2CFacetedMorphologyAnalyticVolume(state);
  const shape: GridShape = CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.shape;
  const voxelCount = shape[0] * shape[1] * shape[2];
  const orderParameter = new Float32Array(voxelCount);
  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        const index = x + shape[0] * (y + shape[1] * z);
        orderParameter[index] = observationalValueFromLevel(
          morphologyLevelUnchecked(state, gridPosition(x, y, z)),
        );
      }
    }
  }
  return {
    shape,
    voxelCount,
    orderParameter,
    step: state.step,
    simulatedTime: state.time,
  };
}
