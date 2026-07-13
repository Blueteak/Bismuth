import { describe, expect, it } from 'vitest';
import {
  CANDIDATE2C_THERMAL_STEP_GATES,
  CANDIDATE2C_THERMAL_STEP_ISOLATION,
  candidate2CThermalEnergy,
  candidate2CThermalStepOpeningDepth,
  createCandidate2CThermalStepState,
  runCandidate2CThermalStepSteps,
  type Candidate2CThermalStepState,
} from './candidate2c-thermal';

const gates = CANDIDATE2C_THERMAL_STEP_GATES;

function runIsolation(radialCellCount: number, timeStep: number) {
  const configuration = {
    ...CANDIDATE2C_THERMAL_STEP_ISOLATION,
    radialCellCount,
    timeStep,
  };
  return runCandidate2CThermalStepSteps(
    createCandidate2CThermalStepState(configuration),
    Math.round(gates.evaluationTime / timeStep),
  );
}

describe('Candidate 2C radial thermal-step coupling', () => {
  it('removes the rim source when the external heat-flux contrast is zero', () => {
    const configuration = {
      ...CANDIDATE2C_THERMAL_STEP_ISOLATION,
      rimRobinCoefficient: 0,
    };
    const state = runCandidate2CThermalStepSteps(
      createCandidate2CThermalStepState(configuration),
      Math.round(gates.evaluationTime / configuration.timeStep),
    );
    expect(state.temperature.every((value) => value === 0)).toBe(true);
    expect(state.emittedLayers).toBe(0);
    expect(state.activeStepRadii).toHaveLength(0);
    expect(state.integratedSolidVolume).toBe(0);
  });

  it('generates a colder rim, outer ledges, and a stepped opening', () => {
    const state = runIsolation(
      CANDIDATE2C_THERMAL_STEP_ISOLATION.radialCellCount,
      CANDIDATE2C_THERMAL_STEP_ISOLATION.timeStep,
    );
    expect(state.temperature.at(-1)).toBeLessThan(state.temperature[0] ?? 0);
    expect(state.emittedLayers).toBeGreaterThanOrEqual(
      gates.minimumEmittedLayers,
    );
    expect(state.activeStepRadii.length).toBeGreaterThanOrEqual(
      gates.minimumActiveTerraces,
    );
    expect(candidate2CThermalStepOpeningDepth(state)).toBeGreaterThan(0);
    expect(
      state.activeStepRadii.every(
        (radius) => radius > 0 && radius <= state.configuration.facetRadius,
      ),
    ).toBe(true);
  });

  it('closes external heat and swept latent heat in one thermal ledger', () => {
    const state = runIsolation(
      CANDIDATE2C_THERMAL_STEP_ISOLATION.radialCellCount,
      CANDIDATE2C_THERMAL_STEP_ISOLATION.timeStep,
    );
    const expectedEnergy =
      state.initialThermalEnergy +
      state.cumulativeExternalHeat +
      state.cumulativeLatentHeat;
    const scale = Math.max(1, Math.abs(expectedEnergy));
    expect(
      Math.abs(candidate2CThermalEnergy(state) - expectedEnergy) / scale,
    ).toBeLessThanOrEqual(gates.maximumEnergyRelativeError);
    expect(state.cumulativeLatentHeat).toBeCloseTo(
      state.integratedSolidVolume * state.configuration.latentHeatPerVolume,
      11,
    );
  });

  it('independently refines the cold-rim drive in space and time', () => {
    const rimUndercooling = (state: Candidate2CThermalStepState) =>
      -(state.temperature.at(-1) ?? Number.NaN);
    const layerClock = (state: Candidate2CThermalStepState) =>
      state.emittedLayers + state.nucleationAccumulator;

    const spatialCoarse = runIsolation(32, 0.00025);
    const reference = runIsolation(64, 0.00025);
    const spatialFine = runIsolation(128, 0.00025);
    const spatialCoarseRimError = Math.abs(
      rimUndercooling(spatialCoarse) - rimUndercooling(reference),
    );
    const spatialFineRimError = Math.abs(
      rimUndercooling(reference) - rimUndercooling(spatialFine),
    );
    const spatialCoarseClockError = Math.abs(
      layerClock(spatialCoarse) - layerClock(reference),
    );
    const spatialFineClockError = Math.abs(
      layerClock(reference) - layerClock(spatialFine),
    );
    expect(spatialFineRimError).toBeLessThan(spatialCoarseRimError);
    expect(spatialFineClockError).toBeLessThan(spatialCoarseClockError);

    const timeCoarse = runIsolation(64, 0.001);
    const timeReference = runIsolation(64, 0.0005);
    const timeFine = runIsolation(64, 0.00025);
    const timeCoarseError = Math.abs(
      layerClock(timeCoarse) - layerClock(timeReference),
    );
    const timeFineError = Math.abs(
      layerClock(timeReference) - layerClock(timeFine),
    );
    expect(timeFineError).toBeLessThan(timeCoarseError);

    for (const comparison of [spatialCoarse, spatialFine]) {
      expect(
        Math.abs(rimUndercooling(comparison) - rimUndercooling(reference)) /
          Math.abs(rimUndercooling(reference)),
      ).toBeLessThanOrEqual(gates.maximumRefinementDifference);
      expect(
        Math.abs(layerClock(comparison) - layerClock(reference)) /
          Math.abs(layerClock(reference)),
      ).toBeLessThanOrEqual(gates.maximumRefinementDifference);
    }
  });
});
