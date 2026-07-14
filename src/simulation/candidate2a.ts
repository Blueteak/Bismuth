import {
  crystalAxesFromEuler,
  type EulerOrientation,
  type GridShape,
  type Vec3,
} from './config';

/** Wei et al. corrected 298 K hexagonal Bi-I cell, in Angstrom. */
const BISMUTH_HEXAGONAL_LATTICE_298K = Object.freeze({
  a: 4.5768,
  c: 11.887,
});

/** Karma-Rappel IVF constants for h(psi) = psi (Phys. Rev. E 57, Table I). */
export const KARMA_RAPPEL_IVF_CONSTANTS = Object.freeze({
  a1: 0.8839,
  a2: 0.6267,
});

/**
 * Certified envelope for the fixed smooth Candidate 2A surface-energy law.
 * A deterministic Hessian audit in candidate2a.test.ts resolves 0.479..1.288;
 * 1.3 is kept as the explicit configuration bound before the 0.8 CFL margin.
 */
export const CANDIDATE2A_PHASE_STIFFNESS_BOUND = 1.3;

/**
 * Uncalibrated solid/liquid surface-flux discriminator for the trijunction
 * isolation. It is not selected by the fixed 3D Candidate 2A screen.
 */
export const CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION = Object.freeze({
  liquidBiotNumber: 0.25,
  solidBiotNumber: 2,
  maximumRefinementDifference: 0.15,
});

export interface Candidate2AFacetParameters {
  /** Reference scale only; no bismuth value is selected by this module. */
  readonly surfaceEnergyScale: number;
  /** Fractional surface-energy decrease at the declared facet normals. */
  readonly surfaceEnergyContrast: number;
  /** Minimum kinetic coefficient away from the declared facet normals. */
  readonly kineticCoefficientScale: number;
  /** Fractional increase of beta at a declared slow facet normal. */
  readonly kineticCoefficientContrast: number;
  /** Even smooth-alignment exponent used only by the isolated candidate. */
  readonly alignmentExponent: number;
}

/**
 * Dimensionless discriminator values for CPU/WebGPU isolation only. These are
 * deliberately not exposed through a product preset or claimed as Bi data.
 */
export const CANDIDATE2A_FACET_ISOLATION_PARAMETERS = Object.freeze({
  surfaceEnergyScale: 1,
  surfaceEnergyContrast: 0.08,
  kineticCoefficientScale: 2,
  kineticCoefficientContrast: 0.5,
  alignmentExponent: 6,
}) satisfies Candidate2AFacetParameters;

export interface Candidate2AFreeSurfaceBoundary {
  readonly enabled: boolean;
  /** Dimensionless liquid-air h W / k in the finite-volume Robin boundary. */
  readonly biotNumber: number;
  /** Defaults to biotNumber; permits a sourced solid/liquid surface-flux jump. */
  readonly solidBiotNumber?: number;
  readonly ambientTemperature: number;
}

export interface Candidate2AThermalConfiguration {
  readonly shape: GridShape;
  readonly spacing: number;
  readonly timeStep: number;
  readonly thermalDiffusivity: number;
  /** Delta = (T_M - T_infinity) / (L / c_p). */
  readonly undercooling: number;
  readonly interfaceWidth: number;
  readonly couplingLambda: number;
  readonly orientation: EulerOrientation;
  readonly initialCondition: Candidate2AInitialCondition;
  /** The fixed melt-air plane is y = 0. */
  readonly freeSurface: Candidate2AFreeSurfaceBoundary;
}

export type Candidate2AInitialCondition =
  | {
      readonly kind: 'planar-front';
      readonly normal: Vec3;
      /** Plane offset in world coordinates: dot(position, normal) = offset. */
      readonly offset: number;
    }
  | {
      readonly kind: 'surface-attached-seed';
      /** The center must lie on the fixed y = 0 melt-air plane. */
      readonly center: Vec3;
      /** Radius of the diffuse hemisphere before volume-constrained relaxation. */
      readonly radius: number;
    };

export interface DerivedCandidate2AThermalConfiguration extends Candidate2AThermalConfiguration {
  readonly voxelCount: number;
  readonly facetNormals: readonly [Vec3, Vec3, Vec3];
  readonly referenceCapillaryLength: number;
  readonly criticalWulffScale: number;
  readonly minimumRelaxationTime: number;
  readonly maximumPhaseStiffness: number;
  readonly maximumStableTimeStep: number;
}

export interface Candidate2AThermalState {
  readonly config: DerivedCandidate2AThermalConfiguration;
  /** Karma-Rappel psi: +1 solid, -1 liquid. */
  readonly orderParameter: Float32Array;
  /** u = (T - T_M) / (L / c_p). */
  readonly temperature: Float32Array;
  readonly step: number;
  readonly simulatedTime: number;
}

export interface Candidate2APhaseForceDecomposition {
  readonly variationalDriving: Float64Array;
  readonly thermalDriving: Float64Array;
  readonly relaxationTime: Float64Array;
  readonly totalDrivingForce: Float64Array;
}

export interface Candidate2APlanarSignature {
  readonly contactLineAdvance: number;
  readonly bulkAdvance: number;
  readonly excessContactLineAdvance: number;
  readonly finite: boolean;
}

export interface Candidate2APreRelaxationResult {
  readonly state: Candidate2AThermalState;
  readonly iterations: number;
  readonly converged: boolean;
  readonly initialEnergy: number;
  readonly finalEnergy: number;
  readonly maximumRate: number;
  readonly relativeVolumeDrift: number;
}

export interface Candidate2APreRelaxationOptions {
  readonly maximumIterations: number;
  readonly rateTolerance: number;
  /** Defaults to one quarter of the validated coupled-step bound. */
  readonly timeStep?: number;
}

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  if (!(length > 0)) {
    throw new RangeError('Direction must have non-zero length.');
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function dot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function rotateAroundHexagonalAxis(vector: Vec3, angle: number): Vec3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    cosine * vector[0] - sine * vector[1],
    sine * vector[0] + cosine * vector[1],
    vector[2],
  ];
}

