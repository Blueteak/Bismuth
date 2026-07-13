export type Vec3 = readonly [number, number, number];

export type GridShape = readonly [number, number, number];

export type SimulationPresetName = 'cube' | 'hopper' | 'fractal' | 'dendritic';

export type CrystalSymmetry = 'cubic';

export type PhaseOperator = 'conservative-flux' | 'author-centered';

export type DomainMode = 'full' | 'octant';

export interface PhaseFieldParameters {
  readonly mobility: number;
  readonly liquidConcentration: number;
  readonly solidConcentration: number;
  readonly equilibriumChemicalPotential: number;
  readonly freeEnergyCurvature: number;
  readonly liquidDiffusivity: number;
  readonly solidDiffusivityRatio: number;
  readonly criticalRadius: number;
  readonly initialRadius: number;
  readonly interfaceWidth: number;
  readonly anisotropyRegularization: number;
  /** Fixed gradient-energy scale; reference source uses 1/[3(1+epsilon)^2]. */
  readonly surfaceEnergyScale: number;
  readonly farFieldChemicalPotential: number;
}

export interface GridConfiguration {
  readonly shape: GridShape;
  readonly spacing: number;
  readonly timeStep: number;
  readonly solidificationThreshold: number;
}

/** Intrinsic X-Y-Z crystal rotations, in radians. */
export interface EulerOrientation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PerturbationConfiguration {
  readonly seed: number;
  /** Maximum absolute change to the analytical seed radius. */
  readonly seedRadiusAmplitude: number;
  readonly seedRadiusCorrelationLength: number;
  /** Maximum absolute liquid-side change to the initial chemical potential. */
  readonly chemicalPotentialAmplitude: number;
  readonly chemicalPotentialCorrelationLength: number;
  /** Chemical-potential change per unit physical length. */
  readonly farFieldGradient: Vec3;
}

export interface SimulationConfiguration {
  readonly preset: SimulationPresetName;
  readonly crystalSymmetry: CrystalSymmetry;
  readonly phaseOperator: PhaseOperator;
  readonly domainMode: DomainMode;
  readonly parameters: PhaseFieldParameters;
  readonly grid: GridConfiguration;
  readonly orientation: EulerOrientation;
  readonly perturbations: PerturbationConfiguration;
}

export interface DerivedSimulationConfiguration extends SimulationConfiguration {
  readonly deltaConcentration: number;
  readonly solidDiffusivity: number;
  readonly couplingLambda: number;
  /**
   * Fixed normalization used by the reference implementation's active cubic
   * anisotropy branch. The published Eq. 8 omits this implementation factor.
   */
  readonly surfaceEnergyNormalization: number;
  readonly voxelCount: number;
  readonly domainCenter: Vec3;
  readonly domainMinimum: Vec3;
  readonly domainMaximum: Vec3;
  readonly crystalAxes: readonly [Vec3, Vec3, Vec3];
  readonly maximumStableTimeStep: number;
}

export interface SimulationConfigurationOverrides {
  readonly phaseOperator?: PhaseOperator;
  readonly domainMode?: DomainMode;
  readonly parameters?: Partial<PhaseFieldParameters>;
  readonly grid?: Partial<GridConfiguration>;
  readonly orientation?: Partial<EulerOrientation>;
  readonly perturbations?: Partial<PerturbationConfiguration>;
}

export function referenceSurfaceEnergyScale(epsilon: number): number {
  return 1 / (3 * (1 + epsilon) * (1 + epsilon));
}

/** Constants from Bollada, Jimack, and Mullis (2023), Table 1. */
export const PAPER_CONSTANTS: Readonly<PhaseFieldParameters> = Object.freeze({
  mobility: 1,
  liquidConcentration: 0.9,
  solidConcentration: 0.5,
  equilibriumChemicalPotential: 1,
  freeEnergyCurvature: 4,
  liquidDiffusivity: 1 / 12,
  solidDiffusivityRatio: 1e-4,
  criticalRadius: 10,
  initialRadius: 20,
  interfaceWidth: 2,
  anisotropyRegularization: 0.02,
  surfaceEnergyScale: referenceSurfaceEnergyScale(0.02),
  farFieldChemicalPotential: 0.04,
});

