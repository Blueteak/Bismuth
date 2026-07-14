import { describe, expect, it } from 'vitest';

import { extractMarchingCubesReference } from '../extraction/marching-cubes-reference';
import type { GridShape } from './config';
import {
  CANDIDATE2D_MORPHOLOGY_CARRIER,
  candidate2DMorphologyAnalyticBaseVolume,
  candidate2DMorphologyAnalyticTotalVolume,
  createCandidate2DMorphologySnapshot,
  sampleCandidate2DMorphology,
  type Candidate2DMorphologyCarrierConfiguration,
} from './candidate2d-morphology';
import {
  CANDIDATE2D_WINDING_PROOF,
  candidate2DLedgeSweepPatches,
  candidate2DPolygonCentroid,
  candidate2DPolygonFromSupports,
  createCandidate2DWindingState,
  runCandidate2DWindingSteps,
  type Candidate2DVec2,
  type Candidate2DWindingState,
} from './candidate2d-winding-ledge';
import type { ScalarFieldSnapshot } from './scalar-field-snapshot';

const COARSE_CARRIER = Object.freeze({
  ...CANDIDATE2D_MORPHOLOGY_CARRIER,
  shape: Object.freeze([106, 22, 106] as const),
  spacing: 1 / 6,
  minimumClearanceCells: 2,
}) satisfies Candidate2DMorphologyCarrierConfiguration;

function proofState(): Candidate2DWindingState {
  const proof = CANDIDATE2D_WINDING_PROOF;
  return runCandidate2DWindingSteps(
    createCandidate2DWindingState(proof.configuration),
    proof.totalSteps,
  );
}

function gridIndex(x: number, y: number, z: number, shape: GridShape): number {
  return x + shape[0] * (y + shape[1] * z);
}

function neighbors(index: number, shape: GridShape): readonly number[] {
  const x = index % shape[0];
  const yz = (index - x) / shape[0];
  const y = yz % shape[1];
  const z = (yz - y) / shape[1];
  return [
    x > 0 ? index - 1 : -1,
    x + 1 < shape[0] ? index + 1 : -1,
    y > 0 ? index - shape[0] : -1,
    y + 1 < shape[1] ? index + shape[0] : -1,
    z > 0 ? index - shape[0] * shape[1] : -1,
    z + 1 < shape[2] ? index + shape[0] * shape[1] : -1,
  ];
}

function solidComponentCount(snapshot: ScalarFieldSnapshot): number {
  const visited = new Uint8Array(snapshot.voxelCount);
  const queue = new Int32Array(snapshot.voxelCount);
  let components = 0;

  for (let start = 0; start < snapshot.voxelCount; start += 1) {
    if ((snapshot.orderParameter[start] ?? -1) < 0 || visited[start] !== 0) {
      continue;
    }
    components += 1;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++]!;
      for (const neighbor of neighbors(index, snapshot.shape)) {
        if (
          neighbor >= 0 &&
          visited[neighbor] === 0 &&
          (snapshot.orderParameter[neighbor] ?? -1) >= 0
        ) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
  }
  return components;
}

function nearestGridCoordinate(
  coordinate: number,
  axis: 0 | 1 | 2,
  carrier: Candidate2DMorphologyCarrierConfiguration,
): number {
  return Math.max(
    0,
    Math.min(
      carrier.shape[axis] - 1,
      Math.round((coordinate - carrier.physicalOrigin[axis]) / carrier.spacing),
    ),
  );
}

function openingGridIndex(
  opening: Candidate2DVec2,
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration,
): number {
  const x = nearestGridCoordinate(opening[0], 0, carrier);
  const y = nearestGridCoordinate(
    carrier.baseTopY + state.configuration.stepHeight / 2,
    1,
    carrier,
  );
  const z = nearestGridCoordinate(opening[1], 2, carrier);
  return gridIndex(x, y, z, carrier.shape);
}