function rotateByOrientation(
  vector: Vec3,
  orientation: EulerOrientation,
): Vec3 {
  const basis = crystalAxesFromEuler(orientation);
  return normalize([
    vector[0] * basis[0][0] + vector[1] * basis[1][0] + vector[2] * basis[2][0],
    vector[0] * basis[0][1] + vector[1] * basis[1][1] + vector[2] * basis[2][1],
    vector[0] * basis[0][2] + vector[1] * basis[1][2] + vector[2] * basis[2][2],
  ]);
}

/**
 * Explicit normals for the {1-102} family reported for microscopic
 * polycrystalline Sn-Bi pyramids. This different-specimen hypothesis is
 * retained for Candidate 2A evidence only and must not define Candidate 2D.
 */
export function snBiPyramidFacetNormals(
  orientation: EulerOrientation = { x: 0, y: 0, z: 0 },
): readonly [Vec3, Vec3, Vec3] {
  const { a, c } = BISMUTH_HEXAGONAL_LATTICE_298K;
  // Reciprocal normal of (1 -1 0 2); the common 2 pi factor cancels.
  const base = normalize([1 / a, -1 / (Math.sqrt(3) * a), 2 / c]);
  return [0, 1, 2].map((turn) =>
    rotateByOrientation(
      rotateAroundHexagonalAxis(base, (turn * 2 * Math.PI) / 3),
      orientation,
    ),
  ) as [Vec3, Vec3, Vec3];
}

/**
 * Smooth even selector for the full slow-facet family. The normalization makes
 * the response exactly one at every declared facet normal for this symmetric
 * family, while avoiding the branch ties of max(abs(dot)).
 */
export function smoothFacetFamilyAlignment(
  normal: Vec3,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  exponent: number,
): number {
  const unitNormal = normalize(normal);
  const reference = facetNormals[0];
  const normalization = facetNormals.reduce(
    (sum, facetNormal) => sum + dot(reference, facetNormal) ** exponent,
    0,
  );
  return (
    facetNormals.reduce(
      (sum, facetNormal) => sum + dot(unitNormal, facetNormal) ** exponent,
      0,
    ) / normalization
  );
}

export function validateCandidate2AFacetParameters(
  parameters: Candidate2AFacetParameters,
): void {
  assertFinitePositive('surfaceEnergyScale', parameters.surfaceEnergyScale);
  assertFinitePositive(
    'kineticCoefficientScale',
    parameters.kineticCoefficientScale,
  );
  for (const [name, value] of [
    ['surfaceEnergyContrast', parameters.surfaceEnergyContrast],
    ['kineticCoefficientContrast', parameters.kineticCoefficientContrast],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError(`${name} must lie in [0, 1).`);
    }
  }
  if (
    !Number.isInteger(parameters.alignmentExponent) ||
    parameters.alignmentExponent < 2 ||
    parameters.alignmentExponent % 2 !== 0
  ) {
    throw new RangeError('alignmentExponent must be an even integer >= 2.');
  }
}

/** gamma(n), kept independent from beta(n). */
export function bismuthSurfaceEnergy(
  normal: Vec3,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters,
): number {
  validateCandidate2AFacetParameters(parameters);
  const alignment = smoothFacetFamilyAlignment(
    normal,
    facetNormals,
    parameters.alignmentExponent,
  );
  return (
    parameters.surfaceEnergyScale *
    (1 - parameters.surfaceEnergyContrast * alignment)
  );
}

/** beta(n); larger beta means slower sharp-interface attachment. */
export function bismuthKineticCoefficient(
  normal: Vec3,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters,
): number {
  validateCandidate2AFacetParameters(parameters);
  const alignment = smoothFacetFamilyAlignment(
    normal,
    facetNormals,
    parameters.alignmentExponent,
  );
  return (
    parameters.kineticCoefficientScale *
    (1 + parameters.kineticCoefficientContrast * alignment)
  );
}

function normalizedSurfaceEnergyAnisotropy(
  normal: Vec3,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters,
): number {
  return (
    1 -
    parameters.surfaceEnergyContrast *
      smoothFacetFamilyAlignment(
        normal,
        facetNormals,
        parameters.alignmentExponent,
      )
  );
}

/** 1/2 W(n)^2 |grad(psi)|^2 from Karma-Rappel Eq. 22. */
export function candidate2AGradientEnergyDensity(
  gradient: Vec3,
  interfaceWidth: number,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters = CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
): number {
  const magnitude = Math.hypot(...gradient);
  if (magnitude === 0) return 0;
  const anisotropy = normalizedSurfaceEnergyAnisotropy(
    gradient,
    facetNormals,
    parameters,
  );
  return 0.5 * interfaceWidth ** 2 * anisotropy ** 2 * magnitude ** 2;
}

/**
 * World-space derivative of the Candidate 2A gradient energy with respect to
 * grad(psi). This is the complete variational flux in Karma-Rappel Eq. 99.
 */
export function candidate2APhaseFlux(
  gradient: Vec3,
  interfaceWidth: number,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters = CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
): Vec3 {
  validateCandidate2AFacetParameters(parameters);
  return candidate2APhaseFluxUnchecked(
    gradient,
    interfaceWidth,
    facetNormals,
    parameters,
  );
}

function candidate2APhaseFluxUnchecked(
  gradient: Vec3,
  interfaceWidth: number,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters,
): Vec3 {
  return candidate2APhaseFluxAndAlignmentUnchecked(
    gradient,
    interfaceWidth,
    facetNormals,
    parameters,
  ).flux;
}