const DEFAULT_GRID: GridConfiguration = {
  shape: [65, 65, 65],
  spacing: 2,
  timeStep: 0.01,
  solidificationThreshold: 0.5,
};

const DEFAULT_ORIENTATION: EulerOrientation = { x: 0, y: 0, z: 0 };

const DEFAULT_PERTURBATIONS: PerturbationConfiguration = {
  seed: 0,
  seedRadiusAmplitude: 0,
  seedRadiusCorrelationLength: 8,
  chemicalPotentialAmplitude: 0,
  chemicalPotentialCorrelationLength: 12,
  farFieldGradient: [0, 0, 0],
};

function paperPreset(
  preset: SimulationPresetName,
  liquidDiffusivity: number,
  timeStep = 0.01,
): SimulationConfiguration {
  return {
    preset,
    crystalSymmetry: 'cubic',
    phaseOperator: 'conservative-flux',
    domainMode: 'full',
    parameters: { ...PAPER_CONSTANTS, liquidDiffusivity },
    grid: { ...DEFAULT_GRID, timeStep },
    orientation: { ...DEFAULT_ORIENTATION },
    perturbations: {
      ...DEFAULT_PERTURBATIONS,
      farFieldGradient: [...DEFAULT_PERTURBATIONS.farFieldGradient],
    },
  };
}

/**
 * Paper morphology series at mu-infinity = 0.04. The cube and fractal labels
 * follow the descriptions of the D_L = 20 and D_L = 1/2 results.
 */
export const SIMULATION_PRESETS: Readonly<
  Record<SimulationPresetName, SimulationConfiguration>
