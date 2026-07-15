import type { GridShape } from './config';
import type { Candidate2DEdgeSourceState } from './candidate2d-edge-source';
import type { ScalarFieldSnapshot } from './scalar-field-snapshot';

export type Candidate2DEdgeMorphologyVec3 = readonly [number, number, number];

export interface Candidate2DEdgeMorphologyCarrierConfiguration {
  readonly shape: GridShape;
  readonly spacing: number;
  readonly physicalOrigin: Candidate2DEdgeMorphologyVec3;
  readonly observationalTransitionWidth: number;
  readonly minimumClearanceCells: number;
  readonly maximumExtractionVertexCount: number;
}

/** Extraction-only bridge for the exact one-front edge-source state. */
export const CANDIDATE2D_EDGE_MORPHOLOGY_CARRIER = Object.freeze({
  shape: Object.freeze([41, 61, 71] as const),
  spacing: 0.04,
  physicalOrigin: Object.freeze([-0.8, -1.6, -1.4] as const),
  observationalTransitionWidth: 0.06,
  minimumClearanceCells: 6,
  maximumExtractionVertexCount: 180_003,
}) satisfies Candidate2DEdgeMorphologyCarrierConfiguration;

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function assertCarrier(
  carrier: Candidate2DEdgeMorphologyCarrierConfiguration,
): void {
  if (
    carrier.shape.length !== 3 ||
    carrier.shape.some((size) => !Number.isSafeInteger(size) || size < 2)
  ) {
    throw new RangeError(
      'Candidate 2D edge morphology shape must contain three integers >= 2.',
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
      'Candidate 2D edge morphology dimensions must be finite and positive.',
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
      'Candidate 2D edge morphology capacities must be positive integer cells and triangles.',
    );
  }
}

function assertState(state: Candidate2DEdgeSourceState): void {
  if (
    !Number.isFinite(state.time) ||
    state.time < 0 ||
    !Number.isFinite(state.integratedSolidVolume) ||
    state.integratedSolidVolume < 0 ||
    !Number.isFinite(state.releasedLatentHeat) ||
    state.releasedLatentHeat < 0
  ) {
    throw new RangeError(
      'Candidate 2D edge morphology state must be finite and nonnegative.',
    );
  }
}

function boxLevel(
  position: Candidate2DEdgeMorphologyVec3,
  center: Candidate2DEdgeMorphologyVec3,
  halfSize: Candidate2DEdgeMorphologyVec3,
): number {
  const qx = Math.abs(position[0] - center[0]) - halfSize[0];
  const qy = Math.abs(position[1] - center[1]) - halfSize[1];
  const qz = Math.abs(position[2] - center[2]) - halfSize[2];
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qy, qz), 0);
}

function domainMaximum(
  carrier: Candidate2DEdgeMorphologyCarrierConfiguration,
  axis: 0 | 1 | 2,
): number {
  return (
    carrier.physicalOrigin[axis] + (carrier.shape[axis] - 1) * carrier.spacing
  );
}

function assertDomainClearance(
  state: Candidate2DEdgeSourceState,
  carrier: Candidate2DEdgeMorphologyCarrierConfiguration,
): void {
  const front = state.front;
  if (front === null || front.distance <= 0) return;
  const normal = [-front.growthDirection[1], front.growthDirection[0]] as const;
  const halfThickness = state.configuration.frontThickness / 2;
  const halfLine = state.configuration.contactLineLength / 2;
  const corners = [0, front.distance].flatMap((travel) =>
    [-halfThickness, halfThickness].map(
      (transverse) =>
        [
          front.sourcePoint[0] +
            front.growthDirection[0] * travel +
            normal[0] * transverse,
          front.sourcePoint[1] +
            front.growthDirection[1] * travel +
            normal[1] * transverse,
        ] as const,
    ),
  );
  const minimums: Candidate2DEdgeMorphologyVec3 = [
    Math.min(...corners.map((corner) => corner[0])),
    Math.min(...corners.map((corner) => corner[1])),
    -halfLine,
  ];
  const maximums: Candidate2DEdgeMorphologyVec3 = [
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
        'Candidate 2D edge morphology violates the fixed extraction clearance.',
      );
    }
  }
}

/** Negative is generated solid and positive is empty space. */
export function candidate2DEdgeMorphologyLevel(
  state: Candidate2DEdgeSourceState,
  position: Candidate2DEdgeMorphologyVec3,
  carrier: Candidate2DEdgeMorphologyCarrierConfiguration = CANDIDATE2D_EDGE_MORPHOLOGY_CARRIER,
): number {
  assertCarrier(carrier);
  assertState(state);
  if (!position.every(Number.isFinite)) {
    throw new RangeError(
      'Candidate 2D edge morphology sample position must be finite.',
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
      state.configuration.frontThickness / 2,
      state.configuration.contactLineLength / 2,
    ],
  );
}

export function candidate2DEdgeMorphologyAnalyticVolume(
  state: Candidate2DEdgeSourceState,
): number {
  assertState(state);
  return state.front?.sweptVolume ?? 0;
}

export function createCandidate2DEdgeMorphologySnapshot(
  state: Candidate2DEdgeSourceState,
  carrier: Candidate2DEdgeMorphologyCarrierConfiguration = CANDIDATE2D_EDGE_MORPHOLOGY_CARRIER,
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
        const level = candidate2DEdgeMorphologyLevel(
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