interface Candidate2APhaseFluxAndAlignment {
  readonly flux: Vec3;
  readonly alignment: number;
}

function candidate2APhaseFluxAndAlignmentUnchecked(
  gradient: Vec3,
  interfaceWidth: number,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters,
): Candidate2APhaseFluxAndAlignment {
  const magnitude = Math.hypot(...gradient);
  if (magnitude === 0) {
    return {
      flux: [0, 0, 0],
      alignment: smoothFacetFamilyAlignment(
        [0, 0, 1],
        facetNormals,
        parameters.alignmentExponent,
      ),
    };
  }

  const normal: Vec3 = [
    gradient[0] / magnitude,
    gradient[1] / magnitude,
    gradient[2] / magnitude,
  ];
  const exponent = parameters.alignmentExponent;
  const reference = facetNormals[0];
  const normalization = facetNormals.reduce(
    (sum, facetNormal) => sum + dot(reference, facetNormal) ** exponent,
    0,
  );
  let response = 0;
  const responseGradient: [number, number, number] = [0, 0, 0];
  for (const facetNormal of facetNormals) {
    const projection = dot(normal, facetNormal);
    response += projection ** exponent;
    const derivative = exponent * projection ** (exponent - 1);
    for (let axis = 0; axis < 3; axis += 1) {
      responseGradient[axis] =
        (responseGradient[axis] ?? 0) + derivative * (facetNormal[axis] ?? 0);
    }
  }
  response /= normalization;
  for (let axis = 0; axis < 3; axis += 1) {
    responseGradient[axis] = (responseGradient[axis] ?? 0) / normalization;
  }

  const anisotropy = 1 - parameters.surfaceEnergyContrast * response;
  const radialDerivative = dot(normal, responseGradient);
  const tangentAnisotropyGradient: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    tangentAnisotropyGradient[axis] =
      -parameters.surfaceEnergyContrast *
      ((responseGradient[axis] ?? 0) - radialDerivative * (normal[axis] ?? 0));
  }
  const scale = interfaceWidth ** 2;
  return {
    flux: [
      scale *
        (anisotropy ** 2 * gradient[0] +
          magnitude * anisotropy * tangentAnisotropyGradient[0]),
      scale *
        (anisotropy ** 2 * gradient[1] +
          magnitude * anisotropy * tangentAnisotropyGradient[1]),
      scale *
        (anisotropy ** 2 * gradient[2] +
          magnitude * anisotropy * tangentAnisotropyGradient[2]),
    ],
    alignment: response,
  };
}

export function candidate2ARelaxationTime(
  normal: Vec3,
  interfaceWidth: number,
  couplingLambda: number,
  thermalDiffusivity: number,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters = CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
): number {
  validateCandidate2AFacetParameters(parameters);
  return candidate2ARelaxationTimeUnchecked(
    normal,
    interfaceWidth,
    couplingLambda,
    thermalDiffusivity,
    facetNormals,
    parameters,
  );
}

function candidate2ARelaxationTimeUnchecked(
  normal: Vec3,
  interfaceWidth: number,
  couplingLambda: number,
  thermalDiffusivity: number,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters,
): number {
  const alignment = smoothFacetFamilyAlignment(
    normal,
    facetNormals,
    parameters.alignmentExponent,
  );
  return candidate2ARelaxationTimeForAlignment(
    alignment,
    interfaceWidth,
    couplingLambda,
    thermalDiffusivity,
    parameters,
  );
}

function candidate2ARelaxationTimeForAlignment(
  alignment: number,
  interfaceWidth: number,
  couplingLambda: number,
  thermalDiffusivity: number,
  parameters: Candidate2AFacetParameters,
): number {
  const anisotropy = 1 - parameters.surfaceEnergyContrast * alignment;
  const directionalWidth = interfaceWidth * anisotropy;
  const kineticCoefficient =
    parameters.kineticCoefficientScale *
    (1 + parameters.kineticCoefficientContrast * alignment);
  return relaxationTimeForKineticCoefficient(
    kineticCoefficient,
    directionalWidth,
    couplingLambda,
    thermalDiffusivity,
  );
}

/** Karma-Rappel Eq. 6 for the IVF normalization. */
export function thinInterfaceCapillaryLength(
  interfaceWidth: number,
  couplingLambda: number,
): number {
  return (KARMA_RAPPEL_IVF_CONSTANTS.a1 * interfaceWidth) / couplingLambda;
}

/** Karma-Rappel Eq. 10 / Eq. 63, including the finite-W correction. */
export function thinInterfaceKineticCoefficient(
  relaxationTime: number,
  interfaceWidth: number,
  couplingLambda: number,
  thermalDiffusivity: number,
): number {
  return (
    KARMA_RAPPEL_IVF_CONSTANTS.a1 *
    (relaxationTime / (couplingLambda * interfaceWidth) -
      (KARMA_RAPPEL_IVF_CONSTANTS.a2 * interfaceWidth) / thermalDiffusivity)
  );
}

export function relaxationTimeForKineticCoefficient(
  kineticCoefficient: number,
  interfaceWidth: number,
  couplingLambda: number,
  thermalDiffusivity: number,
): number {
  return (
    couplingLambda *
    interfaceWidth *
    (kineticCoefficient / KARMA_RAPPEL_IVF_CONSTANTS.a1 +
      (KARMA_RAPPEL_IVF_CONSTANTS.a2 * interfaceWidth) / thermalDiffusivity)
  );
}