> = Object.freeze({
  cube: paperPreset('cube', 20, 0.005),
  hopper: paperPreset('hopper', 1 / 12),
  fractal: paperPreset('fractal', 0.5),
  dendritic: paperPreset('dendritic', 4),
});

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function assertPositive(name: string, value: number): void {
  if (!isFiniteNumber(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function assertNonNegative(name: string, value: number): void {
  if (!isFiniteNumber(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** Returns world-space crystal axes for Rz * Ry * Rx. */
export function crystalAxesFromEuler(
  orientation: EulerOrientation,
): readonly [Vec3, Vec3, Vec3] {
  const cx = Math.cos(orientation.x);
  const sx = Math.sin(orientation.x);
  const cy = Math.cos(orientation.y);
  const sy = Math.sin(orientation.y);
  const cz = Math.cos(orientation.z);
  const sz = Math.sin(orientation.z);

  return [
    normalize([cz * cy, sz * cy, -sy]),
    normalize([cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx]),
    normalize([cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx]),
  ];
}

function maximumStableTimeStep(config: SimulationConfiguration): number {
  const { parameters, grid } = config;
  const dimensions = 3;
  const epsilon = parameters.anisotropyRegularization;
  const surfaceEnergyNormalization = parameters.surfaceEnergyScale;
  // Exact trace at a cubic facet normal. The transverse stiffness grows as
  // 1 / epsilon, so bounding A itself is insufficient.
  const axisRoot = Math.sqrt(1 + epsilon * epsilon);
  const axisAnisotropy = axisRoot + 2 * epsilon;
  const normalStiffness = axisAnisotropy * axisAnisotropy;
  const transverseStiffness =
    axisAnisotropy *
    ((epsilon * epsilon) / axisRoot + 1 / epsilon + 2 * epsilon);
  const anisotropyTrace = normalStiffness + 2 * transverseStiffness;
  const phaseDiffusionTrace =
    parameters.mobility * surfaceEnergyNormalization * anisotropyTrace;
  const phaseDiffusionEigenvalue =
    (4 * phaseDiffusionTrace) / (grid.spacing * grid.spacing);
  const deltaConcentration =
    parameters.liquidConcentration - parameters.solidConcentration;
  const couplingLambda =
    (3 * parameters.criticalRadius * deltaConcentration ** 2) /
    parameters.interfaceWidth;
  const halfExtents = grid.shape.map((size) =>
    config.domainMode === 'octant'
      ? (size - 1) * grid.spacing
      : ((size - 1) * grid.spacing) / 2,
  );
  const farFieldExcursion =
    Math.abs(config.perturbations.farFieldGradient[0]) * (halfExtents[0] ?? 0) +
    Math.abs(config.perturbations.farFieldGradient[1]) * (halfExtents[1] ?? 0) +
    Math.abs(config.perturbations.farFieldGradient[2]) * (halfExtents[2] ?? 0);
  const maximumInitialChemicalDeparture =
    Math.abs(
      parameters.equilibriumChemicalPotential -
        parameters.farFieldChemicalPotential,
    ) +
    farFieldExcursion +
    config.perturbations.chemicalPotentialAmplitude;
  const localPhaseStiffness =
    (parameters.mobility / parameters.interfaceWidth ** 2) *
    (1 +
      (6 * maximumInitialChemicalDeparture * deltaConcentration) /
        couplingLambda);
  const phaseLimit = 2 / (phaseDiffusionEigenvalue + localPhaseStiffness);
  const solidDiffusivity =
    parameters.liquidDiffusivity * parameters.solidDiffusivityRatio;
  const chemicalDiffusion =
    parameters.freeEnergyCurvature *
    Math.max(parameters.liquidDiffusivity, solidDiffusivity);
  const chemicalLimit =
    grid.spacing ** 2 / (2 * dimensions * chemicalDiffusion);

  // The paper reports stable adaptive steps in [0.001, 0.01] at dx = 2.
  return Math.min(0.01, 0.9 * phaseLimit, 0.9 * chemicalLimit);
}

export function validateSimulationConfiguration(
  config: SimulationConfiguration,
): void {
  const { parameters, grid, orientation, perturbations } = config;

  if (
    config.phaseOperator !== 'conservative-flux' &&
    config.phaseOperator !== 'author-centered'
  ) {
    throw new RangeError(
      `Unknown phase operator: ${String(config.phaseOperator)}.`,
    );
  }
  if (config.crystalSymmetry !== 'cubic') {
    throw new RangeError(
      `Unknown crystal symmetry: ${String(config.crystalSymmetry)}.`,
    );
  }
  if (config.domainMode !== 'full' && config.domainMode !== 'octant') {
    throw new RangeError(`Unknown domain mode: ${String(config.domainMode)}.`);
  }

  if (!(config.preset in SIMULATION_PRESETS)) {
    throw new RangeError(`Unknown simulation preset: ${config.preset}.`);
  }

  assertPositive('mobility', parameters.mobility);
  assertPositive('liquidConcentration', parameters.liquidConcentration);
  assertNonNegative('solidConcentration', parameters.solidConcentration);
  if (parameters.liquidConcentration <= parameters.solidConcentration) {
    throw new RangeError('liquidConcentration must exceed solidConcentration.');
  }
  if (!isFiniteNumber(parameters.equilibriumChemicalPotential)) {
    throw new RangeError(
      'equilibriumChemicalPotential must be a finite number.',
    );
  }
  if (!isFiniteNumber(parameters.farFieldChemicalPotential)) {
    throw new RangeError('farFieldChemicalPotential must be a finite number.');
  }
  assertPositive('freeEnergyCurvature', parameters.freeEnergyCurvature);
  assertPositive('liquidDiffusivity', parameters.liquidDiffusivity);
  assertPositive('solidDiffusivityRatio', parameters.solidDiffusivityRatio);
  if (parameters.solidDiffusivityRatio > 1) {
    throw new RangeError('solidDiffusivityRatio must not exceed 1.');
  }
  assertPositive('criticalRadius', parameters.criticalRadius);
  assertPositive('initialRadius', parameters.initialRadius);
  assertPositive('interfaceWidth', parameters.interfaceWidth);
  assertPositive(
    'anisotropyRegularization',
    parameters.anisotropyRegularization,
  );
  assertPositive('surfaceEnergyScale', parameters.surfaceEnergyScale);

  for (const [axis, size] of grid.shape.entries()) {
    if (!Number.isInteger(size) || size < 5) {
      throw new RangeError(
        `grid.shape[${axis}] must be an integer greater than or equal to 5.`,
      );
    }
  }
  assertPositive('grid.spacing', grid.spacing);
  assertPositive('grid.timeStep', grid.timeStep);
  if (
    !isFiniteNumber(grid.solidificationThreshold) ||
    grid.solidificationThreshold <= 0 ||
    grid.solidificationThreshold >= 1
  ) {
    throw new RangeError(
      'solidificationThreshold must lie strictly in (0, 1).',
    );
  }

  for (const [name, angle] of [
    ['x', orientation.x],
    ['y', orientation.y],
    ['z', orientation.z],
  ] as const) {
    if (!isFiniteNumber(angle)) {
      throw new RangeError(`orientation.${name} must be finite.`);
    }
  }

  if (
    config.domainMode === 'octant' &&
    (orientation.x !== 0 || orientation.y !== 0 || orientation.z !== 0)
  ) {
    throw new RangeError(
      'Octant symmetry requires the axis-aligned crystal orientation.',
    );
  }

  if (
    !Number.isInteger(perturbations.seed) ||
    perturbations.seed < 0 ||
    perturbations.seed > 0xffff_ffff
  ) {
    throw new RangeError('perturbations.seed must be a uint32 integer.');
  }
  assertNonNegative(
    'perturbations.seedRadiusAmplitude',
    perturbations.seedRadiusAmplitude,
  );
  const maximumSeedRadiusAmplitude = Math.min(
    parameters.interfaceWidth,
    parameters.initialRadius - parameters.interfaceWidth,
  );
  if (
    maximumSeedRadiusAmplitude <= 0 ||
    perturbations.seedRadiusAmplitude > maximumSeedRadiusAmplitude
  ) {
    throw new RangeError(
      'perturbations.seedRadiusAmplitude must preserve a positive seed core and must not exceed one interface width.',
    );
  }
  assertPositive(
    'perturbations.seedRadiusCorrelationLength',
    perturbations.seedRadiusCorrelationLength,
  );
  assertNonNegative(
    'perturbations.chemicalPotentialAmplitude',
    perturbations.chemicalPotentialAmplitude,
  );
  assertPositive(
    'perturbations.chemicalPotentialCorrelationLength',
    perturbations.chemicalPotentialCorrelationLength,
  );
  const minimumCorrelationLength = Math.max(
    parameters.interfaceWidth,
    2 * grid.spacing,
  );
  if (
    perturbations.seedRadiusCorrelationLength < minimumCorrelationLength ||
    perturbations.chemicalPotentialCorrelationLength < minimumCorrelationLength
  ) {
    throw new RangeError(
      'Perturbation correlation lengths must span the interface and at least two grid cells.',
    );
  }
  const maximumChemicalPerturbation =
    0.1 *
    Math.abs(
      parameters.equilibriumChemicalPotential -
        parameters.farFieldChemicalPotential,
    );
  if (perturbations.chemicalPotentialAmplitude > maximumChemicalPerturbation) {
    throw new RangeError(
      'perturbations.chemicalPotentialAmplitude must not exceed ten percent of the imposed chemical driving.',
    );
  }
  perturbations.farFieldGradient.forEach((component, axis) => {
    if (!isFiniteNumber(component)) {
      throw new RangeError(`farFieldGradient[${axis}] must be finite.`);
    }
  });
  if (
    config.domainMode === 'octant' &&
    (perturbations.seedRadiusAmplitude !== 0 ||
      perturbations.chemicalPotentialAmplitude !== 0 ||
      perturbations.farFieldGradient.some((component) => component !== 0))
  ) {
    throw new RangeError(
      'Octant symmetry requires unperturbed initial and reservoir conditions.',
    );
  }

  const halfExtents = grid.shape.map((size) =>
    config.domainMode === 'octant'
      ? (size - 1) * grid.spacing
      : ((size - 1) * grid.spacing) / 2,
  );
  const farFieldExcursion =
    Math.abs(perturbations.farFieldGradient[0]) * (halfExtents[0] ?? 0) +
    Math.abs(perturbations.farFieldGradient[1]) * (halfExtents[1] ?? 0) +
    Math.abs(perturbations.farFieldGradient[2]) * (halfExtents[2] ?? 0) +
    perturbations.chemicalPotentialAmplitude;
  if (
    parameters.farFieldChemicalPotential - farFieldExcursion < -0.6 ||
    parameters.farFieldChemicalPotential + farFieldExcursion > 1
  ) {
    throw new RangeError(
      'Perturbed chemical-potential conditions must remain within the paper model range [-0.6, 1].',
    );
  }

  const halfExtent = Math.min(...halfExtents);
  const requiredSeedExtent =
    parameters.initialRadius +
    perturbations.seedRadiusAmplitude +
    2 * parameters.interfaceWidth;
  if (requiredSeedExtent >= halfExtent) {
    throw new RangeError(
      'The initial diffuse seed must fit inside the domain with two interface widths of clearance.',
    );
  }

  const stableTimeStep = maximumStableTimeStep(config);
  if (grid.timeStep > stableTimeStep * (1 + 1e-12)) {
    throw new RangeError(
      `grid.timeStep exceeds the conservative explicit stability limit ${stableTimeStep}.`,
    );
  }
}

export function createSimulationConfiguration(
  preset: SimulationPresetName,
  overrides: SimulationConfigurationOverrides = {},
): SimulationConfiguration {
  const base = SIMULATION_PRESETS[preset];
  const parameterOverrides = { ...overrides.parameters };
  if (
    parameterOverrides.anisotropyRegularization !== undefined &&
    parameterOverrides.surfaceEnergyScale === undefined
  ) {
    parameterOverrides.surfaceEnergyScale = referenceSurfaceEnergyScale(
      parameterOverrides.anisotropyRegularization,
    );
  }
  const config: SimulationConfiguration = {
    preset,
    crystalSymmetry: base.crystalSymmetry,
    phaseOperator: overrides.phaseOperator ?? base.phaseOperator,
    domainMode: overrides.domainMode ?? base.domainMode,
    parameters: { ...base.parameters, ...parameterOverrides },
    grid: {
      ...base.grid,
      ...overrides.grid,
      shape: overrides.grid?.shape ?? [...base.grid.shape],
    },
    orientation: { ...base.orientation, ...overrides.orientation },
    perturbations: {
      ...base.perturbations,
      ...overrides.perturbations,
      farFieldGradient: overrides.perturbations?.farFieldGradient ?? [
        ...base.perturbations.farFieldGradient,
      ],
    },
  };

  validateSimulationConfiguration(config);
  return config;
}

export function deriveSimulationConfiguration(
  config: SimulationConfiguration,
): DerivedSimulationConfiguration {
  validateSimulationConfiguration(config);
  const deltaConcentration =
    config.parameters.liquidConcentration -
    config.parameters.solidConcentration;
  const [width, height, depth] = config.grid.shape;
  const domainCenter: Vec3 =
    config.domainMode === 'octant'
      ? [0, 0, 0]
      : [
          ((width - 1) * config.grid.spacing) / 2,
          ((height - 1) * config.grid.spacing) / 2,
          ((depth - 1) * config.grid.spacing) / 2,
        ];
  const domainMinimum: Vec3 =
    config.domainMode === 'octant'
      ? [0, 0, 0]
      : [-domainCenter[0], -domainCenter[1], -domainCenter[2]];
  const domainMaximum: Vec3 = [
    (width - 1) * config.grid.spacing - domainCenter[0],
    (height - 1) * config.grid.spacing - domainCenter[1],
    (depth - 1) * config.grid.spacing - domainCenter[2],
  ];

  return {
    ...config,
    deltaConcentration,
    solidDiffusivity:
      config.parameters.liquidDiffusivity *
      config.parameters.solidDiffusivityRatio,
    couplingLambda:
      (3 * config.parameters.criticalRadius * deltaConcentration ** 2) /
      config.parameters.interfaceWidth,
    surfaceEnergyNormalization: config.parameters.surfaceEnergyScale,
    voxelCount: width * height * depth,
    domainCenter,
    domainMinimum,
    domainMaximum,
    crystalAxes: crystalAxesFromEuler(config.orientation),
    maximumStableTimeStep: maximumStableTimeStep(config),
  };
}

/** Position is measured in physical coordinates relative to domain center. */
export function farFieldChemicalPotentialAt(
  config: SimulationConfiguration,
  position: Vec3,
): number {
  const gradient = config.perturbations.farFieldGradient;
  return (
    config.parameters.farFieldChemicalPotential +
    gradient[0] * position[0] +
    gradient[1] * position[1] +
    gradient[2] * position[2]
  );
}
