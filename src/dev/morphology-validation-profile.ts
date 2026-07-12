import type {
  DomainMode,
  GridShape,
  PerturbationConfiguration,
  PhaseOperator,
  SimulationPresetName,
} from '../simulation/config';
import type { FieldSummary } from '../simulation/metrics';

export type FixtureMode = 'baseline' | 'perturbed';

export type ValidationProfile =
  | 'hopper-quick'
  | 'hopper-reference'
  | 'hopper-acceptance'
  | 'dl4-screen-control'
  | 'dl4-screen-quick'
  | 'dl4-screen-reference';

export interface ValidationProfileConfiguration {
  readonly grid: GridShape;
  readonly workgroup: readonly [number, number, number];
  readonly precision: 'float32';
  readonly spacing: number;
  readonly timeStep: number;
  readonly steps: number;
  readonly simulatedTime: number;
  readonly phaseOperator: PhaseOperator;
  readonly domainMode: DomainMode;
  readonly liquidDiffusivity: number;
  readonly farFieldChemicalPotential: number;
  readonly criticalRadius: number;
  readonly initialRadius: number;
  readonly interfaceWidth: number;
  readonly surfaceEnergyNormalization: number;
  readonly perturbations: PerturbationConfiguration;
}

export interface ValidationProfileFields {
  readonly phase: FieldSummary;
  readonly chemicalPotential: FieldSummary;
  readonly solidificationTime: FieldSummary;
}

export interface ValidationProfileMorphology {
  readonly solidVoxelCount: number;
  readonly solidExtent: readonly [number, number, number];
  readonly symmetryError: number;
  readonly faceCenterDepression: number;
  readonly minimumFaceCenterDepression: number;
  readonly maximumFaceCenterDepression: number;
  readonly boundaryClearance: number;
  readonly boundaryClearanceRatio: number;
  readonly surfaceVoxelCount: number;
  readonly boundingBoxFillFraction: number;
  readonly surfaceToVolumeRatio: number;
  readonly surfaceComplexity: number;
  readonly faceReach: number;
  readonly edgeReach: number;
  readonly bodyDiagonalReach: number;
  readonly bodyDiagonalToFaceReachRatio: number;
  readonly occupiedBodyDiagonalArms: number;
  readonly connectedComponentCount: number;
  readonly largestConnectedComponentFraction: number;
}

export interface ValidationProfileRuntime {
  readonly budgetMilliseconds: number | null;
  readonly fixtureWallMilliseconds: number;
  readonly passed: boolean;
}

export interface ValidationProfileResult {
  readonly profile: ValidationProfile;
  readonly failures: readonly string[];
  readonly passed: boolean;
}

const DL4_SCREEN_PROFILES: readonly ValidationProfile[] = [
  'dl4-screen-control',
  'dl4-screen-quick',
  'dl4-screen-reference',
];

export function isScreeningValidationProfile(
  profile: ValidationProfile | null,
): boolean {
  return profile !== null && DL4_SCREEN_PROFILES.includes(profile);
}

