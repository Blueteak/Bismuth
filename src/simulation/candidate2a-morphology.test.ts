import { describe, expect, it } from 'vitest';
import {
  createInitialCandidate2AThermalState,
  deriveCandidate2AThermalConfiguration,
} from './candidate2a';
import {
  CANDIDATE2A_MORPHOLOGY_CRITICAL_WULFF_SCALE,
  CANDIDATE2A_MORPHOLOGY_SCREEN_CHECKPOINTS,
  CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS,
  CANDIDATE2A_MORPHOLOGY_SEED_RADIUS,
  classifyCandidate2AMorphologyMetrics,
  createCandidate2AMorphologyScreenConfiguration,
  measureCandidate2AMorphology,
  type Candidate2AMorphologyMetricSet,
  type Candidate2AMorphologyMetrics,
} from './candidate2a-morphology';

function passingMetrics(
  step: number,
  overrides: Partial<Candidate2AMorphologyMetrics> = {},
): Candidate2AMorphologyMetrics {
  return {
    step,
    finite: true,
    maximumAbsoluteOrderParameter: 1,
    solidVoxelCount: 1000,
    mainComponentVoxelCount: 1000,
    mainComponentFraction: 1,
    secondLargestComponentVoxelCount: 0,
    seedBelongsToMainComponent: true,
    attachedToFreeSurface: true,
    fiveFaceClearance: 3,
    diffuseMaturity: 1.1,
    projectedVoxelCount: 100,
    projectedArea: 56.25,
    projectedEquivalentRadius: 4.23,
    rimHeight: 8,
    coreHeight: 6,
    openingDepth: 2,
    normalizedOpeningDepth: 0.2,
    recessedProjectedVoxelCount: 10,
    dominantRecessedVoxelCount: 10,
    dominantRecessedFraction: 1,
    openingProjectedFill: 0.1,
    projectedConvexFill: 0.9,
    ...overrides,
  };
}

function passingMetricSet(): Candidate2AMorphologyMetricSet {
  return {
    initial: passingMetrics(0, {
      diffuseMaturity: 1,
      openingDepth: 0,
      normalizedOpeningDepth: 0,
      recessedProjectedVoxelCount: 0,
      dominantRecessedVoxelCount: 0,
      dominantRecessedFraction: 0,
      openingProjectedFill: 0,
    }),
    midpoint: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.midpoint, {
      diffuseMaturity: 1.05,
      normalizedOpeningDepth: 0.1,
    }),
    late: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.late, {
      normalizedOpeningDepth: 0.16,
    }),
    final: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total),
  };
}

describe('Candidate 2A conditional morphology screen', () => {
  it('resolves the predeclared seed above critical size on the intended grid', () => {
    const configuration = createCandidate2AMorphologyScreenConfiguration();
    const derived = deriveCandidate2AThermalConfiguration(configuration);

    expect(configuration.shape).toEqual([41, 25, 41]);
    expect(configuration.interfaceWidth / configuration.spacing).toBe(2);
    expect(derived.criticalWulffScale).toBeCloseTo(
      CANDIDATE2A_MORPHOLOGY_CRITICAL_WULFF_SCALE,
      12,
    );
    expect(
      CANDIDATE2A_MORPHOLOGY_CRITICAL_WULFF_SCALE / configuration.spacing,
    ).toBeGreaterThan(8);
    expect(CANDIDATE2A_MORPHOLOGY_SEED_RADIUS).toBeCloseTo(
      1.5 * derived.criticalWulffScale,
      12,
    );
    expect(configuration.timeStep).toBeLessThanOrEqual(
      derived.maximumStableTimeStep,
    );
    expect(CANDIDATE2A_MORPHOLOGY_SCREEN_CHECKPOINTS).toHaveLength(17);
    expect(CANDIDATE2A_MORPHOLOGY_SCREEN_CHECKPOINTS.at(-1)).toBe(1600);
  });

  it('keeps failure labels ordered before the screen-pass result', () => {
    const passing = passingMetricSet();
    expect(classifyCandidate2AMorphologyMetrics(passing)).toBe('screen-pass');

    expect(
      classifyCandidate2AMorphologyMetrics({
        ...passing,
        initial: passingMetrics(0, {
          finite: false,
          mainComponentFraction: 0,
          fiveFaceClearance: 0,
        }),
      }),
    ).toBe('invalid');

    expect(
      classifyCandidate2AMorphologyMetrics({
        ...passing,
        midpoint: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.midpoint, {
          secondLargestComponentVoxelCount: 8,
          fiveFaceClearance: 0,
          diffuseMaturity: 1,
        }),
      }),
    ).toBe('disconnected');

    expect(
      classifyCandidate2AMorphologyMetrics({
        ...passing,
        late: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.late, {
          fiveFaceClearance: 2.99,
        }),
        final: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total, {
          diffuseMaturity: 1,
          openingDepth: 0,
        }),
      }),
    ).toBe('boundary-limited');

    expect(
      classifyCandidate2AMorphologyMetrics({
        ...passing,
        midpoint: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.midpoint, {
          diffuseMaturity: 1.049,
        }),
        final: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total, {
          openingDepth: 0,
        }),
      }),
    ).toBe('immature');

    expect(
      classifyCandidate2AMorphologyMetrics({
        ...passing,
        final: passingMetrics(CANDIDATE2A_MORPHOLOGY_SCREEN_STEPS.total, {
          openingDepth: 1.49,
        }),
      }),
    ).toBe('non-hopper');
  });

  it('marks a non-finite coupled temperature field invalid', () => {
    const initial = createInitialCandidate2AThermalState(
      createCandidate2AMorphologyScreenConfiguration(),
    );
    const temperature = new Float32Array(initial.temperature);
    temperature[0] = Number.NaN;
    const metrics = measureCandidate2AMorphology(
      { ...initial, temperature },
      initial,
    );
    expect(metrics.finite).toBe(false);
  });
});