export function validateCandidate2AThermalConfiguration(
  config: Candidate2AThermalConfiguration,
): void {
  if (
    config.shape.length !== 3 ||
    [0, 1, 2].some(
      (axis) =>
        !Number.isInteger(config.shape[axis]) || (config.shape[axis] ?? 0) < 1,
    ) ||
    config.shape[0] < 5
  ) {
    throw new RangeError('shape must contain positive integers and x >= 5.');
  }
  for (const [name, value] of [
    ['spacing', config.spacing],
    ['timeStep', config.timeStep],
    ['thermalDiffusivity', config.thermalDiffusivity],
    ['undercooling', config.undercooling],
    ['interfaceWidth', config.interfaceWidth],
    ['couplingLambda', config.couplingLambda],
  ] as const) {
    assertFinitePositive(name, value);
  }
  for (const [name, angle] of [
    ['x', config.orientation.x],
    ['y', config.orientation.y],
    ['z', config.orientation.z],
  ] as const) {
    if (!Number.isFinite(angle)) {
      throw new RangeError(`orientation.${name} must be finite.`);
    }
  }
  if (
    !Number.isFinite(config.freeSurface.biotNumber) ||
    config.freeSurface.biotNumber < 0
  ) {
    throw new RangeError(
      'freeSurface.biotNumber must be finite and non-negative.',
    );
  }
  if (
    config.freeSurface.solidBiotNumber !== undefined &&
    (!Number.isFinite(config.freeSurface.solidBiotNumber) ||
      config.freeSurface.solidBiotNumber < 0)
  ) {
    throw new RangeError(
      'freeSurface.solidBiotNumber must be finite and non-negative.',
    );
  }
  if (!Number.isFinite(config.freeSurface.ambientTemperature)) {
    throw new RangeError('freeSurface.ambientTemperature must be finite.');
  }
  if (config.freeSurface.enabled && config.shape[1] < 3) {
    throw new RangeError('The free-surface isolation requires y >= 3.');
  }

  const initial = config.initialCondition;
  if (initial.kind === 'planar-front') {
    if (
      initial.normal.length !== 3 ||
      [0, 1, 2].some((axis) => !Number.isFinite(initial.normal[axis])) ||
      !Number.isFinite(initial.offset)
    ) {
      throw new RangeError(
        'The planar front normal and offset must be finite.',
      );
    }
    const normal = normalize(initial.normal);
    const projections: number[] = [];
    for (const x of [0, (config.shape[0] - 1) * config.spacing]) {
      for (const y of [0, (config.shape[1] - 1) * config.spacing]) {
        for (const z of [0, (config.shape[2] - 1) * config.spacing]) {
          projections.push(dot([x, y, z], normal));
        }
      }
    }
    const interfaceClearance = 2 * config.interfaceWidth;
    if (
      initial.offset <= Math.min(...projections) + interfaceClearance ||
      initial.offset >= Math.max(...projections) - interfaceClearance
    ) {
      throw new RangeError(
        'The planar front must cross the domain with two interface widths of clearance.',
      );
    }
  } else {
    assertFinitePositive('initialCondition.radius', initial.radius);
    if (config.interfaceWidth < 2 * config.spacing) {
      throw new RangeError(
        'A surface seed requires at least two grid cells per interface width.',
      );
    }
    if (initial.radius < 2 * config.interfaceWidth) {
      throw new RangeError(
        'A surface seed radius must span at least two interface widths.',
      );
    }
    if (
      initial.center.length !== 3 ||
      [0, 1, 2].some((axis) => !Number.isFinite(initial.center[axis]))
    ) {
      throw new RangeError('The surface seed center must be finite.');
    }
    if (Math.abs(initial.center[1]) > 1e-12) {
      throw new RangeError('The surface seed center must lie on y = 0.');
    }
    if (!config.freeSurface.enabled) {
      throw new RangeError(
        'A surface-attached seed requires the free surface.',
      );
    }
    const tail = initial.radius + 2 * config.interfaceWidth;
    const maximum = config.shape.map((size) => (size - 1) * config.spacing) as [
      number,
      number,
      number,
    ];
    if (
      initial.center[0] - tail <= 0 ||
      initial.center[0] + tail >= maximum[0] ||
      tail >= maximum[1] ||
      initial.center[2] - tail <= 0 ||
      initial.center[2] + tail >= maximum[2]
    ) {
      throw new RangeError(
        'The diffuse surface seed must clear every non-free-surface boundary by two interface widths.',
      );
    }
  }
}

function minimumCandidate2ARelaxationTime(
  interfaceWidth: number,
  couplingLambda: number,
  thermalDiffusivity: number,
): number {
  const parameters = CANDIDATE2A_FACET_ISOLATION_PARAMETERS;
  const surfaceContrast = parameters.surfaceEnergyContrast;
  const kineticContrast = parameters.kineticCoefficientContrast;
  const betaTerm =
    parameters.kineticCoefficientScale / KARMA_RAPPEL_IVF_CONSTANTS.a1;
  const widthTerm =
    (KARMA_RAPPEL_IVF_CONSTANTS.a2 * interfaceWidth) / thermalDiffusivity;
  const insideConstant = betaTerm + widthTerm;
  const insideLinear = betaTerm * kineticContrast - widthTerm * surfaceContrast;
  const quadratic = -surfaceContrast * insideLinear;
  const linear = insideLinear - surfaceContrast * insideConstant;
  const constant = insideConstant;
  const candidates = [0, 1];
  if (quadratic !== 0) {
    const vertex = -linear / (2 * quadratic);
    if (vertex > 0 && vertex < 1) candidates.push(vertex);
  }
  return Math.min(
    ...candidates.map(
      (alignment) =>
        couplingLambda *
        interfaceWidth *
        (constant + linear * alignment + quadratic * alignment ** 2),
    ),
  );
}

