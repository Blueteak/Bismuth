import { describe, expect, it } from 'vitest';

import {
  CANDIDATE2D_EDGE_SOURCE_PROOF,
  advanceCandidate2DEdgeSourceState,
  candidate2DEdgeSourceLedger,
  createCandidate2DEdgeSourceState,
  runCandidate2DEdgeSourceDiscriminator,
  setCandidate2DEdgeSourceHeatRemovalRate,
  type Candidate2DEdgeSourceState,
} from './candidate2d-edge-source';

function expectLedgerToClose(state: Candidate2DEdgeSourceState): void {
  const ledger = candidate2DEdgeSourceLedger(state);
  expect(ledger.normalizedResidual).toBeLessThanOrEqual(
    CANDIDATE2D_EDGE_SOURCE_PROOF.maximumNormalizedLedgerResidual,
  );
}

describe('Candidate 2D edge/free-surface source', () => {
  it('emits one downward front only from the seeded three-phase contact under positive driving', () => {
    const result = runCandidate2DEdgeSourceDiscriminator();

    expect(result.classification).toBe('passes-one-edge-front-isolation');
    expect(result.localSourceIsolationPasses).toBe(true);
    expect(result.forward.eligibility).toMatchObject({
      seedPresent: true,
      contactOnFreeSurface: true,
      seedTerminatesAtContact: true,
      seedApproachesFromNonLiquid: true,
      growthDirectionIntoLiquid: true,
      realThreePhaseContact: true,
      eligible: true,
    });
    expect(result.forward.events).toHaveLength(1);
    expect(result.forward.events[0]?.growthDirection).toEqual([0, -1]);
    expect(result.forward.front?.complete).toBe(true);
    expect(result.forward.front?.distance).toBe(
      result.forward.configuration.maximumFrontTravel,
    );
    for (const inactive of [
      result.noSeed,
      result.nonTerminatingSeed,
      result.contactOffSurface,
      result.seedInLiquid,
      result.zeroDriving,
      result.reversed,
    ]) {
      expect(inactive.events).toHaveLength(0);
      expect(inactive.front).toBeNull();
      expect(inactive.integratedSolidVolume).toBe(0);
      expectLedgerToClose(inactive);
    }
    expect(result.acceptedAsTargetSource).toBe(false);
    expect(result.acceptedMorphology).toBe(false);
    expect(result.persistentSupplyDemonstrated).toBe(false);
    expect(result.routeSelectionDemonstrated).toBe(false);
    expect(result.nextAction).toBe('strategy-review');
    expectLedgerToClose(result.forward);
  });

  it('closes the Stefan ledger, is partition invariant, and stalls after reversal', () => {
    const configuration = CANDIDATE2D_EDGE_SOURCE_PROOF.configuration;
    const oneShot = advanceCandidate2DEdgeSourceState(
      createCandidate2DEdgeSourceState(configuration),
      4,
    );
    let partitioned = createCandidate2DEdgeSourceState(configuration);
    for (const duration of [0.25, 0.75, 1.125, 0.375, 1.5]) {
      partitioned = advanceCandidate2DEdgeSourceState(partitioned, duration);
    }

    expect(partitioned.front?.distance).toBeCloseTo(
      oneShot.front?.distance ?? -1,
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
    expect(partitioned.cumulativeStefanHeatRemoved).toBeCloseTo(
      oneShot.cumulativeStefanHeatRemoved,
      12,
    );
    expectLedgerToClose(oneShot);
    expectLedgerToClose(partitioned);

    const beforeReversal = advanceCandidate2DEdgeSourceState(
      createCandidate2DEdgeSourceState(configuration),
      2,
    );
    const reversed = setCandidate2DEdgeSourceHeatRemovalRate(
      beforeReversal,
      -configuration.initialHeatRemovalRate,
    );
    const stalled = advanceCandidate2DEdgeSourceState(reversed, 4);
    expect(stalled.front?.distance).toBeCloseTo(
      beforeReversal.front?.distance ?? -1,
      12,
    );
    expect(stalled.integratedSolidVolume).toBeCloseTo(
      beforeReversal.integratedSolidVolume,
      12,
    );
    expect(stalled.events).toHaveLength(1);
    expectLedgerToClose(stalled);

    const afterCompletion = advanceCandidate2DEdgeSourceState(
      runCandidate2DEdgeSourceDiscriminator().forward,
      100,
    );
    expect(afterCompletion.events).toHaveLength(1);
    expect(afterCompletion.integratedSolidVolume).toBe(
      runCandidate2DEdgeSourceDiscriminator().forward.integratedSolidVolume,
    );
    expectLedgerToClose(afterCompletion);
  });
});