function evaluateDl4ScreenProfile(
  profile: ValidationProfile,
  mode: FixtureMode,
  expectedMorphology: SimulationPresetName,
  configuration: ValidationProfileConfiguration,
  fields: ValidationProfileFields,
  morphology: ValidationProfileMorphology,
  runtime: ValidationProfileRuntime,
): ValidationProfileResult {
  const failures: string[] = [];
  const requireProfile = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };
  const control = profile === 'dl4-screen-control';
  const reference = profile === 'dl4-screen-reference';
  const expectedGrid = reference ? 256 : 128;
  const expectedSpacing = reference ? 1 : 2;
  const expectedTimeStep = control ? 0.01 : 0.005;
  const expectedSteps = control ? 35_000 : 70_000;
  const expectedPerturbations = {
    seed: 0x5eeda11,
    seedRadiusAmplitude: 0,
    seedRadiusCorrelationLength: 8,
    chemicalPotentialAmplitude: 0,
    chemicalPotentialCorrelationLength: 12,
    farFieldGradient: [0, 0, 0],
  };
  const baseline = control
    ? {
        solidExtent: 144,
        solidVoxelCount: 48_604,
        faceCenterDepression: 2,
        boundaryClearanceRatio: 2.5277777777777777,
        surfaceVoxelCount: 3_730,
        boundingBoxFillFraction: 0.9595482992122876,
        surfaceComplexity: 5.921186831431862,
        faceReach: 70,
        edgeReach: 70,
        bodyDiagonalReach: 72,
        bodyDiagonalToFaceReachRatio: 1.0285714285714285,
        chemicalPotentialMinimum: 0.03999999910593033,
        chemicalPotentialMaximum: 0.9997537136077881,
      }
    : reference
      ? {
          solidExtent: 144,
          solidVoxelCount: 383_523,
          faceCenterDepression: 1,
          boundaryClearanceRatio: 2.5416666666666665,
          surfaceVoxelCount: 15_219,
          boundingBoxFillFraction: 0.985877223874535,
          surfaceComplexity: 5.928723874119006,
          faceReach: 71,
          edgeReach: 71,
          bodyDiagonalReach: 71,
          bodyDiagonalToFaceReachRatio: 1,
          chemicalPotentialMinimum: 0.03999999910593033,
          chemicalPotentialMaximum: 0.9998964071273804,
        }
      : {
          solidExtent: 144,
          solidVoxelCount: 48_613,
          faceCenterDepression: 2,
          boundaryClearanceRatio: 2.5277777777777777,
          surfaceVoxelCount: 3_733,
          boundingBoxFillFraction: 0.9597259787179436,
          surfaceComplexity: 5.924960525215747,
          faceReach: 70,
          edgeReach: 70,
          bodyDiagonalReach: 72,
          bodyDiagonalToFaceReachRatio: 1.0285714285714285,
          chemicalPotentialMinimum: 0.03999999910593033,
          chemicalPotentialMaximum: 0.9997537136077881,
        };
  const withinAbsolute = (value: number, center: number, tolerance: number) =>
    Math.abs(value - center) <= tolerance;
  const withinRelative = (value: number, center: number, fraction: number) =>
    Math.abs(value - center) <= Math.abs(center) * fraction;

  requireProfile(mode === 'baseline', 'mode must be baseline');
  requireProfile(
    expectedMorphology === 'dendritic',
    'expected morphology must be dendritic',
  );
  requireProfile(
    configuration.phaseOperator === 'author-centered',
    'operator must be author-centered',
  );
  requireProfile(
    configuration.domainMode === 'octant',
    'domain must be octant',
  );
  requireProfile(
    configuration.grid.every((size) => size === expectedGrid),
    `grid must be ${expectedGrid}^3`,
  );
  requireProfile(
    configuration.workgroup.every((size) => size === 4),
    'workgroup must be 4x4x4',
  );
  requireProfile(
    configuration.precision === 'float32',
    'precision must be float32',
  );
  requireProfile(
    configuration.spacing === expectedSpacing,
    `spacing must be ${expectedSpacing}`,
  );
  requireProfile(
    configuration.timeStep === expectedTimeStep,
    `time step must be ${expectedTimeStep}`,
  );
  requireProfile(
    configuration.steps === expectedSteps,
    `steps must be ${expectedSteps}`,
  );
  requireProfile(
    configuration.simulatedTime === 350,
    'simulated time must be 350',
  );
  requireProfile(
    configuration.liquidDiffusivity === 4,
    'liquid diffusivity must be 4',
  );
  requireProfile(
    configuration.farFieldChemicalPotential === 0.04,
    'far-field chemical potential must be 0.04',
  );
  requireProfile(
    configuration.criticalRadius === 10 &&
      configuration.initialRadius === 20 &&
      configuration.interfaceWidth === 2,
    'Rc/R0/delta must be 10/20/2',
  );
  requireProfile(
    configuration.surfaceEnergyNormalization === 0.3203895937459951,
    'surface-energy normalization changed',
  );
  requireProfile(
    JSON.stringify(configuration.perturbations) ===
      JSON.stringify(expectedPerturbations),
    'symmetric initial and reservoir conditions changed',
  );
  requireProfile(
    fields.phase.nonFiniteCount === 0 &&
      fields.chemicalPotential.nonFiniteCount === 0 &&
      fields.solidificationTime.nonFiniteCount === 0,
    'fields must remain finite',
  );
  requireProfile(
    fields.phase.minimum >= -0.02 && fields.phase.maximum <= 1.02,
    'phase range left -0.02..1.02',
  );
  requireProfile(
    morphology.symmetryError === 0,
    'octant structural symmetry marker must be zero',
  );
  requireProfile(
    morphology.connectedComponentCount === 1 &&
      morphology.largestConnectedComponentFraction >= 0.999,
    'solid must remain one connected component',
  );
  requireProfile(
    morphology.boundaryClearanceRatio >= 1,
    'boundary-clearance ratio must be at least 1',
  );
  requireProfile(
    morphology.solidExtent.every((extent) =>
      withinAbsolute(extent, baseline.solidExtent, 2 * expectedSpacing),
    ),
    `solid extent left the calibrated +/-${2 * expectedSpacing} envelope`,
  );
  requireProfile(
    withinRelative(morphology.solidVoxelCount, baseline.solidVoxelCount, 0.02),
    'solid voxel count left the calibrated +/-2% envelope',
  );
  requireProfile(
    withinAbsolute(
      morphology.faceCenterDepression,
      baseline.faceCenterDepression,
      expectedSpacing,
    ),
    `face recession left the calibrated +/-${expectedSpacing} envelope`,
  );
  requireProfile(
    withinAbsolute(
      morphology.boundaryClearanceRatio,
      baseline.boundaryClearanceRatio,
      0.1,
    ),
    'boundary-clearance ratio left the calibrated +/-0.1 envelope',
  );
  requireProfile(
    withinRelative(
      morphology.surfaceVoxelCount,
      baseline.surfaceVoxelCount,
      0.04,
    ),
    'surface voxel count left the calibrated +/-4% envelope',
  );
  requireProfile(
    withinAbsolute(
      morphology.boundingBoxFillFraction,
      baseline.boundingBoxFillFraction,
      0.02,
    ),
    'bounding-box fill left the calibrated +/-0.02 envelope',
  );
  requireProfile(
    withinAbsolute(
      morphology.surfaceComplexity,
      baseline.surfaceComplexity,
      0.15,
    ),
    'surface complexity left the calibrated +/-0.15 envelope',
  );
  requireProfile(
    withinAbsolute(morphology.faceReach, baseline.faceReach, expectedSpacing),
    `face reach left the calibrated +/-${expectedSpacing} envelope`,
  );
  requireProfile(
    withinAbsolute(morphology.edgeReach, baseline.edgeReach, expectedSpacing),
    `edge reach left the calibrated +/-${expectedSpacing} envelope`,
  );
  requireProfile(
    withinAbsolute(
      morphology.bodyDiagonalReach,
      baseline.bodyDiagonalReach,
      expectedSpacing,
    ),
    `body-diagonal reach left the calibrated +/-${expectedSpacing} envelope`,
  );
  requireProfile(
    withinAbsolute(
      morphology.bodyDiagonalToFaceReachRatio,
      baseline.bodyDiagonalToFaceReachRatio,
      0.03,
    ),
    'body-diagonal/face reach ratio left the calibrated +/-0.03 envelope',
  );
  requireProfile(
    morphology.occupiedBodyDiagonalArms === 8,
    'all eight body-diagonal arms must remain occupied',
  );
  requireProfile(
    withinAbsolute(
      fields.chemicalPotential.minimum,
      baseline.chemicalPotentialMinimum,
      Math.max(0.01, Math.abs(baseline.chemicalPotentialMinimum) * 0.02),
    ) &&
      withinAbsolute(
        fields.chemicalPotential.maximum,
        baseline.chemicalPotentialMaximum,
        Math.max(0.01, Math.abs(baseline.chemicalPotentialMaximum) * 0.02),
      ),
    'chemical-potential extrema left the calibrated envelope',
  );
  if (!reference) {
    requireProfile(
      runtime.budgetMilliseconds === 25_000 && runtime.passed,
      'runtime must pass the 25000 ms budget',
    );
  } else {
    requireProfile(
      runtime.budgetMilliseconds === null ||
        runtime.budgetMilliseconds > 25_000,
      'reference profile must not claim the 25000 ms quick-loop budget',
    );
  }

  return { profile, failures, passed: failures.length === 0 };
}