export function deriveCandidate2AThermalConfiguration(
  config: Candidate2AThermalConfiguration,
): DerivedCandidate2AThermalConfiguration {
  validateCandidate2AThermalConfiguration(config);
  const facetNormals = snBiPyramidFacetNormals(config.orientation);
  const minimumRelaxationTime = minimumCandidate2ARelaxationTime(
    config.interfaceWidth,
    config.couplingLambda,
    config.thermalDiffusivity,
  );
  const dimensions = config.shape.filter((size) => size > 1).length;
  const activeBiotNumber = config.freeSurface.enabled
    ? Math.max(
        config.freeSurface.biotNumber,
        config.freeSurface.solidBiotNumber ?? config.freeSurface.biotNumber,
      )
    : 0;
  const robinEigenvalue = Math.max(
    4 * dimensions,
    4 * dimensions - 2 + config.spacing * activeBiotNumber,
  );
  const thermalLimit =
    (2 * config.spacing ** 2) / (config.thermalDiffusivity * robinEigenvalue);
  const temperatureEnvelope =
    Math.max(
      config.undercooling,
      config.freeSurface.enabled
        ? Math.abs(config.freeSurface.ambientTemperature)
        : config.undercooling,
    ) + 1;
  const localPhaseLipschitz =
    2 + (8 * config.couplingLambda * temperatureEnvelope) / (3 * Math.sqrt(3));
  const phaseDiffusionEigenvalue =
    (4 *
      dimensions *
      config.interfaceWidth ** 2 *
      CANDIDATE2A_PHASE_STIFFNESS_BOUND) /
    config.spacing ** 2;
  const phaseLimit =
    (2 * minimumRelaxationTime) /
    (phaseDiffusionEigenvalue + localPhaseLipschitz);
  const maximumStableTimeStep = 0.8 * Math.min(thermalLimit, phaseLimit);
  if (config.timeStep > maximumStableTimeStep) {
    throw new RangeError(
      `timeStep ${config.timeStep} exceeds Candidate 2A explicit bound ${maximumStableTimeStep}.`,
    );
  }
  return {
    ...config,
    voxelCount: config.shape[0] * config.shape[1] * config.shape[2],
    facetNormals,
    referenceCapillaryLength: thinInterfaceCapillaryLength(
      config.interfaceWidth,
      config.couplingLambda,
    ),
    criticalWulffScale:
      (2 *
        thinInterfaceCapillaryLength(
          config.interfaceWidth,
          config.couplingLambda,
        )) /
      config.undercooling,
    minimumRelaxationTime,
    maximumPhaseStiffness: CANDIDATE2A_PHASE_STIFFNESS_BOUND,
    maximumStableTimeStep,
  };
}

function linearIndex(
  x: number,
  y: number,
  z: number,
  shape: GridShape,
): number {
  return x + shape[0] * (y + shape[1] * z);
}

function initialOrderParameter(
  position: Vec3,
  config: DerivedCandidate2AThermalConfiguration,
): number {
  const initial = config.initialCondition;
  let signedDistance: number;
  let normal: Vec3;
  if (initial.kind === 'planar-front') {
    normal = normalize(initial.normal);
    signedDistance = dot(position, normal) - initial.offset;
  } else {
    const displacement: Vec3 = [
      position[0] - initial.center[0],
      position[1] - initial.center[1],
      position[2] - initial.center[2],
    ];
    const distance = Math.hypot(...displacement);
    normal = distance > 0 ? normalize(displacement) : [0, 1, 0];
    signedDistance = distance - initial.radius;
  }
  const directionalWidth =
    config.interfaceWidth *
    normalizedSurfaceEnergyAnisotropy(
      normal,
      config.facetNormals,
      CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
    );
  return -Math.tanh(signedDistance / (Math.sqrt(2) * directionalWidth));
}

export function createInitialCandidate2AThermalState(
  configuration: Candidate2AThermalConfiguration,
): Candidate2AThermalState {
  const config = deriveCandidate2AThermalConfiguration(configuration);
  const orderParameter = new Float32Array(config.voxelCount);
  const temperature = new Float32Array(config.voxelCount);
  for (let z = 0; z < config.shape[2]; z += 1) {
    for (let y = 0; y < config.shape[1]; y += 1) {
      for (let x = 0; x < config.shape[0]; x += 1) {
        const index = linearIndex(x, y, z, config.shape);
        orderParameter[index] = Math.fround(
          initialOrderParameter(
            [x * config.spacing, y * config.spacing, z * config.spacing],
            config,
          ),
        );
        temperature[index] = Math.fround(-config.undercooling);
      }
    }
  }
  return { config, orderParameter, temperature, step: 0, simulatedTime: 0 };
}

function activeCellMeasure(
  config: DerivedCandidate2AThermalConfiguration,
): number {
  return config.spacing ** config.shape.filter((size) => size > 1).length;
}

export function candidate2ADiffuseSolidFraction(
  orderParameter: number,
): number {
  return 0.5 + 0.75 * orderParameter - 0.25 * orderParameter ** 3;
}

export function candidate2AFreeSurfaceBiotNumber(
  orderParameter: number,
  boundary: Candidate2AFreeSurfaceBoundary,
): number {
  if (!Number.isFinite(orderParameter)) {
    throw new RangeError('orderParameter must be finite.');
  }
  const liquidBiotNumber = boundary.biotNumber;
  const solidBiotNumber = boundary.solidBiotNumber ?? liquidBiotNumber;
  const solidFraction = Math.max(
    0,
    Math.min(1, candidate2ADiffuseSolidFraction(orderParameter)),
  );
  return (
    liquidBiotNumber + solidFraction * (solidBiotNumber - liquidBiotNumber)
  );
}

/** Diffusivity-normalized outward heat flux at the fixed free surface. */
export function candidate2AFreeSurfaceHeatFlux(
  orderParameter: number,
  temperature: number,
  boundary: Candidate2AFreeSurfaceBoundary,
): number {
  if (!Number.isFinite(temperature)) {
    throw new RangeError('temperature must be finite.');
  }
  return (
    candidate2AFreeSurfaceBiotNumber(orderParameter, boundary) *
    (temperature - boundary.ambientTemperature)
  );
}

