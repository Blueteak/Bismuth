import type { GridShape } from './config';
import type { ScalarFieldSnapshot } from './scalar-field-snapshot';
import type { Candidate2DTwinSourceState } from './candidate2d-twin-source';

export type Candidate2DTwinMorphologyVec3 = readonly [number, number, number];

export interface Candidate2DTwinMorphologyCarrierConfiguration {
  readonly shape: GridShape;
  readonly spacing: number;
  readonly physicalOrigin: Candidate2DTwinMorphologyVec3;
  readonly observationalTransitionWidth: number;
  readonly minimumClearanceCells: number;
  readonly maximumExtractionVertexCount: number;
}

/**
 * Extraction-only intrinsic facet frame for the one-front twin isolation.
 * The source growth direction is embedded in x/y, its perpendicular supplies
 * the observational step-height axis, and z is the out-of-section twin/facet
 * intersection. No hopper body or target-shaped carrier is added.
 */
export const CANDIDATE2D_TWIN_MORPHOLOGY_CARRIER = Object.freeze({
  shape: Object.freeze([51, 51, 65] as const),
  spacing: 0.04,
  physicalOrigin: Object.freeze([-0.6, -0.6, -1.28] as const),
  observationalTransitionWidth: 0.06,
  minimumClearanceCells: 6,
  maximumExtractionVertexCount: 180_003,
}) satisfies Candidate2DTwinMorphologyCarrierConfiguration;

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function assertCarrier(
  carrier: Candidate2DTwinMorphologyCarrierConfiguration,
): void {
  if (
    carrier.shape.length !== 3 ||
    carrier.shape.some((size) => !Number.isSafeInteger(size) || size < 2)
  ) {
    throw new RangeError(
      'Candidate 2D twin morphology shape must contain three integers >= 2.',
    );
  }
  if (
    !Number.isFinite(carrier.spacing) ||
    carrier.spacing <= 0 ||
    !Number.isFinite(carrier.observationalTransitionWidth) ||
    carrier.observationalTransitionWidth <= 0 ||
    carrier.physicalOrigin.some((coordinate) => !Number.isFinite(coordinate))
  ) {
    throw new RangeError(
      'Candidate 2D twin morphology dimensions must be finite and positive.',
    );
  }
  if (
    !Number.isSafeInteger(carrier.minimumClearanceCells) ||
    carrier.minimumClearanceCells < 1 ||
    !Number.isSafeInteger(carrier.maximumExtractionVertexCount) ||
    carrier.maximumExtractionVertexCount < 3 ||
    carrier.maximumExtractionVertexCount % 3 !== 0
  ) {
    throw new RangeError(
      'Candidate 2D twin morphology capacities must be positive integer cells and triangles.',
    );
  }
}

function assertState(state: Candidate2DTwinSourceState): void {
  if (
    !Number.isFinite(state.time) ||
    state.time < 0 ||
    !Number.isFinite(state.integratedSweptArea) ||
    state.integratedSweptArea < 0 ||
    !Number.isFinite(state.integratedSolidVolume) ||
    state.integratedSolidVolume < 0 ||
    !Number.isFinite(state.releasedLatentHeat) ||
    state.releasedLatentHeat < 0
  ) {
    throw new RangeError(
      'Candidate 2D twin morphology state must be finite and nonnegative.',
    );
  }
}

function boxLevel(
  position: Candidate2DTwinMorphologyVec3,
  center: Candidate2DTwinMorphologyVec3,
  halfSize: Candidate2DTwinMorphologyVec3,
): number {
  const qx = Math.abs(position[0] - center[0]) - halfSize[0];
  const qy = Math.abs(position[1] - center[1]) - halfSize[1];
  const qz = Math.abs(position[2] - center[2]) - halfSize[2];
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qy, qz), 0);
  return outside + inside;
}

function domainMaximum(
  carrier: Candidate2DTwinMorphologyCarrierConfiguration,
  axis: 0 | 1 | 2,
): number {
  return (
    carrier.physicalOrigin[axis] + (carrier.shape[axis] - 1) * carrier.spacing
  );
}

