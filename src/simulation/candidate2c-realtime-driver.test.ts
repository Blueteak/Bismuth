import { describe, expect, it } from 'vitest';
import {
  CANDIDATE2C_REALTIME_DRIVER_PROOF,
  candidate2CRealtimeDriverLedger,
  createCandidate2CRealtimeDriverState,
  runCandidate2CRealtimeDriverSteps,
} from './candidate2c-realtime-driver';

describe('Candidate 2C realtime source driver', () => {
  it('closes the reduced energy ledger while producing nested explicit ledges', () => {
    const proof = CANDIDATE2C_REALTIME_DRIVER_PROOF;
    const state = runCandidate2CRealtimeDriverSteps(
      createCandidate2CRealtimeDriverState(proof.configuration),
      proof.totalSteps,
    );
    const ledger = candidate2CRealtimeDriverLedger(state);
    expect(state.faceted.emittedLayers).toBeGreaterThanOrEqual(
      proof.minimumEmittedLayers,
    );
    expect(state.faceted.activeLoopOffsets.length).toBeGreaterThanOrEqual(
      proof.minimumActiveTerraces,
    );
    expect(
      state.faceted.activeLoopOffsets.length * state.configuration.stepHeight,
    ).toBeGreaterThanOrEqual(
      proof.minimumOpeningDepthInSteps * state.configuration.stepHeight,
    );
    expect(state.loopCrossingDetected).toBe(false);
    expect(ledger.normalizedResidual).toBeLessThanOrEqual(
      proof.maximumNormalizedEnergyResidual,
    );
    expect(state.undercooling).toBeGreaterThan(0);
  });

  it('remains immobile without initial cold content or external cooling', () => {
    const configuration = {
      ...CANDIDATE2C_REALTIME_DRIVER_PROOF.configuration,
      initialUndercooling: 0,
      externalCoolingPower: 0,
    };
    const state = runCandidate2CRealtimeDriverSteps(
      createCandidate2CRealtimeDriverState(configuration),
      CANDIDATE2C_REALTIME_DRIVER_PROOF.totalSteps,
    );
    expect(state.faceted.emittedLayers).toBe(0);
    expect(state.faceted.integratedSolidVolume).toBe(0);
    expect(state.undercooling).toBe(0);
    expect(candidate2CRealtimeDriverLedger(state).normalizedResidual).toBe(0);
  });
});
