import { describe, expect, it } from 'vitest';

import {
  CANDIDATE2D_TWIN_SOURCE_PROOF,
  advanceCandidate2DTwinSourceState,
  applyCandidate2DTwinSourceHeatRemoval,
  candidate2DTwinSourceLedger,
  createCandidate2DTwinSourceState,
  runCandidate2DTwinSourceDiscriminator,
  type Candidate2DTwinSourceState,
} from './candidate2d-twin-source';

function expectStateLedgersToClose(state: Candidate2DTwinSourceState): void {
  const ledger = candidate2DTwinSourceLedger(state);
  expect(ledger.normalizedResidual).toBeLessThanOrEqual(
    CANDIDATE2D_TWIN_SOURCE_PROOF.maximumNormalizedLedgerResidual,
  );
  if (state.front === null) {
    expect(state.integratedSweptArea).toBe(0);
  } else {
    expect(state.front.sweptArea).toBeCloseTo(state.integratedSweptArea, 12);
    expect(state.front.sweptArea).toBeCloseTo(
      state.configuration.sourceLineLength * state.front.distance,
      12,
    );
  }
}

describe('Candidate 2D local twin-plane source', () => {
  it('emits one parallel local front only for a faceted re-entrant twin termination', () => {
    const result = runCandidate2DTwinSourceDiscriminator();

    expect(result.classification).toBe('passes-local-twin-source-isolation');
    expect(result.localSourceIsolationPasses).toBe(true);
    expect(result.forward.eligibility).toMatchObject({
      facetedInterface: true,
      twinPresent: true,
      twinTerminatesAtInterface: true,
      twinLiesInSolid: true,
      growthDirectionLiesInLiquid: true,
      reentrantInterface: true,
      eligible: true,
    });
    expect(result.forward.events).toHaveLength(1);
    expect(result.forward.front?.complete).toBe(true);
    expect(result.forward.front?.completedAt).toBeGreaterThan(0);
    expect(result.forward.front?.distance).toBe(
      result.forward.configuration.maximumFrontTravel,
    );
    expect(result.forward.events[0]?.sourcePoint).toEqual(
      result.forward.configuration.geometry.interfaceVertex,
    );
    const eventDirection = result.forward.events[0]?.growthDirection;
    const twinSegment = result.forward.configuration.geometry.twinSegment;
    expect(eventDirection).not.toBeUndefined();
    expect(twinSegment).not.toBeNull();
    if (eventDirection !== undefined && twinSegment !== null) {
      const twinDirection = [
        twinSegment[1][0] - twinSegment[0][0],
        twinSegment[1][1] - twinSegment[0][1],
      ] as const;
      const cross =
        eventDirection[0] * twinDirection[1] -
        eventDirection[1] * twinDirection[0];
      expect(Math.abs(cross)).toBeLessThanOrEqual(1e-12);
    }

    for (const inactive of [
      result.noTwin,
      result.nonTerminating,
      result.twinOutsideSolid,
      result.growthNotInLiquid,
      result.nonReentrant,
      result.nonFaceted,
      result.zeroDriving,
      result.reversed,
    ]) {
      expect(inactive.events).toHaveLength(0);
      expect(inactive.front).toBeNull();
      expect(inactive.integratedSweptArea).toBe(0);
      expectStateLedgersToClose(inactive);
    }
    expect(result.twinOutsideSolid.eligibility).toMatchObject({
      twinPresent: true,
      twinTerminatesAtInterface: true,
      twinLiesInSolid: false,
      reentrantInterface: true,
    });
    expect(result.growthNotInLiquid.eligibility).toMatchObject({
      twinPresent: true,
      twinTerminatesAtInterface: true,
      twinLiesInSolid: true,
      growthDirectionLiesInLiquid: false,
      reentrantInterface: true,
    });
    expect(result.nonReentrant.eligibility).toMatchObject({
      twinPresent: true,
      twinTerminatesAtInterface: true,
      twinLiesInSolid: true,
      growthDirectionLiesInLiquid: true,
      reentrantInterface: false,
    });
    expect(result.nonFaceted.eligibility).toMatchObject({
      twinPresent: true,
      twinTerminatesAtInterface: true,
      twinLiesInSolid: true,
      growthDirectionLiesInLiquid: true,
      reentrantInterface: true,
      facetedInterface: false,
    });
    expect(result.zeroDriving.eligibility.eligible).toBe(true);
    expect(result.zeroDriving.undercooling).toBe(0);
    expect(result.reversed.eligibility.eligible).toBe(true);
    expect(result.reversed.undercooling).toBeLessThan(0);

    expect(result.acceptedAsTargetSource).toBe(false);
    expect(result.persistentSupplyDemonstrated).toBe(false);
    expect(result.windingTopologyDemonstrated).toBe(false);
    expect(result.acceptedMorphology).toBe(false);
    expect(result.nextAction).toBe('edge-free-surface');
  });

  it('closes the geometry and thermal ledgers across partitions and a signed reversal', () => {
    const configuration = CANDIDATE2D_TWIN_SOURCE_PROOF.configuration;
    const oneShot = advanceCandidate2DTwinSourceState(
      createCandidate2DTwinSourceState(configuration),
      CANDIDATE2D_TWIN_SOURCE_PROOF.evaluationTime,
    );
    let partitioned = createCandidate2DTwinSourceState(configuration);
    for (const duration of [0.17, 0.83, 1.41, 0.09, 2.2, 1.5, 1.8]) {
      partitioned = advanceCandidate2DTwinSourceState(partitioned, duration);
    }

    expect(partitioned.time).toBeCloseTo(oneShot.time, 12);
    expect(partitioned.events).toEqual(oneShot.events);
    expect(partitioned.front?.distance).toBeCloseTo(
      oneShot.front?.distance ?? Number.NaN,
      12,
    );
    expect(partitioned.front?.completedAt).toBeCloseTo(
      oneShot.front?.completedAt ?? Number.NaN,
      12,
    );
    expect(partitioned.integratedSweptArea).toBeCloseTo(
      oneShot.integratedSweptArea,
      12,
    );
    expect(partitioned.integratedSolidVolume).toBeCloseTo(
      oneShot.integratedSolidVolume,
      12,
    );
    expect(partitioned.releasedLatentHeat).toBeCloseTo(
      oneShot.releasedLatentHeat,
      12,
    );
    expect(partitioned.undercooling).toBeCloseTo(oneShot.undercooling, 12);
    expectStateLedgersToClose(oneShot);
    expectStateLedgersToClose(partitioned);

    let reversed = advanceCandidate2DTwinSourceState(
      createCandidate2DTwinSourceState(configuration),
      2,
    );
    const areaBeforeReversal = reversed.integratedSweptArea;
    const heatAddedToReverse =
      -configuration.effectiveHeatCapacity * (reversed.undercooling + 0.2);
    reversed = applyCandidate2DTwinSourceHeatRemoval(
      reversed,
      heatAddedToReverse,
    );
    expect(reversed.undercooling).toBeCloseTo(-0.2, 12);
    const stalled = advanceCandidate2DTwinSourceState(reversed, 4);
    expect(stalled.integratedSweptArea).toBeCloseTo(areaBeforeReversal, 12);
    expect(stalled.events).toHaveLength(1);
    expectStateLedgersToClose(stalled);

    const afterCompletion = advanceCandidate2DTwinSourceState(oneShot, 100);
    expect(afterCompletion.events).toHaveLength(1);
    expect(afterCompletion.integratedSweptArea).toBe(
      oneShot.integratedSweptArea,
    );
    expectStateLedgersToClose(afterCompletion);
  });
});