function diffuseSolidFractionDerivative(orderParameter: number): number {
  return 0.75 * (1 - orderParameter ** 2);
}

export function candidate2ADiffuseSolidVolume(
  state: Candidate2AThermalState,
): number {
  let volume = 0;
  for (const psi of state.orderParameter) {
    volume += candidate2ADiffuseSolidFraction(psi);
  }
  return volume * activeCellMeasure(state.config);
}

export function candidate2APhaseEnergy(state: Candidate2AThermalState): number {
  const { config } = state;
  let energy = 0;
  for (let z = 0; z < config.shape[2]; z += 1) {
    for (let y = 0; y < config.shape[1]; y += 1) {
      for (let x = 0; x < config.shape[0]; x += 1) {
        const index = linearIndex(x, y, z, config.shape);
        const psi = state.orderParameter[index] ?? Number.NaN;
        const gradient = forwardGradient(state.orderParameter, x, y, z, config);
        energy +=
          candidate2AGradientEnergyDensity(
            gradient,
            config.interfaceWidth,
            config.facetNormals,
          ) +
          0.25 * (1 - psi ** 2) ** 2;
      }
    }
  }
  return energy * activeCellMeasure(config);
}

/**
 * Volume-constrained zero-temperature relaxation of a surface-attached seed.
 * The natural zero phase flux at y = 0 yields the model's neutral contact.
 */
export function preRelaxCandidate2ASurfaceSeed(
  initial: Candidate2AThermalState,
  options: Candidate2APreRelaxationOptions,
): Candidate2APreRelaxationResult {
  if (initial.config.initialCondition.kind !== 'surface-attached-seed') {
    throw new RangeError('Only a surface-attached seed can be pre-relaxed.');
  }
  if (
    !Number.isInteger(options.maximumIterations) ||
    options.maximumIterations < 1
  ) {
    throw new RangeError('maximumIterations must be a positive integer.');
  }
  assertFinitePositive('rateTolerance', options.rateTolerance);
  const relaxationStep =
    options.timeStep ?? 0.25 * initial.config.maximumStableTimeStep;
  assertFinitePositive('pre-relaxation timeStep', relaxationStep);
  if (relaxationStep > initial.config.maximumStableTimeStep) {
    throw new RangeError(
      'The pre-relaxation timeStep exceeds the explicit stability bound.',
    );
  }

  const initialVolume = candidate2ADiffuseSolidVolume(initial);
  const initialEnergy = candidate2APhaseEnergy(initial);
  let state = initial;
  let iterations = 0;
  let maximumRate = Number.POSITIVE_INFINITY;
  let converged = false;

  for (; iterations < options.maximumIterations; iterations += 1) {
    const terms = candidate2APhaseTerms(state, 0);
    let numerator = 0;
    let denominator = 0;
    for (let index = 0; index < state.config.voxelCount; index += 1) {
      const psi = state.orderParameter[index] ?? Number.NaN;
      const volumeDerivative = diffuseSolidFractionDerivative(psi);
      const inverseRelaxation = 1 / (terms.relaxationTime[index] ?? Number.NaN);
      numerator +=
        volumeDerivative *
        (terms.totalDrivingForce[index] ?? Number.NaN) *
        inverseRelaxation;
      denominator += volumeDerivative ** 2 * inverseRelaxation;
    }
    if (!Number.isFinite(denominator) || denominator <= 0) {
      throw new RangeError(
        'The surface seed has no resolved diffuse interface to pre-relax.',
      );
    }
    const multiplier = -numerator / denominator;
    if (!Number.isFinite(multiplier)) {
      throw new RangeError('The surface-seed volume constraint is singular.');
    }
    const nextOrderParameter = new Float32Array(state.config.voxelCount);
    maximumRate = 0;
    for (let index = 0; index < state.config.voxelCount; index += 1) {
      const psi = state.orderParameter[index] ?? Number.NaN;
      const rate =
        ((terms.totalDrivingForce[index] ?? Number.NaN) +
          multiplier * diffuseSolidFractionDerivative(psi)) /
        (terms.relaxationTime[index] ?? Number.NaN);
      maximumRate = Math.max(maximumRate, Math.abs(rate));
      nextOrderParameter[index] = Math.fround(psi + relaxationStep * rate);
    }
    state = {
      ...state,
      orderParameter: nextOrderParameter,
      step: 0,
      simulatedTime: 0,
    };
    if (maximumRate <= options.rateTolerance) {
      converged = true;
      iterations += 1;
      break;
    }
  }

  const finalEnergy = candidate2APhaseEnergy(state);
  const finalVolume = candidate2ADiffuseSolidVolume(state);
  return {
    state,
    iterations,
    converged,
    initialEnergy,
    finalEnergy,
    maximumRate,
    relativeVolumeDrift: Math.abs(finalVolume - initialVolume) / initialVolume,
  };
}

function clampedSample(
  field: Float32Array,
  x: number,
  y: number,
  z: number,
  shape: GridShape,
): number {
  const cx = Math.max(0, Math.min(shape[0] - 1, x));
  const cy = Math.max(0, Math.min(shape[1] - 1, y));
  const cz = Math.max(0, Math.min(shape[2] - 1, z));
  return field[linearIndex(cx, cy, cz, shape)] ?? Number.NaN;
}

function temperatureSample(
  state: Candidate2AThermalState,
  x: number,
  y: number,
  z: number,
): number {
  const { config, temperature } = state;
  if (y < 0 && config.freeSurface.enabled) {
    const center = clampedSample(temperature, x, 0, z, config.shape);
    const surfaceOrderParameter = clampedSample(
      state.orderParameter,
      x,
      0,
      z,
      config.shape,
    );
    return (
      center -
      config.spacing *
        candidate2AFreeSurfaceHeatFlux(
          surfaceOrderParameter,
          center,
          config.freeSurface,
        )
    );
  }
  return clampedSample(temperature, x, y, z, config.shape);
}

