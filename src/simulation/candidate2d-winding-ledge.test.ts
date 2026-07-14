import { describe, expect, it } from 'vitest';

import {
  CANDIDATE2D_WINDING_PROOF,
  advanceCandidate2DWindingState,
  assessCandidate2DTopology,
  assessCandidate2DWindingState,
  candidate2DActiveSweepGeometry,
  candidate2DLedgePathSegments,
  candidate2DLedgeSweepPatches,
  candidate2DPolygonArea,
  candidate2DPolygonFromSupports,
  createCandidate2DWindingState,
  runCandidate2DWindingSteps,
  type Candidate2DTopologyDescriptor,
  type Candidate2DTopologyRejectionReason,
  type Candidate2DVec2,
  type Candidate2DWindingState,
} from './candidate2d-winding-ledge';

const TARGET_LIKE_DESCRIPTOR = Object.freeze({
  outerEdgeCount: 4,
  principalAxisCount: 2,
  turnAnglesDegrees: Object.freeze([88, 93, 84, 97, 91, 86]),
  signedTurnRadians: Object.freeze([
    Math.PI / 2,
    Math.PI / 2,
    Math.PI / 2,
    Math.PI / 2,
    Math.PI / 2,
    Math.PI / 2,
  ]),
  openingDepthSteps: 4,
  openingDepthRatio: 0.8,
  terraceWidths: Object.freeze([0.62, 0.43, 0.79, 0.51, 0.68, 0.38]),
  openingCenterOffsetRatio: 0.03,
  activePartialFrontCount: 1,
  pathClosed: false,
  pathSelfIntersectionCount: 0,
}) satisfies Candidate2DTopologyDescriptor;

function relativeDifference(left: number, right: number): number {
  return Math.abs(left - right) / Math.max(1, Math.abs(left), Math.abs(right));
}

