import { describe, expect, it } from 'vitest';
import {
  CANDIDATE2C_STEP_GATES,
  CANDIDATE2C_STEP_ISOLATION,
  candidate2CGeometryVolume,
  candidate2CLayerBirthRate,
  candidate2CProfileVolume,
  createCandidate2CStepState,
  runCandidate2CStepSteps,
  sampleCandidate2CFacetProfile,
} from './candidate2c';

const gates = CANDIDATE2C_STEP_GATES;

function runToEvaluation(timeStep: number) {
  const configuration = { ...CANDIDATE2C_STEP_ISOLATION, timeStep };
  const steps = Math.round(gates.evaluationTime / timeStep);
  return runCandidate2CStepSteps(
    createCandidate2CStepState(configuration),
    steps,
  );
}

describe('Candidate 2C outer-source facet-step isolation', () => {
  it('keeps a facet immobile when the outer layer source is disabled', () => {
    const state = runCandidate2CStepSteps(
      createCandidate2CStepState({
        ...CANDIDATE2C_STEP_ISOLATION,
        nucleationPrefactor: 0,
      }),
      200,
    );
    expect(state.activeStepRadii).toHaveLength(0);
    expect(state.completedLayers).toBe(0);
    expect(state.integratedSolidVolume).toBe(0);
    expect(state.releasedLatentHeat).toBe(0);
  });

  it('emits outer ledges and moves them inward at the exact constant drive', () => {
    const state = runToEvaluation(CANDIDATE2C_STEP_ISOLATION.timeStep);
    const birthPeriod = 1 / candidate2CLayerBirthRate(state.configuration);
    const expectedRadii = [
      state.configuration.facetRadius -
        state.configuration.stepKineticCoefficient *
          state.configuration.coreUndercooling *
          (gates.evaluationTime - birthPeriod),
      state.configuration.facetRadius -
        state.configuration.stepKineticCoefficient *
          state.configuration.coreUndercooling *
          (gates.evaluationTime - 2 * birthPeriod),
    ];

    expect(state.activeStepRadii).toHaveLength(gates.minimumActiveTerraces);
    for (let index = 0; index < expectedRadii.length; index += 1) {
      expect(state.activeStepRadii[index]).toBeCloseTo(
        expectedRadii[index] ?? Number.NaN,
        11,
      );
    }
    const profile = sampleCandidate2CFacetProfile(state, 257);
    expect(profile.activeTerraceCount).toBe(state.activeStepRadii.length);
    expect(
      profile.openingDepth / state.configuration.stepHeight,
    ).toBeGreaterThanOrEqual(gates.minimumOpeningDepthInSteps);

    const completed = runCandidate2CStepSteps(
      createCandidate2CStepState(
        { ...CANDIDATE2C_STEP_ISOLATION, nucleationPrefactor: 0, timeStep: 1 },
        { activeStepRadii: [0.5] },
      ),
      1,
    );
    expect(completed.activeStepRadii).toHaveLength(0);
    expect(completed.completedLayers).toBe(1);
    expect(completed.integratedSolidVolume).toBeCloseTo(
      Math.PI *
        completed.configuration.stepHeight *
        completed.configuration.facetRadius ** 2,
      12,
    );
  });

  it('integrates a linear radial undercooling without premature births', () => {
    const variable = {
      ...CANDIDATE2C_STEP_ISOLATION,
      nucleationPrefactor: 0,
      coreUndercooling: 1,
      rimUndercooling: 2,
      timeStep: 0.5,
    };
    const initialRadius = 2;
    const state = runCandidate2CStepSteps(
      createCandidate2CStepState(variable, {
        activeStepRadii: [initialRadius],
      }),
      1,
    );
    const difference = variable.rimUndercooling - variable.coreUndercooling;
    const offset =
      (variable.coreUndercooling * variable.facetRadius) / difference;
    const expectedRadius =
      (initialRadius + offset) *
        Math.exp(
          (-variable.stepKineticCoefficient * difference * variable.timeStep) /
            variable.facetRadius,
        ) -
      offset;
    expect(state.activeStepRadii[0]).toBeCloseTo(expectedRadius, 12);

    const noPrematureBirth = runCandidate2CStepSteps(
      createCandidate2CStepState(
        {
          ...CANDIDATE2C_STEP_ISOLATION,
          nucleationBarrier: 0,
          nucleationPrefactor: 2.5e-17,
          timeStep: 1,
        },
        { nucleationAccumulator: 1 - 5e-15 },
      ),
      1,
    );
    expect(noPrematureBirth.emittedLayers).toBe(0);
    expect(noPrematureBirth.nucleationAccumulator).toBeLessThan(1);
  });

  it('closes swept-volume and latent-heat ledgers and refines the profile', () => {
    const state = runToEvaluation(CANDIDATE2C_STEP_ISOLATION.timeStep);
    const geometryVolume = candidate2CGeometryVolume(state);
    expect(
      Math.abs(state.integratedSolidVolume - geometryVolume) / geometryVolume,
    ).toBeLessThanOrEqual(gates.maximumLedgerRelativeError);
    expect(state.releasedLatentHeat).toBeCloseTo(
      geometryVolume * state.configuration.latentHeatPerVolume,
      11,
    );

    const coarseError = Math.abs(
      candidate2CProfileVolume(state, 64) - geometryVolume,
    );
    const fineError = Math.abs(
      candidate2CProfileVolume(state, 512) - geometryVolume,
    );
    expect(fineError).toBeLessThan(coarseError);
    expect(fineError / geometryVolume).toBeLessThanOrEqual(
      gates.maximumFineProfileVolumeError,
    );
  });

  it('preserves ledge positions and the opening under time refinement', () => {
    const coarse = runToEvaluation(0.1);
    const reference = runToEvaluation(0.05);
    const fine = runToEvaluation(0.025);
    expect(coarse.activeStepRadii).toHaveLength(
      reference.activeStepRadii.length,
    );
    expect(fine.activeStepRadii).toHaveLength(reference.activeStepRadii.length);
    for (let index = 0; index < reference.activeStepRadii.length; index += 1) {
      expect(
        Math.abs(
          (coarse.activeStepRadii[index] ?? Number.NaN) -
            (reference.activeStepRadii[index] ?? Number.NaN),
        ),
      ).toBeLessThanOrEqual(gates.maximumTimeRefinementError);
      expect(
        Math.abs(
          (fine.activeStepRadii[index] ?? Number.NaN) -
            (reference.activeStepRadii[index] ?? Number.NaN),
        ),
      ).toBeLessThanOrEqual(gates.maximumTimeRefinementError);
    }
    expect(sampleCandidate2CFacetProfile(coarse, 129).openingDepth).toBeCloseTo(
      sampleCandidate2CFacetProfile(fine, 129).openingDepth,
      11,
    );
  });
});