function liquidReachesTopBoundary(
  snapshot: ScalarFieldSnapshot,
  start: number,
): boolean {
  if ((snapshot.orderParameter[start] ?? 1) >= 0) return false;
  const visited = new Uint8Array(snapshot.voxelCount);
  const queue = new Int32Array(snapshot.voxelCount);
  let head = 0;
  let tail = 1;
  queue[0] = start;
  visited[start] = 1;

  while (head < tail) {
    const index = queue[head++]!;
    const x = index % snapshot.shape[0];
    const yz = (index - x) / snapshot.shape[0];
    const y = yz % snapshot.shape[1];
    if (y === snapshot.shape[1] - 1) return true;
    for (const neighbor of neighbors(index, snapshot.shape)) {
      if (
        neighbor >= 0 &&
        visited[neighbor] === 0 &&
        (snapshot.orderParameter[neighbor] ?? 1) < 0
      ) {
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }
  return false;
}

function highestSolidSample(
  snapshot: ScalarFieldSnapshot,
  carrier: Candidate2DMorphologyCarrierConfiguration,
  column?: readonly [number, number],
): number {
  let maximum = Number.NEGATIVE_INFINITY;
  const xStart = column?.[0] ?? 0;
  const xEnd = column ? column[0] + 1 : snapshot.shape[0];
  const zStart = column?.[1] ?? 0;
  const zEnd = column ? column[1] + 1 : snapshot.shape[2];
  for (let z = zStart; z < zEnd; z += 1) {
    for (let y = 0; y < snapshot.shape[1]; y += 1) {
      for (let x = xStart; x < xEnd; x += 1) {
        if (
          (snapshot.orderParameter[gridIndex(x, y, z, snapshot.shape)] ?? -1) >=
          0
        ) {
          maximum = Math.max(
            maximum,
            carrier.physicalOrigin[1] + y * carrier.spacing,
          );
        }
      }
    }
  }
  return maximum;
}

function extractionPhase(orderParameter: Float32Array): Float32Array {
  const phase = new Float32Array(orderParameter.length);
  for (let index = 0; index < phase.length; index += 1) {
    phase[index] = (1 - (orderParameter[index] ?? Number.NaN)) / 2;
  }
  return phase;
}

function meshSignedVolume(
  positions: readonly (readonly [number, number, number])[],
): number {
  let sixVolume = 0;
  for (let index = 0; index < positions.length; index += 3) {
    const a = positions[index]!;
    const b = positions[index + 1]!;
    const c = positions[index + 2]!;
    sixVolume +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return sixVolume / 6;
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12);
}

function openingCenter(state: Candidate2DWindingState): Candidate2DVec2 {
  const oldest = state.ledges[0]!;
  return candidate2DPolygonCentroid(
    candidate2DPolygonFromSupports(
      state.configuration.supportNormals,
      oldest.currentSupportOffsets,
    ),
  );
}

function expectOpenConnectedTopology(
  snapshot: ScalarFieldSnapshot,
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration,
  opening: Candidate2DVec2,
): void {
  expect(solidComponentCount(snapshot)).toBe(1);
  const openingIndex = openingGridIndex(opening, state, carrier);
  expect(snapshot.orderParameter[openingIndex]).toBeLessThan(0);
  expect(liquidReachesTopBoundary(snapshot, openingIndex)).toBe(true);
}

describe('Candidate 2D morphology carrier', () => {
  it('keeps one connected solid around an open liquid core and agrees with the exact ledgers', () => {
    const state = proofState();
    const carrier = CANDIDATE2D_MORPHOLOGY_CARRIER;
    const snapshot = createCandidate2DMorphologySnapshot(state, carrier);
    const opening = openingCenter(state);
    const openingSampleY =
      carrier.baseTopY + state.configuration.stepHeight / 2;

    expect(
      sampleCandidate2DMorphology(
        state,
        [opening[0], openingSampleY, opening[1]],
        carrier,
      ),
    ).toBeLessThan(0);
    expectOpenConnectedTopology(snapshot, state, carrier, opening);

    const openingX = nearestGridCoordinate(opening[0], 0, carrier);
    const openingZ = nearestGridCoordinate(opening[1], 2, carrier);
    const coreHeight = highestSolidSample(snapshot, carrier, [
      openingX,
      openingZ,
    ]);
    const rimHeight = highestSolidSample(snapshot, carrier);
    expect(rimHeight).toBeGreaterThan(coreHeight);

    const patchArea = state.ledges.reduce(
      (ledgeSum, ledge) =>
        ledgeSum +
        candidate2DLedgeSweepPatches(ledge, state.configuration).reduce(
          (patchSum, patch) => patchSum + patch.area,
          0,
        ),
      0,
    );
    const analyticDynamicVolume = patchArea * state.configuration.stepHeight;
    const analyticBaseVolume = candidate2DMorphologyAnalyticBaseVolume(
      state,
      carrier,
    );
    const analyticTotalVolume = candidate2DMorphologyAnalyticTotalVolume(
      state,
      carrier,
    );
    expect(
      relativeError(analyticDynamicVolume, state.integratedSolidVolume),
    ).toBeLessThanOrEqual(1e-12);
    expect(
      relativeError(
        state.releasedLatentHeat,
        state.configuration.latentHeatPerVolume * analyticDynamicVolume,
      ),
    ).toBeLessThanOrEqual(1e-12);
    expect(
      relativeError(
        analyticTotalVolume,
        analyticBaseVolume + analyticDynamicVolume,
      ),
    ).toBeLessThanOrEqual(1e-12);
  });

  it('preserves the open topology and improves extracted volume under two-to-one refinement', () => {
    const state = proofState();
    const opening = openingCenter(state);
    const coarseSnapshot = createCandidate2DMorphologySnapshot(
      state,
      COARSE_CARRIER,
    );
    const fineSnapshot = createCandidate2DMorphologySnapshot(
      state,
      CANDIDATE2D_MORPHOLOGY_CARRIER,
    );

    expectOpenConnectedTopology(coarseSnapshot, state, COARSE_CARRIER, opening);
    expectOpenConnectedTopology(
      fineSnapshot,
      state,
      CANDIDATE2D_MORPHOLOGY_CARRIER,
      opening,
    );

    const expectedVolume = candidate2DMorphologyAnalyticTotalVolume(
      state,
      CANDIDATE2D_MORPHOLOGY_CARRIER,
    );
    const coarseMesh = extractMarchingCubesReference({
      field: extractionPhase(coarseSnapshot.orderParameter),
      shape: coarseSnapshot.shape,
      spacing: COARSE_CARRIER.spacing,
      physicalOrigin: COARSE_CARRIER.physicalOrigin,
    });
    const fineMesh = extractMarchingCubesReference({
      field: extractionPhase(fineSnapshot.orderParameter),
      shape: fineSnapshot.shape,
      spacing: CANDIDATE2D_MORPHOLOGY_CARRIER.spacing,
      physicalOrigin: CANDIDATE2D_MORPHOLOGY_CARRIER.physicalOrigin,
    });
    const coarseVolume = meshSignedVolume(coarseMesh.positions);
    const fineVolume = meshSignedVolume(fineMesh.positions);
    expect(coarseMesh.triangleCount).toBeGreaterThan(0);
    expect(fineMesh.triangleCount).toBeGreaterThan(0);
    expect(coarseVolume).toBeGreaterThan(0);
    expect(fineVolume).toBeGreaterThan(0);
    expect(relativeError(fineVolume, expectedVolume)).toBeLessThan(
      relativeError(coarseVolume, expectedVolume),
    );
  });
});
