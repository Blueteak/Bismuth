import { describe, expect, it } from 'vitest';
import {
  CANDIDATE2B_PERIMETER_GATES,
  CANDIDATE2B_PERIMETER_ISOLATION,
  measureCandidate2BPerimeterSignal,
  solveCandidate2BSurfaceIsolation,
  type Candidate2BSurfaceIsolationConfiguration,
} from './candidate2b';

const gates = CANDIDATE2B_PERIMETER_GATES;

function measurementFor(
  configuration: Candidate2BSurfaceIsolationConfiguration,
) {
  return measureCandidate2BPerimeterSignal(
    solveCandidate2BSurfaceIsolation(configuration),
    gates,
  );
}

describe('Candidate 2B surface-incorporation isolation', () => {
  it('reduces to local material supply without diffusion or tau contrast', () => {
    for (const configuration of [
      { ...CANDIDATE2B_PERIMETER_ISOLATION, surfaceMobility: 0 },
      {
        ...CANDIDATE2B_PERIMETER_ISOLATION,
        sideIncorporationTime:
          CANDIDATE2B_PERIMETER_ISOLATION.topIncorporationTime,
      },
    ]) {
      const result = solveCandidate2BSurfaceIsolation(configuration);
      for (const velocity of result.normalVelocity) {
        expect(velocity).toBeCloseTo(configuration.topSupply, 11);
      }
      expect(
        measureCandidate2BPerimeterSignal(result, gates).normalizedRimExcess,
      ).toBeCloseTo(0, 11);
    }

    const noSupply = solveCandidate2BSurfaceIsolation({
      ...CANDIDATE2B_PERIMETER_ISOLATION,
      topSupply: 0,
      sideSupply: 0,
    });
    expect(() => measureCandidate2BPerimeterSignal(noSupply, gates)).toThrow(
      'finite positive core velocity',
    );
  });

  it('conserves supplied material and resolves the quasi-stationary equation', () => {
    const result = solveCandidate2BSurfaceIsolation(
      CANDIDATE2B_PERIMETER_ISOLATION,
    );
    expect(result.normalizedSupplyBalanceError).toBeLessThanOrEqual(
      gates.maximumNormalizedBalanceError,
    );
    expect(result.normalizedEquationResidual).toBeLessThanOrEqual(
      gates.maximumNormalizedEquationResidual,
    );
  });

  it('moves material from slow side facets into the top perimeter', () => {
    const forward = measurementFor(CANDIDATE2B_PERIMETER_ISOLATION);
    expect(forward.normalizedRimExcess).toBeGreaterThanOrEqual(
      gates.minimumNormalizedRimExcess,
    );

    const reversed = measurementFor({
      ...CANDIDATE2B_PERIMETER_ISOLATION,
      topIncorporationTime:
        CANDIDATE2B_PERIMETER_ISOLATION.sideIncorporationTime,
      sideIncorporationTime:
        CANDIDATE2B_PERIMETER_ISOLATION.topIncorporationTime,
    });
    expect(reversed.normalizedRimExcess).toBeLessThan(0);

    const scaledSupply = measurementFor({
      ...CANDIDATE2B_PERIMETER_ISOLATION,
      topSupply: 2,
      sideSupply: 2,
    });
    expect(scaledSupply.normalizedRimExcess).toBeCloseTo(
      forward.normalizedRimExcess,
      11,
    );
  });

  it('keeps the normalized perimeter signal under grid refinement', () => {
    const coarse = measurementFor({
      ...CANDIDATE2B_PERIMETER_ISOLATION,
      // Multiples of three put the two physical facet joins on cell faces.
      cellCount: 399,
    });
    const reference = measurementFor(CANDIDATE2B_PERIMETER_ISOLATION);
    const fine = measurementFor({
      ...CANDIDATE2B_PERIMETER_ISOLATION,
      cellCount: 1599,
    });
    expect(
      Math.abs(coarse.normalizedRimExcess - reference.normalizedRimExcess),
    ).toBeLessThanOrEqual(gates.maximumRefinementDifference);
    expect(
      Math.abs(fine.normalizedRimExcess - reference.normalizedRimExcess),
    ).toBeLessThanOrEqual(gates.maximumRefinementDifference);
  });
});
