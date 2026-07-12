import { describe, expect, it } from 'vitest';
import type { FieldSummary } from '../simulation/metrics';
import {
  evaluateValidationProfile,
  isScreeningValidationProfile,
  type FixtureMode,
  type ValidationProfileConfiguration,
  type ValidationProfileFields,
  type ValidationProfileMorphology,
  type ValidationProfileRuntime,
} from './morphology-validation-profile';

const summary = (
  minimum: number,
  maximum: number,
  nonFiniteCount = 0,
): FieldSummary => ({
  minimum,
  maximum,
  mean: (minimum + maximum) / 2,
  finiteCount: 128 ** 3 - nonFiniteCount,
  nonFiniteCount,
});

const quickConfiguration: ValidationProfileConfiguration = {
  grid: [128, 128, 128],
  workgroup: [4, 4, 4],
  precision: 'float32',
  spacing: 2,
  timeStep: 0.01,
  steps: 50_000,
  simulatedTime: 500,
  phaseOperator: 'conservative-flux',
  domainMode: 'full',
  liquidDiffusivity: 1 / 12,
  farFieldChemicalPotential: 0.04,
  criticalRadius: 10,
  initialRadius: 20,
  interfaceWidth: 2,
  surfaceEnergyNormalization: 0.3203895937459951,
  perturbations: {
    seed: 0x5eeda11,
    seedRadiusAmplitude: 0.3,
    seedRadiusCorrelationLength: 8,
    chemicalPotentialAmplitude: 0.006,
    chemicalPotentialCorrelationLength: 12,
    farFieldGradient: [0.00018, -0.0001, 0.00014],
  },
};

const quickFields: ValidationProfileFields = {
  phase: summary(0, 1),
  chemicalPotential: summary(-0.01334, 1.5161),
  solidificationTime: summary(-1, 500),
};

const quickMorphology: ValidationProfileMorphology = {
  solidVoxelCount: 92_799,
  solidExtent: [100, 100, 100],
  symmetryError: 0.00754,
  faceCenterDepression: 8,
  minimumFaceCenterDepression: 6,
  maximumFaceCenterDepression: 10,
  boundaryClearance: 74,
  boundaryClearanceRatio: 1.48,
  surfaceVoxelCount: 13_466,
  boundingBoxFillFraction: 0.6996,
  surfaceToVolumeRatio: 0.145,
  surfaceComplexity: 6.57,
  faceReach: 39,
  edgeReach: 45.5,
  bodyDiagonalReach: 46.5,
  bodyDiagonalToFaceReachRatio: 1.192,
  occupiedBodyDiagonalArms: 8,
  connectedComponentCount: 1,
  largestConnectedComponentFraction: 1,
};

const quickRuntime: ValidationProfileRuntime = {
  budgetMilliseconds: 25_000,
  fixtureWallMilliseconds: 15_500,
  passed: true,
};

interface QuickOverrides {
  readonly mode?: FixtureMode;
  readonly configuration?: Partial<ValidationProfileConfiguration>;
  readonly fields?: Partial<ValidationProfileFields>;
  readonly morphology?: Partial<ValidationProfileMorphology>;
  readonly runtime?: Partial<ValidationProfileRuntime>;
}

function evaluateQuick(overrides: QuickOverrides = {}) {
  return evaluateValidationProfile(
    'hopper-quick',
    overrides.mode ?? 'perturbed',
    'hopper',
    { ...quickConfiguration, ...overrides.configuration },
    { ...quickFields, ...overrides.fields },
    { ...quickMorphology, ...overrides.morphology },
    { ...quickRuntime, ...overrides.runtime },
  );
}