function distance(left: Candidate2DVec2, right: Candidate2DVec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function expectLedgersToClose(state: Candidate2DWindingState): void {
  const patchArea = state.ledges.reduce(
    (ledgeSum, ledge) =>
      ledgeSum +
      candidate2DLedgeSweepPatches(ledge, state.configuration).reduce(
        (patchSum, patch) => patchSum + patch.area,
        0,
      ),
    0,
  );
  expect(
    relativeDifference(patchArea, state.integratedSweptArea),
  ).toBeLessThanOrEqual(1e-10);
  expect(
    relativeDifference(
      state.integratedSolidVolume,
      state.configuration.stepHeight * state.integratedSweptArea,
    ),
  ).toBeLessThanOrEqual(1e-12);
  expect(
    relativeDifference(
      state.releasedLatentHeat,
      state.configuration.latentHeatPerVolume * state.integratedSolidVolume,
    ),
  ).toBeLessThanOrEqual(1e-12);
  for (const ledge of state.ledges) {
    expect(
      relativeDifference(
        ledge.integratedSolidVolume,
        state.configuration.stepHeight * ledge.integratedSweptArea,
      ),
    ).toBeLessThanOrEqual(1e-12);
    expect(
      relativeDifference(
        ledge.releasedLatentHeat,
        state.configuration.latentHeatPerVolume * ledge.integratedSolidVolume,
      ),
    ).toBeLessThanOrEqual(1e-12);
  }
}

function expectEquivalentCarrierState(
  actual: Candidate2DWindingState,
  expected: Candidate2DWindingState,
): void {
  expect(actual.ledges).toHaveLength(expected.ledges.length);
  expect(relativeDifference(actual.time, expected.time)).toBeLessThanOrEqual(
    1e-10,
  );
  expect(
    relativeDifference(
      actual.integratedSweptArea,
      expected.integratedSweptArea,
    ),
  ).toBeLessThanOrEqual(1e-10);
  expect(
    relativeDifference(
      actual.integratedSolidVolume,
      expected.integratedSolidVolume,
    ),
  ).toBeLessThanOrEqual(1e-10);
  expect(
    relativeDifference(actual.releasedLatentHeat, expected.releasedLatentHeat),
  ).toBeLessThanOrEqual(1e-10);

  for (let ledgeIndex = 0; ledgeIndex < actual.ledges.length; ledgeIndex += 1) {
    const actualLedge = actual.ledges[ledgeIndex]!;
    const expectedLedge = expected.ledges[ledgeIndex]!;
    expect({
      elevationIndex: actualLedge.elevationIndex,
      activeSupportIndex: actualLedge.activeSupportIndex,
      turnOrdinal: actualLedge.turnOrdinal,
      complete: actualLedge.complete,
      completedPatchCount: actualLedge.completedPatches.length,
      completedSegmentCount: actualLedge.completedPathSegments.length,
    }).toEqual({
      elevationIndex: expectedLedge.elevationIndex,
      activeSupportIndex: expectedLedge.activeSupportIndex,
      turnOrdinal: expectedLedge.turnOrdinal,
      complete: expectedLedge.complete,
      completedPatchCount: expectedLedge.completedPatches.length,
      completedSegmentCount: expectedLedge.completedPathSegments.length,
    });
    expect(
      relativeDifference(actualLedge.progress, expectedLedge.progress),
    ).toBeLessThanOrEqual(1e-10);
    expect(
      relativeDifference(
        actualLedge.integratedSweptArea,
        expectedLedge.integratedSweptArea,
      ),
    ).toBeLessThanOrEqual(1e-10);
    for (let supportIndex = 0; supportIndex < 4; supportIndex += 1) {
      expect(
        relativeDifference(
          actualLedge.currentSupportOffsets[supportIndex]!,
          expectedLedge.currentSupportOffsets[supportIndex]!,
        ),
      ).toBeLessThanOrEqual(1e-10);
    }
  }
}

describe('Candidate 2D target-locked winding ledge', () => {
  it('keeps the proof path connected and closes its swept-area, volume, and latent ledgers', () => {
    const proof = CANDIDATE2D_WINDING_PROOF;
    let state = createCandidate2DWindingState(proof.configuration);
    let previousStep = 0;
    let previousArea = 0;

    for (const checkpointStep of proof.checkpointSteps.slice(1)) {
      state = runCandidate2DWindingSteps(state, checkpointStep - previousStep);
      expect(state.integratedSweptArea).toBeGreaterThanOrEqual(previousArea);
      expectLedgersToClose(state);
      previousStep = checkpointStep;
      previousArea = state.integratedSweptArea;
    }

    expect(state.time).toBeCloseTo(proof.evaluationTime, 10);
    expect(state.integratedSweptArea).toBeCloseTo(120.96046372482616, 10);
    expect(state.integratedSolidVolume).toBeCloseTo(30.24011593120654, 10);
    expect(state.releasedLatentHeat).toBeCloseTo(83.16031881081796, 10);
    expect(state.ledges).toHaveLength(proof.configuration.maximumLedgeCount);
    expect(
      new Set(state.ledges.map((ledge) => ledge.elevationIndex)).size,
    ).toBe(proof.configuration.maximumLedgeCount);

    for (const ledge of state.ledges) {
      const initialArea = candidate2DPolygonArea(
        candidate2DPolygonFromSupports(
          state.configuration.supportNormals,
          state.configuration.initialSupportOffsets,
        ),
      );
      const committedOpeningArea = candidate2DPolygonArea(
        candidate2DPolygonFromSupports(
          state.configuration.supportNormals,
          ledge.currentSupportOffsets,
        ),
      );
      const completedPatchArea = ledge.completedPatches.reduce(
        (sum, patch) => sum + patch.area,
        0,
      );
      expect(completedPatchArea).toBeCloseTo(
        initialArea - committedOpeningArea,
        10,
      );
      const path = candidate2DLedgePathSegments(ledge, state.configuration);
      expect(path.length).toBeGreaterThan(0);
      for (
        let segmentIndex = 1;
        segmentIndex < path.length;
        segmentIndex += 1
      ) {
        expect(
          distance(path[segmentIndex - 1]!.end, path[segmentIndex]!.start),
        ).toBeLessThanOrEqual(1e-10);
      }
      const active = candidate2DActiveSweepGeometry(ledge, state.configuration);
      expect(active).not.toBeNull();
      expect(active!.partialPatch.vertices).toHaveLength(4);
      expect(
        distance(
          active!.currentHead.position,
          active!.partialPatch.vertices[1]!,
        ),
      ).toBeLessThanOrEqual(1e-10);
      expect(
        distance(
          active!.currentFrontInnerPosition,
          active!.partialPatch.vertices[2]!,
        ),
      ).toBeLessThanOrEqual(1e-10);
      expect(
        distance(path[path.length - 1]!.end, active!.currentHead.position),
      ).toBeLessThanOrEqual(1e-10);
    }

    const assessment = assessCandidate2DWindingState(state);
    const descriptor = assessment.descriptor;
    const rectilinearTurnFraction =
      descriptor.turnAnglesDegrees.filter(
        (angle) => angle >= 70 && angle <= 110,
      ).length / descriptor.turnAnglesDegrees.length;
    const signedTurnSum = descriptor.signedTurnRadians.reduce(
      (sum, angle) => sum + angle,
      0,
    );
    expect(descriptor.turnAnglesDegrees.length).toBeGreaterThanOrEqual(6);
    expect(rectilinearTurnFraction).toBeGreaterThanOrEqual(0.8);
    expect(Math.abs(signedTurnSum)).toBeGreaterThanOrEqual(3 * Math.PI);
    expect(descriptor.openingDepthSteps).toBeGreaterThanOrEqual(4);
    expect(descriptor.openingDepthRatio).toBeGreaterThanOrEqual(0.35);
    expect(descriptor.activePartialFrontCount).toBeGreaterThanOrEqual(1);
    expect(descriptor.pathClosed).toBe(false);
    expect({
      pathSelfIntersectionCount: descriptor.pathSelfIntersectionCount,
      classification: assessment.classification,
      reasons: assessment.reasons,
    }).toEqual({
      pathSelfIntersectionCount: 0,
      classification: 'target-topology-carrier',
      reasons: [],
    });
  });

  it('is invariant to how the same elapsed time is partitioned', () => {
    const proof = CANDIDATE2D_WINDING_PROOF;
    const fine = runCandidate2DWindingSteps(
      createCandidate2DWindingState(proof.configuration),
      proof.totalSteps,
    );
    const singleAdvance = advanceCandidate2DWindingState(
      createCandidate2DWindingState(proof.configuration),
      proof.evaluationTime,
    );
    const partitioned = [10, 10, 10, 13].reduce(
      (state, duration) => advanceCandidate2DWindingState(state, duration),
      createCandidate2DWindingState(proof.configuration),
    );
    const irregularPartitioned = [
      0.137, 4.913, 6.271, 2.219, 9.417, 20.043,
    ].reduce(
      (state, duration) => advanceCandidate2DWindingState(state, duration),
      createCandidate2DWindingState(proof.configuration),
    );
    const rawNormalConfiguration = {
      ...proof.configuration,
      supportNormals: [
        [1, 0],
        [1, 9],
        [-10, 1],
        [-1, -8],
      ] as const,
    };
    const rawNormalState = runCandidate2DWindingSteps(
      createCandidate2DWindingState(rawNormalConfiguration),
      proof.totalSteps,
    );

    expectEquivalentCarrierState(singleAdvance, fine);
    expectEquivalentCarrierState(partitioned, fine);
    expectEquivalentCarrierState(irregularPartitioned, fine);
    expectEquivalentCarrierState(rawNormalState, fine);
    expectLedgersToClose(singleAdvance);
    expectLedgersToClose(partitioned);
    expectLedgersToClose(irregularPartitioned);
    expectLedgersToClose(rawNormalState);
    expect(advanceCandidate2DWindingState(fine, 0)).toBe(fine);
  });

  it('does not count a zero-progress birth as visible opening depth', () => {
    const proof = CANDIDATE2D_WINDING_PROOF;
    const state = advanceCandidate2DWindingState(
      createCandidate2DWindingState(proof.configuration),
      proof.configuration.ledgeBirthInterval,
    );
    expect(state.ledges).toHaveLength(2);
    expect(state.ledges[1]!.integratedSweptArea).toBe(0);
    expect(
      assessCandidate2DWindingState(state).descriptor.openingDepthSteps,
    ).toBe(1);
  });

  it('solves oblique support intersections without an artificial clip box', () => {
    const degrees = [0, 3, 176, 268];
    const normals = degrees.map((angle) => {
      const radians = (angle * Math.PI) / 180;
      return [Math.cos(radians), Math.sin(radians)] as const;
    }) as unknown as readonly [
      Candidate2DVec2,
      Candidate2DVec2,
      Candidate2DVec2,
      Candidate2DVec2,
    ];
    const offsets = [100, 200, 200, 200] as const;
    const polygon = candidate2DPolygonFromSupports(normals, offsets);
    expect(polygon).toHaveLength(4);
    for (const vertex of polygon) {
      for (let index = 0; index < 4; index += 1) {
        expect(
          normals[index]![0] * vertex[0] + normals[index]![1] * vertex[1],
        ).toBeLessThanOrEqual(offsets[index]! + 1e-7);
      }
    }
    expect(
      Math.max(...polygon.map((vertex) => Math.abs(vertex[1]))),
    ).toBeGreaterThan(804);
  });

  it.each<{
    name: string;
    descriptor: Candidate2DTopologyDescriptor;
    reason: Candidate2DTopologyRejectionReason;
  }>([
    {
      name: 'regular hexagonal plate',
      descriptor: {
        ...TARGET_LIKE_DESCRIPTOR,
        outerEdgeCount: 6,
        principalAxisCount: 3,
        turnAnglesDegrees: [60, 60, 60, 60, 60, 60],
        signedTurnRadians: Array.from({ length: 6 }, () => Math.PI / 3),
      },
      reason: 'requires-four-edge-frame',
    },
    {
      name: 'three-sided Sn-Bi pyramid',
      descriptor: {
        ...TARGET_LIKE_DESCRIPTOR,
        outerEdgeCount: 3,
        principalAxisCount: 3,
        turnAnglesDegrees: [120, 120, 120, 120, 120, 120],
        signedTurnRadians: Array.from({ length: 6 }, () => (2 * Math.PI) / 3),
      },
      reason: 'requires-four-edge-frame',
    },
    {
      name: 'complete homothetic rings',
      descriptor: {
        ...TARGET_LIKE_DESCRIPTOR,
        activePartialFrontCount: 0,
        pathClosed: true,
      },
      reason: 'path-closes-into-rings',
    },
    {
      name: 'shallow centered opening',
      descriptor: {
        ...TARGET_LIKE_DESCRIPTOR,
        openingDepthSteps: 2,
        openingDepthRatio: 0.25,
      },
      reason: 'opening-too-shallow',
    },
    {
      name: 'perfectly symmetric uninterrupted growth',
      descriptor: {
        ...TARGET_LIKE_DESCRIPTOR,
        terraceWidths: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        openingCenterOffsetRatio: 0,
      },
      reason: 'symmetry-too-perfect',
    },
  ])('rejects $name', ({ descriptor, reason }) => {
    const assessment = assessCandidate2DTopology(descriptor);
    expect(assessment.classification).toBe('rejected');
    expect(assessment.acceptedMorphology).toBe(false);
    expect(assessment.mechanismResolved).toBe(false);
    expect(assessment.reasons).toContain(reason);
  });

  it('recognizes the predeclared target-like topology without promoting morphology', () => {
    const assessment = assessCandidate2DTopology(TARGET_LIKE_DESCRIPTOR);
    expect(assessment).toMatchObject({
      classification: 'target-topology-carrier',
      acceptedMorphology: false,
      mechanismResolved: false,
      reasons: [],
    });
  });
});