export function evaluateValidationProfile(
  profile: ValidationProfile | null,
  mode: FixtureMode,
  expectedMorphology: SimulationPresetName,
  configuration: ValidationProfileConfiguration,
  fields: ValidationProfileFields,
  morphology: ValidationProfileMorphology,
  runtime: ValidationProfileRuntime,
): ValidationProfileResult | null {
  if (profile === null) return null;
  if (isScreeningValidationProfile(profile)) {
    return evaluateDl4ScreenProfile(
      profile,
      mode,
      expectedMorphology,
      configuration,
      fields,
      morphology,
      runtime,
    );
  }

  const failures: string[] = [];
  const requireProfile = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };
  const quick = profile === 'hopper-quick';
  const acceptance = profile === 'hopper-acceptance';
  const expectedMode: FixtureMode = acceptance ? 'baseline' : 'perturbed';
  const expectedGrid = quick ? 128 : 256;
  const expectedSpacing = quick ? 2 : 1;
  const expectedPerturbations = {
    seed: 0x5eeda11,
    seedRadiusAmplitude: acceptance ? 0 : 0.3,
    seedRadiusCorrelationLength: 8,
    chemicalPotentialAmplitude: acceptance ? 0 : 0.006,
    chemicalPotentialCorrelationLength: 12,
    farFieldGradient: acceptance
      ? ([0, 0, 0] as const)
      : ([0.00018, -0.0001, 0.00014] as const),
  };

  requireProfile(mode === expectedMode, `mode must be ${expectedMode}`);
  requireProfile(
    expectedMorphology === 'hopper',
    'expected morphology must be hopper',
  );
  requireProfile(
    configuration.phaseOperator === 'conservative-flux',
    'operator must be conservative-flux',
  );
  requireProfile(configuration.domainMode === 'full', 'domain must be full');
  requireProfile(
    configuration.grid.every((size) => size === expectedGrid),
    `grid must be ${expectedGrid}^3`,
  );
  requireProfile(
    configuration.workgroup.every((size) => size === 4),
    'workgroup must be 4x4x4',
  );
  requireProfile(
    configuration.precision === 'float32',
    'precision must be float32',
  );
  requireProfile(
    configuration.spacing === expectedSpacing,
    `spacing must be ${expectedSpacing}`,
  );
  requireProfile(configuration.timeStep === 0.01, 'time step must be 0.01');
  requireProfile(configuration.steps === 50_000, 'steps must be 50000');
  requireProfile(
    configuration.simulatedTime === 500,
    'simulated time must be 500',
  );
  requireProfile(
    configuration.liquidDiffusivity === 1 / 12,
    'liquid diffusivity must be 1/12',
  );
  requireProfile(
    configuration.farFieldChemicalPotential === 0.04,
    'far-field chemical potential must be 0.04',
  );
  requireProfile(
    configuration.criticalRadius === 10 &&
      configuration.initialRadius === 20 &&
      configuration.interfaceWidth === 2,
    'Rc/R0/delta must be 10/20/2',
  );
  requireProfile(
    configuration.surfaceEnergyNormalization === 0.3203895937459951,
    'surface-energy normalization changed',
  );
  requireProfile(
    JSON.stringify(configuration.perturbations) ===
      JSON.stringify(expectedPerturbations),
    'deterministic perturbation signature changed',
  );

  if (quick) {
    requireProfile(
      morphology.solidExtent.every((extent) => extent >= 98 && extent <= 102),
      'solid extent left 98..102',
    );
    requireProfile(
      morphology.solidVoxelCount >= 91_000 &&
        morphology.solidVoxelCount <= 94_500,
      'solid voxel count left 91000..94500',
    );
    requireProfile(
      morphology.faceCenterDepression >= 6 &&
        morphology.faceCenterDepression <= 10,
      'mean face recession left 6..10',
    );
    requireProfile(
      morphology.minimumFaceCenterDepression >= 4 &&
        morphology.maximumFaceCenterDepression <= 12,
      'face recession range left 4..12',
    );
    requireProfile(
      morphology.boundaryClearanceRatio >= 1.4 &&
        morphology.boundaryClearanceRatio <= 1.6,
      'boundary-clearance ratio left 1.4..1.6',
    );
    requireProfile(
      morphology.surfaceVoxelCount >= 13_000 &&
        morphology.surfaceVoxelCount <= 14_000,
      'surface voxel count left 13000..14000',
    );
    requireProfile(
      morphology.boundingBoxFillFraction >= 0.68 &&
        morphology.boundingBoxFillFraction <= 0.72,
      'bounding-box fill left 0.68..0.72',
    );
    requireProfile(
      morphology.symmetryError >= 0.006 && morphology.symmetryError <= 0.009,
      'symmetry error left 0.006..0.009',
    );
    requireProfile(
      morphology.connectedComponentCount === 1 &&
        morphology.largestConnectedComponentFraction >= 0.999,
      'solid must remain one connected component',
    );
    requireProfile(
      fields.phase.nonFiniteCount === 0 &&
        fields.chemicalPotential.nonFiniteCount === 0 &&
        fields.solidificationTime.nonFiniteCount === 0,
      'fields must remain finite',
    );
    requireProfile(
      fields.chemicalPotential.minimum >= -0.02 &&
        fields.chemicalPotential.minimum <= 0 &&
        fields.chemicalPotential.maximum >= 1.45 &&
        fields.chemicalPotential.maximum <= 1.58,
      'chemical-potential extrema left the calibrated envelope',
    );
    requireProfile(
      runtime.budgetMilliseconds === 25_000 && runtime.passed,
      'runtime must pass the 25000 ms budget',
    );
  } else if (profile === 'hopper-reference') {
    requireProfile(
      morphology.solidExtent.every((extent) => extent >= 98 && extent <= 102),
      'solid extent left 98..102',
    );
    requireProfile(
      morphology.solidVoxelCount >= 733_000 &&
        morphology.solidVoxelCount <= 755_000,
      'solid voxel count left 733000..755000',
    );
    requireProfile(
      morphology.faceCenterDepression >= 6.5 &&
        morphology.faceCenterDepression <= 9,
      'mean face recession left 6.5..9',
    );
    requireProfile(
      morphology.minimumFaceCenterDepression >= 5 &&
        morphology.maximumFaceCenterDepression <= 12,
      'face recession range left 5..12',
    );
    requireProfile(
      morphology.boundaryClearanceRatio >= 1.43 &&
        morphology.boundaryClearanceRatio <= 1.57,
      'boundary-clearance ratio left 1.43..1.57',
    );
    requireProfile(
      morphology.surfaceVoxelCount >= 53_000 &&
        morphology.surfaceVoxelCount <= 56_500,
      'surface voxel count left 53000..56500',
    );
    requireProfile(
      morphology.boundingBoxFillFraction >= 0.7 &&
        morphology.boundingBoxFillFraction <= 0.74,
      'bounding-box fill left 0.70..0.74',
    );
    requireProfile(
      morphology.symmetryError >= 0.005 && morphology.symmetryError <= 0.008,
      'symmetry error left 0.005..0.008',
    );
    requireProfile(
      morphology.connectedComponentCount === 1 &&
        morphology.largestConnectedComponentFraction >= 0.999,
      'solid must remain one connected component',
    );
    requireProfile(
      fields.chemicalPotential.minimum >= -0.02 &&
        fields.chemicalPotential.minimum <= 0 &&
        fields.chemicalPotential.maximum >= 1.45 &&
        fields.chemicalPotential.maximum <= 1.6,
      'chemical-potential extrema left the calibrated envelope',
    );
  }

  return { profile, failures, passed: failures.length === 0 };
}