describe('morphology validation profiles', () => {
  it('accepts the calibrated quick checkpoint', () => {
    expect(evaluateQuick()).toEqual({
      profile: 'hopper-quick',
      failures: [],
      passed: true,
    });
  });

  it.each([
    ['mode', { mode: 'baseline' as const }, 'mode must be perturbed'],
    [
      'grid',
      { configuration: { grid: [127, 128, 128] as const } },
      'grid must be 128^3',
    ],
    [
      'extent',
      { morphology: { solidExtent: [104, 100, 100] as const } },
      'solid extent left 98..102',
    ],
    [
      'volume',
      { morphology: { solidVoxelCount: 90_999 } },
      'solid voxel count left 91000..94500',
    ],
    [
      'mean recession',
      { morphology: { faceCenterDepression: 10.01 } },
      'mean face recession left 6..10',
    ],
    [
      'face recession',
      { morphology: { minimumFaceCenterDepression: 3.99 } },
      'face recession range left 4..12',
    ],
    [
      'clearance',
      { morphology: { boundaryClearanceRatio: 1.399 } },
      'boundary-clearance ratio left 1.4..1.6',
    ],
    [
      'surface',
      { morphology: { surfaceVoxelCount: 12_999 } },
      'surface voxel count left 13000..14000',
    ],
    [
      'fill',
      { morphology: { boundingBoxFillFraction: 0.721 } },
      'bounding-box fill left 0.68..0.72',
    ],
    [
      'symmetry',
      { morphology: { symmetryError: 0.0091 } },
      'symmetry error left 0.006..0.009',
    ],
    [
      'connectivity',
      { morphology: { connectedComponentCount: 2 } },
      'solid must remain one connected component',
    ],
    [
      'finiteness',
      { fields: { phase: summary(0, 1, 1) } },
      'fields must remain finite',
    ],
    [
      'chemical range',
      { fields: { chemicalPotential: summary(-0.013, 1.581) } },
      'chemical-potential extrema left the calibrated envelope',
    ],
    [
      'runtime',
      { runtime: { passed: false } },
      'runtime must pass the 25000 ms budget',
    ],
  ] as const)(
    'rejects a quick-profile %s regression',
    (_name, patch, failure) => {
      const result = evaluateQuick(patch);
      expect(result?.passed).toBe(false);
      expect(result?.failures).toContain(failure);
    },
  );

  it('accepts the paired reference checkpoint and symmetric acceptance config', () => {
    const referenceConfiguration: ValidationProfileConfiguration = {
      ...quickConfiguration,
      grid: [256, 256, 256],
      spacing: 1,
    };
    const referenceMorphology: ValidationProfileMorphology = {
      ...quickMorphology,
      solidVoxelCount: 743_922,
      solidExtent: [100, 100, 100],
      symmetryError: 0.00647,
      faceCenterDepression: 7.833,
      boundaryClearanceRatio: 1.5,
      surfaceVoxelCount: 54_603,
      boundingBoxFillFraction: 0.722,
    };
    const referenceFields: ValidationProfileFields = {
      ...quickFields,
      chemicalPotential: summary(-0.01355, 1.53323),
    };

    expect(
      evaluateValidationProfile(
        'hopper-reference',
        'perturbed',
        'hopper',
        referenceConfiguration,
        referenceFields,
        referenceMorphology,
        { ...quickRuntime, budgetMilliseconds: null },
      )?.passed,
    ).toBe(true);

    expect(
      evaluateValidationProfile(
        'hopper-acceptance',
        'baseline',
        'hopper',
        {
          ...referenceConfiguration,
          perturbations: {
            ...referenceConfiguration.perturbations,
            seedRadiusAmplitude: 0,
            chemicalPotentialAmplitude: 0,
            farFieldGradient: [0, 0, 0],
          },
        },
        referenceFields,
        referenceMorphology,
        { ...quickRuntime, budgetMilliseconds: null },
      )?.passed,
    ).toBe(true);
  });

  it('does not apply a named envelope to generic exploratory runs', () => {
    expect(
      evaluateValidationProfile(
        null,
        'perturbed',
        'fractal',
        quickConfiguration,
        quickFields,
        quickMorphology,
        quickRuntime,
      ),
    ).toBeNull();
  });

  it.each([
    ['dl4-screen-control', 128, 2, 0.01, 35_000, 25_000],
    ['dl4-screen-quick', 128, 2, 0.005, 70_000, 25_000],
    ['dl4-screen-reference', 256, 1, 0.005, 70_000, null],
  ] as const)(
    'accepts the healthy %s configuration without requiring a mature dendrite',
    (profile, grid, spacing, timeStep, steps, budgetMilliseconds) => {
      const control = profile === 'dl4-screen-control';
      const reference = profile === 'dl4-screen-reference';
      const configuration: ValidationProfileConfiguration = {
        ...quickConfiguration,
        grid: [grid, grid, grid],
        spacing,
        timeStep,
        steps,
        simulatedTime: 350,
        phaseOperator: 'author-centered',
        domainMode: 'octant',
        liquidDiffusivity: 4,
        perturbations: {
          ...quickConfiguration.perturbations,
          seedRadiusAmplitude: 0,
          chemicalPotentialAmplitude: 0,
          farFieldGradient: [0, 0, 0],
        },
      };
      const morphology: ValidationProfileMorphology = {
        ...quickMorphology,
        solidVoxelCount: control ? 48_604 : reference ? 383_523 : 48_613,
        solidExtent: [144, 144, 144],
        symmetryError: 0,
        faceCenterDepression: reference ? 1 : 2,
        minimumFaceCenterDepression: reference ? 1 : 2,
        maximumFaceCenterDepression: reference ? 1 : 2,
        boundaryClearanceRatio: reference
          ? 2.5416666666666665
          : 2.5277777777777777,
        surfaceVoxelCount: control ? 3_730 : reference ? 15_219 : 3_733,
        boundingBoxFillFraction: control
          ? 0.9595482992122876
          : reference
            ? 0.985877223874535
            : 0.9597259787179436,
        surfaceComplexity: control
          ? 5.921186831431862
          : reference
            ? 5.928723874119006
            : 5.924960525215747,
        faceReach: reference ? 71 : 70,
        edgeReach: reference ? 71 : 70,
        bodyDiagonalReach: reference ? 71 : 72,
        bodyDiagonalToFaceReachRatio: reference ? 1 : 72 / 70,
      };
      const result = evaluateValidationProfile(
        profile,
        'baseline',
        'dendritic',
        configuration,
        {
          ...quickFields,
          chemicalPotential: summary(
            0.03999999910593033,
            reference ? 0.9998964071273804 : 0.9997537136077881,
          ),
          solidificationTime: summary(-1, 350),
        },
        morphology,
        {
          budgetMilliseconds,
          fixtureWallMilliseconds: 20_000,
          passed: true,
        },
      );

      expect(isScreeningValidationProfile(profile)).toBe(true);
      expect(result).toEqual({ profile, failures: [], passed: true });
    },
  );

  it.each([
    ['mode', { mode: 'perturbed' as const }, 'mode must be baseline'],
    [
      'expected morphology',
      { expectedMorphology: 'hopper' as const },
      'expected morphology must be dendritic',
    ],
    [
      'operator',
      { configuration: { phaseOperator: 'conservative-flux' as const } },
      'operator must be author-centered',
    ],
    [
      'domain',
      { configuration: { domainMode: 'full' as const } },
      'domain must be octant',
    ],
    [
      'grid',
      { configuration: { grid: [127, 128, 128] as const } },
      'grid must be 128^3',
    ],
    ['spacing', { configuration: { spacing: 1 } }, 'spacing must be 2'],
    [
      'time step',
      { configuration: { timeStep: 0.01 } },
      'time step must be 0.005',
    ],
    ['step count', { configuration: { steps: 69_999 } }, 'steps must be 70000'],
    [
      'simulated time',
      { configuration: { simulatedTime: 349.995 } },
      'simulated time must be 350',
    ],
    [
      'diffusivity',
      { configuration: { liquidDiffusivity: 0.5 } },
      'liquid diffusivity must be 4',
    ],
    [
      'far-field chemical potential',
      { configuration: { farFieldChemicalPotential: 0.05 } },
      'far-field chemical potential must be 0.04',
    ],
    [
      'length scale',
      { configuration: { initialRadius: 19 } },
      'Rc/R0/delta must be 10/20/2',
    ],
    [
      'surface normalization',
      { configuration: { surfaceEnergyNormalization: 0.32 } },
      'surface-energy normalization changed',
    ],
    [
      'perturbation signature',
      {
        configuration: {
          perturbations: {
            ...quickConfiguration.perturbations,
            seedRadiusAmplitude: 0.1,
            chemicalPotentialAmplitude: 0,
            farFieldGradient: [0, 0, 0] as const,
          },
        },
      },
      'symmetric initial and reservoir conditions changed',
    ],
    [
      'finiteness',
      { fields: { phase: summary(0, 1, 1) } },
      'fields must remain finite',
    ],
    [
      'phase range',
      { fields: { phase: summary(-0.021, 1) } },
      'phase range left -0.02..1.02',
    ],
    [
      'connectivity',
      { morphology: { connectedComponentCount: 2 } },
      'solid must remain one connected component',
    ],
    [
      'clearance',
      { morphology: { boundaryClearanceRatio: 0.99 } },
      'boundary-clearance ratio must be at least 1',
    ],
    [
      'reach',
      { morphology: { bodyDiagonalReach: 86 } },
      'body-diagonal reach left the calibrated +/-2 envelope',
    ],
    [
      'chemical extrema',
      { fields: { chemicalPotential: summary(0.04, 1.03) } },
      'chemical-potential extrema left the calibrated envelope',
    ],
    [
      'runtime',
      { runtime: { passed: false } },
      'runtime must pass the 25000 ms budget',
    ],
  ] as const)(
    'rejects a D_L=4 screen %s regression',
    (_name, overrides, failure) => {
      const configuration: ValidationProfileConfiguration = {
        ...quickConfiguration,
        grid: [128, 128, 128],
        spacing: 2,
        timeStep: 0.005,
        steps: 70_000,
        simulatedTime: 350,
        phaseOperator: 'author-centered',
        domainMode: 'octant',
        liquidDiffusivity: 4,
        perturbations: {
          ...quickConfiguration.perturbations,
          seedRadiusAmplitude: 0,
          chemicalPotentialAmplitude: 0,
          farFieldGradient: [0, 0, 0],
        },
        ...('configuration' in overrides ? overrides.configuration : {}),
      };
      const morphology: ValidationProfileMorphology = {
        ...quickMorphology,
        solidVoxelCount: 48_613,
        solidExtent: [144, 144, 144],
        symmetryError: 0,
        faceCenterDepression: 2,
        minimumFaceCenterDepression: 2,
        maximumFaceCenterDepression: 2,
        boundaryClearanceRatio: 2.5277777777777777,
        surfaceVoxelCount: 3_733,
        boundingBoxFillFraction: 0.9597259787179436,
        surfaceComplexity: 5.924960525215747,
        faceReach: 70,
        edgeReach: 70,
        bodyDiagonalReach: 72,
        bodyDiagonalToFaceReachRatio: 72 / 70,
        ...('morphology' in overrides ? overrides.morphology : {}),
      };
      const runtime: ValidationProfileRuntime = {
        budgetMilliseconds: 25_000,
        fixtureWallMilliseconds: 20_000,
        passed: true,
        ...('runtime' in overrides ? overrides.runtime : {}),
      };
      const fields: ValidationProfileFields = {
        ...quickFields,
        chemicalPotential: summary(0.03999999910593033, 0.9997537136077881),
        solidificationTime: summary(-1, 350),
        ...('fields' in overrides ? overrides.fields : {}),
      };
      const result = evaluateValidationProfile(
        'dl4-screen-quick',
        'mode' in overrides ? overrides.mode : 'baseline',
        'expectedMorphology' in overrides
          ? overrides.expectedMorphology
          : 'dendritic',
        configuration,
        fields,
        morphology,
        runtime,
      );

      expect(result?.passed).toBe(false);
      expect(result?.failures).toContain(failure);
    },
  );

  it('only classifies the dedicated D_L=4 profiles as screening profiles', () => {
    expect(isScreeningValidationProfile(null)).toBe(false);
    expect(isScreeningValidationProfile('hopper-quick')).toBe(false);
    expect(isScreeningValidationProfile('hopper-reference')).toBe(false);
  });
});
