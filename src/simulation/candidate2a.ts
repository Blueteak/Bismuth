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
  /** Dimensionless h W / k in the finite-volume Robin boundary. */
  readonly biotNumber: number;
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
  /** Sharp-interface beta for the planar normal used by this isolation. */
  readonly kineticCoefficient: number;
  readonly initialFrontPosition: number;
  /** The fixed melt-air plane is y = 0. */
  readonly freeSurface: Candidate2AFreeSurfaceBoundary;
}

export interface DerivedCandidate2AThermalConfiguration extends Candidate2AThermalConfiguration {
  readonly voxelCount: number;
  readonly relaxationTime: number;
  readonly capillaryLength: number;
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

export interface Candidate2APlanarSignature {
  readonly contactLineAdvance: number;
  readonly bulkAdvance: number;
  readonly excessContactLineAdvance: number;
  readonly finite: boolean;
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
 * Explicit normals for the observed Bi {1-102} hexagonal family, equivalent
 * to {110} in the rhombohedral cell. These are reciprocal-plane normals, not
 * direct lattice translations used as support-function generators.
 */
export function bismuthSlowFacetNormals(
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

export function maximumFacetAlignment(
  normal: Vec3,
  facetNormals: readonly [Vec3, Vec3, Vec3],
): number {
  const unitNormal = normalize(normal);
  return Math.max(
    ...facetNormals.map((facetNormal) =>
      Math.abs(dot(unitNormal, facetNormal)),
    ),
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
  const alignment = maximumFacetAlignment(normal, facetNormals);
  return (
    parameters.surfaceEnergyScale *
    (1 -
      parameters.surfaceEnergyContrast *
        alignment ** parameters.alignmentExponent)
  );
}

/** beta(n); larger beta means slower sharp-interface attachment. */
export function bismuthKineticCoefficient(
  normal: Vec3,
  facetNormals: readonly [Vec3, Vec3, Vec3],
  parameters: Candidate2AFacetParameters,
): number {
  validateCandidate2AFacetParameters(parameters);
  const alignment = maximumFacetAlignment(normal, facetNormals);
  return (
    parameters.kineticCoefficientScale *
    (1 +
      parameters.kineticCoefficientContrast *
        alignment ** parameters.alignmentExponent)
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
    config.shape.some((size) => !Number.isInteger(size) || size < 1) ||
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
    ['kineticCoefficient', config.kineticCoefficient],
  ] as const) {
    assertFinitePositive(name, value);
  }
  if (
    !Number.isFinite(config.initialFrontPosition) ||
    config.initialFrontPosition <= config.spacing ||
    config.initialFrontPosition >= (config.shape[0] - 2) * config.spacing
  ) {
    throw new RangeError('initialFrontPosition must stay inside the x domain.');
  }
  if (
    !Number.isFinite(config.freeSurface.biotNumber) ||
    config.freeSurface.biotNumber < 0
  ) {
    throw new RangeError(
      'freeSurface.biotNumber must be finite and non-negative.',
    );
  }
  if (!Number.isFinite(config.freeSurface.ambientTemperature)) {
    throw new RangeError('freeSurface.ambientTemperature must be finite.');
  }
  if (config.freeSurface.enabled && config.shape[1] < 3) {
    throw new RangeError('The free-surface isolation requires y >= 3.');
  }
}

export function deriveCandidate2AThermalConfiguration(
  config: Candidate2AThermalConfiguration,
): DerivedCandidate2AThermalConfiguration {
  validateCandidate2AThermalConfiguration(config);
  const relaxationTime = relaxationTimeForKineticCoefficient(
    config.kineticCoefficient,
    config.interfaceWidth,
    config.couplingLambda,
    config.thermalDiffusivity,
  );
  const dimensions = config.shape.filter((size) => size > 1).length;
  const thermalLimit =
    config.spacing ** 2 / (2 * dimensions * config.thermalDiffusivity);
  const phaseLimit =
    (relaxationTime * config.spacing ** 2) /
    (2 * dimensions * config.interfaceWidth ** 2 + config.spacing ** 2);
  const maximumStableTimeStep = 0.8 * Math.min(thermalLimit, phaseLimit);
  if (config.timeStep > maximumStableTimeStep) {
    throw new RangeError(
      `timeStep ${config.timeStep} exceeds Candidate 2A explicit bound ${maximumStableTimeStep}.`,
    );
  }
  return {
    ...config,
    voxelCount: config.shape[0] * config.shape[1] * config.shape[2],
    relaxationTime,
    capillaryLength: thinInterfaceCapillaryLength(
      config.interfaceWidth,
      config.couplingLambda,
    ),
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
  x: number,
  config: DerivedCandidate2AThermalConfiguration,
): number {
  const signedDistance = x * config.spacing - config.initialFrontPosition;
  return -Math.tanh(signedDistance / (Math.sqrt(2) * config.interfaceWidth));
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
        orderParameter[index] = Math.fround(initialOrderParameter(x, config));
        temperature[index] = Math.fround(-config.undercooling);
      }
    }
  }
  return { config, orderParameter, temperature, step: 0, simulatedTime: 0 };
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
    return (
      center -
      config.spacing *
        config.freeSurface.biotNumber *
        (center - config.freeSurface.ambientTemperature)
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

export function stepCandidate2AThermalState(
  state: Candidate2AThermalState,
): Candidate2AThermalState {
  const { config } = state;
  const nextOrderParameter = new Float32Array(config.voxelCount);
  const nextTemperature = new Float32Array(config.voxelCount);

  for (let z = 0; z < config.shape[2]; z += 1) {
    for (let y = 0; y < config.shape[1]; y += 1) {
      for (let x = 0; x < config.shape[0]; x += 1) {
        const index = linearIndex(x, y, z, config.shape);
        const psi = state.orderParameter[index] ?? Number.NaN;
        const temperature = state.temperature[index] ?? Number.NaN;
        const phaseLaplacian = laplacian(
          psi,
          (axis, offset) => {
            const coordinate = [x, y, z];
            coordinate[axis] = (coordinate[axis] ?? 0) + offset;
            return clampedSample(
              state.orderParameter,
              coordinate[0] ?? 0,
              coordinate[1] ?? 0,
              coordinate[2] ?? 0,
              config.shape,
            );
          },
          config,
        );
        const oneMinusPsiSquared = 1 - psi * psi;
        const localRate =
          (psi - config.couplingLambda * temperature * oneMinusPsiSquared) *
          oneMinusPsiSquared;
        nextOrderParameter[index] = Math.fround(
          psi +
            (config.timeStep / config.relaxationTime) *
              (config.interfaceWidth ** 2 * phaseLaplacian + localRate),
        );
      }
    }
  }

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