function laplacian(
  center: number,
  sample: (axis: number, offset: number) => number,
  config: DerivedCandidate2AThermalConfiguration,
): number {
  let sum = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    if (config.shape[axis] === 1) continue;
    sum += sample(axis, -1) + sample(axis, 1) - 2 * center;
  }
  return sum / (config.spacing * config.spacing);
}

function forwardGradient(
  field: Float32Array,
  x: number,
  y: number,
  z: number,
  config: DerivedCandidate2AThermalConfiguration,
): Vec3 {
  const index = linearIndex(x, y, z, config.shape);
  const center = field[index] ?? Number.NaN;
  const rowStride = config.shape[0];
  const sliceStride = config.shape[0] * config.shape[1];
  return [
    x + 1 < config.shape[0]
      ? ((field[index + 1] ?? Number.NaN) - center) / config.spacing
      : 0,
    y + 1 < config.shape[1]
      ? ((field[index + rowStride] ?? Number.NaN) - center) / config.spacing
      : 0,
    z + 1 < config.shape[2]
      ? ((field[index + sliceStride] ?? Number.NaN) - center) / config.spacing
      : 0,
  ];
}

function candidate2APhaseTerms(
  state: Candidate2AThermalState,
  fixedTemperature?: number,
): Candidate2APhaseForceDecomposition {
  const { config } = state;
  const flux = new Float64Array(config.voxelCount * 3);
  const relaxationTime = new Float64Array(config.voxelCount);
  const variationalDriving = new Float64Array(config.voxelCount);
  const thermalDriving = new Float64Array(config.voxelCount);
  const totalDrivingForce = new Float64Array(config.voxelCount);

  for (let z = 0; z < config.shape[2]; z += 1) {
    for (let y = 0; y < config.shape[1]; y += 1) {
      for (let x = 0; x < config.shape[0]; x += 1) {
        const index = linearIndex(x, y, z, config.shape);
        const gradient = forwardGradient(state.orderParameter, x, y, z, config);
        const directional = candidate2APhaseFluxAndAlignmentUnchecked(
          gradient,
          config.interfaceWidth,
          config.facetNormals,
          CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
        );
        const localFlux = directional.flux;
        flux[index * 3] = x + 1 < config.shape[0] ? localFlux[0] : 0;
        flux[index * 3 + 1] = y + 1 < config.shape[1] ? localFlux[1] : 0;
        flux[index * 3 + 2] = z + 1 < config.shape[2] ? localFlux[2] : 0;
        relaxationTime[index] = candidate2ARelaxationTimeForAlignment(
          directional.alignment,
          config.interfaceWidth,
          config.couplingLambda,
          config.thermalDiffusivity,
          CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
        );
      }
    }
  }

  for (let z = 0; z < config.shape[2]; z += 1) {
    for (let y = 0; y < config.shape[1]; y += 1) {
      for (let x = 0; x < config.shape[0]; x += 1) {
        const index = linearIndex(x, y, z, config.shape);
        const rowStride = config.shape[0];
        const sliceStride = config.shape[0] * config.shape[1];
        const fluxOffset = index * 3;
        const fluxDivergence =
          ((flux[fluxOffset] ?? Number.NaN) -
            (x > 0 ? (flux[(index - 1) * 3] ?? Number.NaN) : 0) +
            (flux[fluxOffset + 1] ?? Number.NaN) -
            (y > 0 ? (flux[(index - rowStride) * 3 + 1] ?? Number.NaN) : 0) +
            (flux[fluxOffset + 2] ?? Number.NaN) -
            (z > 0 ? (flux[(index - sliceStride) * 3 + 2] ?? Number.NaN) : 0)) /
          config.spacing;
        const psi = state.orderParameter[index] ?? Number.NaN;
        const temperature =
          fixedTemperature ?? state.temperature[index] ?? Number.NaN;
        const oneMinusPsiSquared = 1 - psi * psi;
        const bulkPotential = psi * oneMinusPsiSquared;
        const localRate =
          (psi - config.couplingLambda * temperature * oneMinusPsiSquared) *
          oneMinusPsiSquared;
        variationalDriving[index] = fluxDivergence + bulkPotential;
        thermalDriving[index] =
          -config.couplingLambda *
          temperature *
          oneMinusPsiSquared *
          oneMinusPsiSquared;
        totalDrivingForce[index] = fluxDivergence + localRate;
      }
    }
  }
  return {
    variationalDriving,
    thermalDriving,
    relaxationTime,
    totalDrivingForce,
  };
}

/** Exact decomposition used by the production Candidate 2A phase step. */
export function candidate2APhaseForceDecomposition(
  state: Candidate2AThermalState,
  fixedTemperature?: number,
): Candidate2APhaseForceDecomposition {
  if (fixedTemperature !== undefined && !Number.isFinite(fixedTemperature)) {
    throw new RangeError('fixedTemperature must be finite.');
  }
  return candidate2APhaseTerms(state, fixedTemperature);
}

/** CPU-checkable discrete variational force used by the critical math tests. */
export function candidate2APhaseDrivingForce(
  state: Candidate2AThermalState,
  fixedTemperature = 0,
): Float64Array {
  if (!Number.isFinite(fixedTemperature)) {
    throw new RangeError('fixedTemperature must be finite.');
  }
  return candidate2APhaseTerms(state, fixedTemperature).totalDrivingForce;
}

/**
 * External contribution to d sum(u - psi / 2) / dt from the y = 0 Robin
 * plane. Other clamped boundaries are no-flux and cancel in the field sum.
 */