function assertDomainClearance(
  state: Candidate2DTwinSourceState,
  carrier: Candidate2DTwinMorphologyCarrierConfiguration,
): void {
  const front = state.front;
  if (front === null || front.distance <= 0) return;
  const halfHeight = state.configuration.stepHeight / 2;
  const halfLine = state.configuration.sourceLineLength / 2;
  const normal = [-front.growthDirection[1], front.growthDirection[0]] as const;
  const corners = [0, front.distance].flatMap((travel) =>
    [-halfHeight, halfHeight].map(
      (height) =>
        [
          front.sourcePoint[0] +
            front.growthDirection[0] * travel +
            normal[0] * height,
          front.sourcePoint[1] +
            front.growthDirection[1] * travel +
            normal[1] * height,
        ] as const,
    ),
  );
  const minimums: Candidate2DTwinMorphologyVec3 = [
    Math.min(...corners.map((corner) => corner[0])),
    Math.min(...corners.map((corner) => corner[1])),
    -halfLine,
  ];
  const maximums: Candidate2DTwinMorphologyVec3 = [
    Math.max(...corners.map((corner) => corner[0])),
    Math.max(...corners.map((corner) => corner[1])),
    halfLine,
  ];
  const clearance = carrier.minimumClearanceCells * carrier.spacing;
  for (const axis of [0, 1, 2] as const) {
    if (
      minimums[axis] - carrier.physicalOrigin[axis] < clearance ||
      domainMaximum(carrier, axis) - maximums[axis] < clearance
    ) {
      throw new RangeError(
        'Candidate 2D twin morphology violates the fixed extraction clearance.',
      );
    }
  }
}

/** Negative is generated solid and positive is empty space. */
export function candidate2DTwinMorphologyLevel(
  state: Candidate2DTwinSourceState,
  position: Candidate2DTwinMorphologyVec3,
  carrier: Candidate2DTwinMorphologyCarrierConfiguration = CANDIDATE2D_TWIN_MORPHOLOGY_CARRIER,
): number {
  assertCarrier(carrier);
  assertState(state);
  if (!position.every(Number.isFinite)) {
    throw new RangeError(
      'Candidate 2D twin morphology sample position must be finite.',
    );
  }
  const front = state.front;
  if (front === null || front.distance <= 0) return 1;
  assertDomainClearance(state, carrier);
  const offsetX = position[0] - front.sourcePoint[0];
  const offsetY = position[1] - front.sourcePoint[1];
  const travel =
    offsetX * front.growthDirection[0] + offsetY * front.growthDirection[1];
  const transverse =
    -offsetX * front.growthDirection[1] + offsetY * front.growthDirection[0];
  return boxLevel(
    [travel, transverse, position[2]],
    [front.distance / 2, 0, 0],
    [
      front.distance / 2,
      state.configuration.stepHeight / 2,
      state.configuration.sourceLineLength / 2,
    ],
  );
}

export function candidate2DTwinMorphologyAnalyticVolume(
  state: Candidate2DTwinSourceState,
): number {
  assertState(state);
  return state.front?.sweptVolume ?? 0;
}

export function createCandidate2DTwinMorphologySnapshot(
  state: Candidate2DTwinSourceState,
  carrier: Candidate2DTwinMorphologyCarrierConfiguration = CANDIDATE2D_TWIN_MORPHOLOGY_CARRIER,
): ScalarFieldSnapshot {
  assertCarrier(carrier);
  assertState(state);
  assertDomainClearance(state, carrier);
  const shape = carrier.shape;
  const voxelCount = shape[0] * shape[1] * shape[2];
  const orderParameter = new Float32Array(voxelCount);
  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        const index = x + shape[0] * (y + shape[1] * z);
        const level = candidate2DTwinMorphologyLevel(
          state,
          [
            carrier.physicalOrigin[0] + x * carrier.spacing,
            carrier.physicalOrigin[1] + y * carrier.spacing,
            carrier.physicalOrigin[2] + z * carrier.spacing,
          ],
          carrier,
        );
        orderParameter[index] = clamp(
          (-2 * level) / carrier.observationalTransitionWidth,
          -1,
          1,
        );
      }
    }
  }
  return {
    shape,
    voxelCount,
    orderParameter,
    step: Math.round(state.time / state.configuration.timeStep),
    simulatedTime: state.time,
  };
}