export function candidate2AFreeSurfaceHeatRate(
  state: Candidate2AThermalState,
): number {
  const { config } = state;
  if (!config.freeSurface.enabled) return 0;
  let rate = 0;
  for (let z = 0; z < config.shape[2]; z += 1) {
    for (let x = 0; x < config.shape[0]; x += 1) {
      const index = linearIndex(x, 0, z, config.shape);
      const temperature = state.temperature[index] ?? Number.NaN;
      const orderParameter = state.orderParameter[index] ?? Number.NaN;
      rate -=
        (config.thermalDiffusivity / config.spacing) *
        candidate2AFreeSurfaceHeatFlux(
          orderParameter,
          temperature,
          config.freeSurface,
        );
    }
  }
  return rate;
}

/** Applies heat diffusion and latent heat from exactly one supplied psi field. */
export function advanceCandidate2ATemperature(
  state: Candidate2AThermalState,
  nextOrderParameter: Float32Array,
): Float32Array {
  const { config } = state;
  if (nextOrderParameter.length !== config.voxelCount) {
    throw new RangeError('nextOrderParameter length must match the grid.');
  }
  const nextTemperature = new Float32Array(config.voxelCount);
  for (let z = 0; z < config.shape[2]; z += 1) {
    for (let y = 0; y < config.shape[1]; y += 1) {
      for (let x = 0; x < config.shape[0]; x += 1) {
        const index = linearIndex(x, y, z, config.shape);
        const oldTemperature = state.temperature[index] ?? Number.NaN;
        const temperatureLaplacian = laplacian(
          oldTemperature,
          (axis, offset) => {
            const coordinate = [x, y, z];
            coordinate[axis] = (coordinate[axis] ?? 0) + offset;
            return temperatureSample(
              state,
              coordinate[0] ?? 0,
              coordinate[1] ?? 0,
              coordinate[2] ?? 0,
            );
          },
          config,
        );
        nextTemperature[index] = Math.fround(
          oldTemperature +
            config.timeStep * config.thermalDiffusivity * temperatureLaplacian +
            0.5 *
              ((nextOrderParameter[index] ?? Number.NaN) -
                (state.orderParameter[index] ?? Number.NaN)),
        );
      }
    }
  }
  return nextTemperature;
}

export function stepCandidate2AThermalState(
  state: Candidate2AThermalState,
): Candidate2AThermalState {
  const { config } = state;
  const nextOrderParameter = new Float32Array(config.voxelCount);
  const phaseTerms = candidate2APhaseTerms(state);
  for (let index = 0; index < config.voxelCount; index += 1) {
    nextOrderParameter[index] = Math.fround(
      (state.orderParameter[index] ?? Number.NaN) +
        (config.timeStep *
          (phaseTerms.totalDrivingForce[index] ?? Number.NaN)) /
          (phaseTerms.relaxationTime[index] ?? Number.NaN),
    );
  }

  const nextTemperature = advanceCandidate2ATemperature(
    state,
    nextOrderParameter,
  );

  return {
    config,
    orderParameter: nextOrderParameter,
    temperature: nextTemperature,
    step: state.step + 1,
    simulatedTime: (state.step + 1) * config.timeStep,
  };
}

export function runCandidate2AThermalSteps(
  initial: Candidate2AThermalState,
  steps: number,
): Candidate2AThermalState {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a non-negative integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = stepCandidate2AThermalState(state);
  }
  return state;
}

export function interfacePositionAt(
  state: Candidate2AThermalState,
  y: number,
  z = Math.floor(state.config.shape[2] / 2),
): number {
  const { shape, spacing } = state.config;
  for (let x = 0; x < shape[0] - 1; x += 1) {
    const left =
      state.orderParameter[linearIndex(x, y, z, shape)] ?? Number.NaN;
    const right =
      state.orderParameter[linearIndex(x + 1, y, z, shape)] ?? Number.NaN;
    if (left >= 0 && right <= 0) {
      const fraction = left / (left - right);
      return (x + fraction) * spacing;
    }
  }
  return Number.NaN;
}

export function measureCandidate2APlanarSignature(
  initial: Candidate2AThermalState,
  final: Candidate2AThermalState,
): Candidate2APlanarSignature {
  const bulkY = Math.max(1, Math.floor((final.config.shape[1] * 3) / 4));
  const contactLineAdvance =
    interfacePositionAt(final, 0) - interfacePositionAt(initial, 0);
  const bulkAdvance =
    interfacePositionAt(final, bulkY) - interfacePositionAt(initial, bulkY);
  const excessContactLineAdvance = contactLineAdvance - bulkAdvance;
  return {
    contactLineAdvance,
    bulkAdvance,
    excessContactLineAdvance,
    finite: [contactLineAdvance, bulkAdvance, excessContactLineAdvance].every(
      Number.isFinite,
    ),
  };
}

/** Exact sharp-interface planar velocity, Karma-Rappel Eq. 73. */
export function sharpInterfacePlanarVelocity(
  undercooling: number,
  kineticCoefficient: number,
): number {
  return (undercooling - 1) / kineticCoefficient;
}

/** Exact liquid-side temperature, Karma-Rappel Eq. 74. */
export function sharpInterfaceLiquidTemperature(
  distanceFromInterface: number,
  undercooling: number,
  kineticCoefficient: number,
  thermalDiffusivity: number,
): number {
  const velocity = sharpInterfacePlanarVelocity(
    undercooling,
    kineticCoefficient,
  );
  return (
    Math.exp((-velocity * distanceFromInterface) / thermalDiffusivity) -
    undercooling
  );
}

export function totalDimensionlessEnthalpy(
  state: Candidate2AThermalState,
): number {
  let total = 0;
  for (let index = 0; index < state.config.voxelCount; index += 1) {
    total +=
      (state.temperature[index] ?? Number.NaN) -
      0.5 * (state.orderParameter[index] ?? Number.NaN);
  }
  return total;
}
