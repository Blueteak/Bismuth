import {
  createInitialCpuState,
  gridIndex,
  solveCpuCoupledBackwardEulerStep,
  stepCpuSimulation,
  type CpuCoupledStepDiagnostics,
  type CpuSimulationState,
} from './cpu-reference';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
  type DerivedSimulationConfiguration,
} from './config';
import {
  measureGrowthMaturity,
  measureSolidBounds,
  measureTransitionMorphology,
  summarizeField,
  type FieldSummary,
} from './metrics';

const FULL_TIME_STEP = 0.01;
const HALF_TIME_STEP = 0.005;
const END_TIME = 0.2;
const WALL_BUDGET_MILLISECONDS = 25_000;
const RESIDUAL_TOLERANCE = 2e-7;
const MAXIMUM_ITERATIONS = 32;
const GRID_SIZES = [17, 25] as const;

type Direction = readonly [0 | 1, 0 | 1, 0 | 1];

const FACE_DIRECTIONS: readonly Direction[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const EDGE_DIRECTIONS: readonly Direction[] = [
  [1, 1, 0],
  [1, 0, 1],
  [0, 1, 1],
];
const BODY_DIAGONAL_DIRECTIONS: readonly Direction[] = [[1, 1, 1]];

export interface CpuExperimentFieldDifference {
  readonly maximumAbsolute: number;
  readonly rootMeanSquare: number;
  readonly interfaceMaximumAbsolute: number;
  readonly interfaceRootMeanSquare: number;
  readonly interfaceSampleCount: number;
}

export interface ContinuousDirectionalReach {
  readonly face: number;
  readonly edge: number;
  readonly bodyDiagonal: number;
  readonly bodyDiagonalToFaceRatio: number;
}

export interface CpuExperimentStateSummary {
  readonly phase: FieldSummary;
  readonly chemicalPotential: FieldSummary;
  readonly solidVoxelCount: number;
  readonly phaseOccupancyIntegral: number;
  readonly boundingBoxFillFraction: number;
  readonly surfaceComplexity: number;
  readonly connectedComponentCount: number;
  readonly largestConnectedComponentFraction: number;
  readonly integerDirectionalReach: {
    readonly face: number;
    readonly edge: number;
    readonly bodyDiagonal: number;
    readonly bodyDiagonalToFaceRatio: number;
  };
  readonly continuousDirectionalReach: ContinuousDirectionalReach;
}

export interface CpuExperimentMethodResult {
  readonly steps: number;
  readonly simulatedTime: number;
  readonly wallMilliseconds: number;
  readonly state: CpuExperimentStateSummary;
  readonly trajectory: CpuExperimentTrajectorySummary;
}

export interface CpuExperimentTrajectorySummary {
  readonly phaseMinimum: number;
  readonly phaseMaximum: number;
  readonly phaseNonFiniteCount: number;
  readonly chemicalPotentialMinimum: number;
  readonly chemicalPotentialMaximum: number;
  readonly chemicalPotentialNonFiniteCount: number;
}

export interface CpuExperimentCoupledMethodResult extends CpuExperimentMethodResult {
  readonly iterationMinimum: number;
  readonly iterationMaximum: number;
  readonly iterationMean: number;
  readonly maximumFinalNormalizedResidual: number;
  readonly maximumFinalNormalizedUpdate: number;
  readonly oneStepPredictorResidual: CpuCoupledStepDiagnostics['predictorResidual'];
  readonly oneStepFinalResidual: CpuCoupledStepDiagnostics['residual'];
}

export interface CpuExperimentDomainResult {
  readonly grid: readonly [number, number, number];
  readonly spacing: number;
  readonly domainMaximum: number;
  readonly initial: CpuExperimentStateSummary;
  readonly split: CpuExperimentMethodResult;
  readonly coupled: CpuExperimentCoupledMethodResult;
  readonly refinedSplit: CpuExperimentMethodResult;
  readonly refinedCoupled: CpuExperimentCoupledMethodResult;
  readonly splitVersusCoupled: {
    readonly phase: CpuExperimentFieldDifference;
    readonly chemicalPotential: CpuExperimentFieldDifference;
    readonly continuousReachDelta: ContinuousDirectionalReach;
  };
  readonly splitVersusRefined: {
    readonly phase: CpuExperimentFieldDifference;
    readonly chemicalPotential: CpuExperimentFieldDifference;
    readonly continuousReachDelta: ContinuousDirectionalReach;
  };
  readonly refinedSplitVersusRefinedCoupled: {
    readonly phase: CpuExperimentFieldDifference;
    readonly chemicalPotential: CpuExperimentFieldDifference;
    readonly continuousReachDelta: ContinuousDirectionalReach;
  };
  readonly coupledVersusRefinedCoupled: {
    readonly phase: CpuExperimentFieldDifference;
    readonly chemicalPotential: CpuExperimentFieldDifference;
    readonly continuousReachDelta: ContinuousDirectionalReach;
  };
}

export interface CpuCouplingExperimentResult {
  readonly configuration: {
    readonly phaseOperator: 'author-centered';
    readonly domainMode: 'octant';
    readonly precision: 'float32';
    readonly grids: readonly [17, 25];
    readonly spacing: 2;
    readonly fullTimeStep: 0.01;
    readonly halfTimeStep: 0.005;
    readonly endTime: number;
    readonly liquidDiffusivity: 4;
    readonly farFieldChemicalPotential: 0.04;
    readonly criticalRadius: 10;
    readonly initialRadius: 20;
    readonly interfaceWidth: 2;
    readonly residualTolerance: number;
    readonly maximumIterations: number;
    readonly relaxation: 1;
  };
  readonly domains: readonly CpuExperimentDomainResult[];
  readonly interpretation: {
    readonly splitMinusCoupledDirectionalRatioDelta: readonly number[];
    readonly refinedSplitMinusRefinedCoupledDirectionalRatioDelta: readonly number[];
    readonly couplingTimeStepScaling: number;
    readonly couplingDirectionConsistentAcrossDomainsAndTimeSteps: boolean;
    readonly couplingSignalExceedsDomainVariation: boolean;
    readonly couplingShowsFirstOrderTimeStepScaling: boolean;
    readonly sourceDirectedDirectionalSignal: boolean;
    readonly awayFromSourceDirectionalSignal: boolean;
    readonly matureRunRecommended: boolean;
    readonly reason: string;
  };
  readonly runtime: {
    readonly matrixWallMilliseconds: number;
    readonly budgetMilliseconds: number;
    readonly passed: boolean;
  };
  readonly checks: {
    readonly allCoupledStepsConverged: boolean;
    readonly fieldsFinite: boolean;
    readonly phaseRangeBounded: boolean;
    readonly oneStepChemicalResidualReductionAtLeast100: boolean;
    readonly passed: boolean;
  };
  readonly limitations: readonly string[];
}

export interface CpuCouplingExperimentOptions {
  readonly deadline?: number;
}

function createExperimentConfiguration(
  gridSize: number,
  timeStep: number,
): DerivedSimulationConfiguration {
  return deriveSimulationConfiguration(
    createSimulationConfiguration('dendritic', {
      phaseOperator: 'author-centered',
      domainMode: 'octant',
      grid: {
        shape: [gridSize, gridSize, gridSize],
        spacing: 2,
        timeStep,
      },
      perturbations: {
        seedRadiusAmplitude: 0,
        chemicalPotentialAmplitude: 0,
        farFieldGradient: [0, 0, 0],
      },
    }),
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function interpolatedRayReach(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
  direction: Direction,
): number {
  const { shape, spacing, solidificationThreshold } = config.grid;
  let previous = phase[gridIndex(0, 0, 0, shape)] ?? Number.NaN;
  if (!Number.isFinite(previous)) return Number.NaN;
  if (previous > solidificationThreshold) return 0;
  const maximumStep = Math.min(
    ...direction
      .map((component, axis) =>
        component === 0 ? Number.POSITIVE_INFINITY : (shape[axis] ?? 1) - 1,
      )
      .filter(Number.isFinite),
  );

  for (let step = 1; step <= maximumStep; step += 1) {
    const current =
      phase[
        gridIndex(
          direction[0] * step,
          direction[1] * step,
          direction[2] * step,
          shape,
        )
      ] ?? Number.NaN;
    if (!Number.isFinite(current)) return Number.NaN;
    if (
      previous <= solidificationThreshold &&
      current > solidificationThreshold
    ) {
      const fraction =
        (solidificationThreshold - previous) / (current - previous);
      return (step - 1 + fraction) * spacing;
    }
    previous = current;
  }

  return maximumStep * spacing;
}

export function measureContinuousDirectionalReach(
  phase: Float32Array,
  config: DerivedSimulationConfiguration,
): ContinuousDirectionalReach {
  const face = mean(
    FACE_DIRECTIONS.map((direction) =>
      interpolatedRayReach(phase, config, direction),
    ),
  );
  const edge = mean(
    EDGE_DIRECTIONS.map((direction) =>
      interpolatedRayReach(phase, config, direction),
    ),
  );
  const bodyDiagonal = mean(
    BODY_DIAGONAL_DIRECTIONS.map((direction) =>
      interpolatedRayReach(phase, config, direction),
    ),
  );
  return {
    face,
    edge,
    bodyDiagonal,
    bodyDiagonalToFaceRatio: bodyDiagonal / face,
  };
}

function subtractReach(
  left: ContinuousDirectionalReach,
  right: ContinuousDirectionalReach,
): ContinuousDirectionalReach {
  return {
    face: left.face - right.face,
    edge: left.edge - right.edge,
    bodyDiagonal: left.bodyDiagonal - right.bodyDiagonal,
    bodyDiagonalToFaceRatio:
      left.bodyDiagonalToFaceRatio - right.bodyDiagonalToFaceRatio,
  };
}

function measureFieldDifference(
  left: Float32Array,
  right: Float32Array,
  leftPhase: Float32Array,
  rightPhase: Float32Array,
): CpuExperimentFieldDifference {
  let maximumAbsolute = 0;
  let sumSquares = 0;
  let interfaceMaximumAbsolute = 0;
  let interfaceSumSquares = 0;
  let interfaceSampleCount = 0;

  for (let index = 0; index < left.length; index += 1) {
    const difference =
      (left[index] ?? Number.NaN) - (right[index] ?? Number.NaN);
    const absoluteDifference = Math.abs(difference);
    maximumAbsolute = Math.max(maximumAbsolute, absoluteDifference);
    sumSquares += difference * difference;
    const firstPhase = leftPhase[index] ?? Number.NaN;
    const secondPhase = rightPhase[index] ?? Number.NaN;
    if (
      (firstPhase >= 0.05 && firstPhase <= 0.95) ||
      (secondPhase >= 0.05 && secondPhase <= 0.95)
    ) {
      interfaceMaximumAbsolute = Math.max(
        interfaceMaximumAbsolute,
        absoluteDifference,
      );
      interfaceSumSquares += difference * difference;
      interfaceSampleCount += 1;
    }
  }

  return {
    maximumAbsolute,
    rootMeanSquare: Math.sqrt(sumSquares / left.length),
    interfaceMaximumAbsolute,
    interfaceRootMeanSquare: Math.sqrt(
      interfaceSumSquares / Math.max(1, interfaceSampleCount),
    ),
    interfaceSampleCount,
  };
}

function summarizeState(state: CpuSimulationState): CpuExperimentStateSummary {
  const bounds = measureSolidBounds(state.phase, state.config);
  const transition = measureTransitionMorphology(state.phase, state.config);
  const maturity = measureGrowthMaturity(state.phase, state.config);
  let phaseOccupancy = 0;
  for (const value of state.phase) phaseOccupancy += 1 - value;
  const spacing = state.config.grid.spacing;

  return {
    phase: summarizeField(state.phase),
    chemicalPotential: summarizeField(state.chemicalPotential),
    solidVoxelCount: bounds.voxelCount,
    phaseOccupancyIntegral: phaseOccupancy * spacing ** 3,
    boundingBoxFillFraction: transition.boundingBoxFillFraction,
    surfaceComplexity: transition.surfaceComplexity,
    connectedComponentCount: transition.connectedComponentCount,
    largestConnectedComponentFraction:
      transition.largestConnectedComponentFraction,
    integerDirectionalReach: {
      face: maturity.directionalReach.meanFace,
      edge: maturity.directionalReach.meanEdge,
      bodyDiagonal: maturity.directionalReach.meanBodyDiagonal,
      bodyDiagonalToFaceRatio:
        maturity.directionalReach.bodyDiagonalToFaceRatio,
    },
    continuousDirectionalReach: measureContinuousDirectionalReach(
      state.phase,
      state.config,
    ),
  };
}

function beginTrajectory(
  state: CpuSimulationState,
): CpuExperimentTrajectorySummary {
  const phase = summarizeField(state.phase);
  const chemicalPotential = summarizeField(state.chemicalPotential);
  return {
    phaseMinimum: phase.minimum,
    phaseMaximum: phase.maximum,
    phaseNonFiniteCount: phase.nonFiniteCount,
    chemicalPotentialMinimum: chemicalPotential.minimum,
    chemicalPotentialMaximum: chemicalPotential.maximum,
    chemicalPotentialNonFiniteCount: chemicalPotential.nonFiniteCount,
  };
}

function extendTrajectory(
  trajectory: CpuExperimentTrajectorySummary,
  state: CpuSimulationState,
): CpuExperimentTrajectorySummary {
  const phase = summarizeField(state.phase);
  const chemicalPotential = summarizeField(state.chemicalPotential);
  return {
    phaseMinimum: Math.min(trajectory.phaseMinimum, phase.minimum),
    phaseMaximum: Math.max(trajectory.phaseMaximum, phase.maximum),
    phaseNonFiniteCount: trajectory.phaseNonFiniteCount + phase.nonFiniteCount,
    chemicalPotentialMinimum: Math.min(
      trajectory.chemicalPotentialMinimum,
      chemicalPotential.minimum,
    ),
    chemicalPotentialMaximum: Math.max(
      trajectory.chemicalPotentialMaximum,
      chemicalPotential.maximum,
    ),
    chemicalPotentialNonFiniteCount:
      trajectory.chemicalPotentialNonFiniteCount +
      chemicalPotential.nonFiniteCount,
  };
}

function requireBeforeDeadline(deadline: number): void {
  if (performance.now() > deadline) {
    throw new Error(
      'The coupled CPU experiment exceeded its 25000 ms deadline.',
    );
  }
}

function runSplit(
  initial: CpuSimulationState,
  steps: number,
  deadline: number,
): {
  readonly state: CpuSimulationState;
  readonly wallMilliseconds: number;
  readonly trajectory: CpuExperimentTrajectorySummary;
} {
  const started = performance.now();
  let state = initial;
  let trajectory = beginTrajectory(state);
  for (let step = 0; step < steps; step += 1) {
    requireBeforeDeadline(deadline);
    state = stepCpuSimulation(state);
    trajectory = extendTrajectory(trajectory, state);
    requireBeforeDeadline(deadline);
  }
  return {
    state,
    wallMilliseconds: performance.now() - started,
    trajectory,
  };
}

function runCoupled(
  initial: CpuSimulationState,
  steps: number,
  deadline: number,
): {
  readonly state: CpuSimulationState;
  readonly wallMilliseconds: number;
  readonly diagnostics: readonly CpuCoupledStepDiagnostics[];
  readonly trajectory: CpuExperimentTrajectorySummary;
} {
  const started = performance.now();
  let state = initial;
  let trajectory = beginTrajectory(state);
  const diagnostics: CpuCoupledStepDiagnostics[] = [];
  for (let step = 0; step < steps; step += 1) {
    requireBeforeDeadline(deadline);
    const result = solveCpuCoupledBackwardEulerStep(state, {
      maximumIterations: MAXIMUM_ITERATIONS,
      residualTolerance: RESIDUAL_TOLERANCE,
      relaxation: 1,
    });
    diagnostics.push(result.diagnostics);
    if (result.state === null) {
      throw new Error(
        `Coupled backward-Euler solve did not converge at step ${step + 1}.`,
      );
    }
    state = result.state;
    trajectory = extendTrajectory(trajectory, state);
    requireBeforeDeadline(deadline);
  }
  return {
    state,
    wallMilliseconds: performance.now() - started,
    diagnostics,
    trajectory,
  };
}

function compareStates(left: CpuSimulationState, right: CpuSimulationState) {
  const leftReach = measureContinuousDirectionalReach(left.phase, left.config);
  const rightReach = measureContinuousDirectionalReach(
    right.phase,
    right.config,
  );
  return {
    phase: measureFieldDifference(
      left.phase,
      right.phase,
      left.phase,
      right.phase,
    ),
    chemicalPotential: measureFieldDifference(
      left.chemicalPotential,
      right.chemicalPotential,
      left.phase,
      right.phase,
    ),
    continuousReachDelta: subtractReach(leftReach, rightReach),
  };
}

function coupledMethodResult(
  result: ReturnType<typeof runCoupled>,
  steps: number,
): CpuExperimentCoupledMethodResult {
  const iterations = result.diagnostics.map(
    (diagnostic) => diagnostic.iterations,
  );
  const finalResiduals = result.diagnostics.map(
    (diagnostic) => diagnostic.residual.maximumNormalized,
  );
  const finalUpdates = result.diagnostics.map(
    (diagnostic) => diagnostic.update.maximumNormalized,
  );
  const firstDiagnostic = result.diagnostics[0];
  if (firstDiagnostic === undefined) {
    throw new Error('Coupled experiment requires at least one step.');
  }
  return {
    steps,
    simulatedTime: result.state.time,
    wallMilliseconds: result.wallMilliseconds,
    state: summarizeState(result.state),
    trajectory: result.trajectory,
    iterationMinimum: Math.min(...iterations),
    iterationMaximum: Math.max(...iterations),
    iterationMean: mean(iterations),
    maximumFinalNormalizedResidual: Math.max(...finalResiduals),
    maximumFinalNormalizedUpdate: Math.max(...finalUpdates),
    oneStepPredictorResidual: firstDiagnostic.predictorResidual,
    oneStepFinalResidual: firstDiagnostic.residual,
  };
}

function runDomain(
  gridSize: number,
  deadline: number,
): CpuExperimentDomainResult {
  const fullConfig = createExperimentConfiguration(gridSize, FULL_TIME_STEP);
  const halfConfig = createExperimentConfiguration(gridSize, HALF_TIME_STEP);
  const initial = createInitialCpuState(fullConfig);
  const refinedInitial = createInitialCpuState(halfConfig);
  const fullSteps = Math.round(END_TIME / FULL_TIME_STEP);
  const halfSteps = Math.round(END_TIME / HALF_TIME_STEP);
  const split = runSplit(initial, fullSteps, deadline);
  const coupled = runCoupled(initial, fullSteps, deadline);
  const refinedSplit = runSplit(refinedInitial, halfSteps, deadline);
  const refinedCoupled = runCoupled(refinedInitial, halfSteps, deadline);

  return {
    grid: [gridSize, gridSize, gridSize],
    spacing: fullConfig.grid.spacing,
    domainMaximum: fullConfig.domainMaximum[0],
    initial: summarizeState(initial),
    split: {
      steps: fullSteps,
      simulatedTime: split.state.time,
      wallMilliseconds: split.wallMilliseconds,
      state: summarizeState(split.state),
      trajectory: split.trajectory,
    },
    coupled: coupledMethodResult(coupled, fullSteps),
    refinedSplit: {
      steps: halfSteps,
      simulatedTime: refinedSplit.state.time,
      wallMilliseconds: refinedSplit.wallMilliseconds,
      state: summarizeState(refinedSplit.state),
      trajectory: refinedSplit.trajectory,
    },
    refinedCoupled: coupledMethodResult(refinedCoupled, halfSteps),
    splitVersusCoupled: compareStates(split.state, coupled.state),
    splitVersusRefined: compareStates(split.state, refinedSplit.state),
    refinedSplitVersusRefinedCoupled: compareStates(
      refinedSplit.state,
      refinedCoupled.state,
    ),
    coupledVersusRefinedCoupled: compareStates(
      coupled.state,
      refinedCoupled.state,
    ),
  };
}

function hasConsistentNonzeroSign(values: readonly number[]): boolean {
  return (
    values.every((value) => value > 0) || values.every((value) => value < 0)
  );
}

export function runCpuCouplingExperiment(
  options: CpuCouplingExperimentOptions = {},
): CpuCouplingExperimentResult {
  const started = performance.now();
  const deadline = options.deadline ?? started + WALL_BUDGET_MILLISECONDS;
  const domains = GRID_SIZES.map((gridSize) => runDomain(gridSize, deadline));
  const wallMilliseconds = performance.now() - started;
  const splitMinusCoupledDirectionalRatioDelta = domains.map(
    (domain) =>
      domain.splitVersusCoupled.continuousReachDelta.bodyDiagonalToFaceRatio,
  );
  const refinedSplitMinusRefinedCoupledDirectionalRatioDelta = domains.map(
    (domain) =>
      domain.refinedSplitVersusRefinedCoupled.continuousReachDelta
        .bodyDiagonalToFaceRatio,
  );
  const mainCoupling = Math.abs(splitMinusCoupledDirectionalRatioDelta[1] ?? 0);
  const refinedCoupling = Math.abs(
    refinedSplitMinusRefinedCoupledDirectionalRatioDelta[1] ?? 0,
  );
  const fullStepDomainVariation = Math.abs(
    (splitMinusCoupledDirectionalRatioDelta[1] ?? 0) -
      (splitMinusCoupledDirectionalRatioDelta[0] ?? 0),
  );
  const refinedStepDomainVariation = Math.abs(
    (refinedSplitMinusRefinedCoupledDirectionalRatioDelta[1] ?? 0) -
      (refinedSplitMinusRefinedCoupledDirectionalRatioDelta[0] ?? 0),
  );
  const allCouplingDeltas = [
    ...splitMinusCoupledDirectionalRatioDelta,
    ...refinedSplitMinusRefinedCoupledDirectionalRatioDelta,
  ];
  const couplingDirectionConsistentAcrossDomainsAndTimeSteps =
    hasConsistentNonzeroSign(allCouplingDeltas);
  const couplingSignalExceedsDomainVariation =
    mainCoupling > fullStepDomainVariation &&
    refinedCoupling > refinedStepDomainVariation;
  const couplingTimeStepScaling = mainCoupling / refinedCoupling;
  const couplingShowsFirstOrderTimeStepScaling =
    couplingTimeStepScaling >= 1.5 && couplingTimeStepScaling <= 2.5;
  const sourceDirectedDirectionalSignal = allCouplingDeltas.every(
    (value) => value < 0,
  );
  const awayFromSourceDirectionalSignal = allCouplingDeltas.every(
    (value) => value > 0,
  );
  // splitVersusCoupled is split - coupled, so a negative value means the
  // coupled reference has the larger body-diagonal/face ratio.
  const matureRunRecommended =
    couplingDirectionConsistentAcrossDomainsAndTimeSteps &&
    couplingSignalExceedsDomainVariation &&
    couplingShowsFirstOrderTimeStepScaling &&
    sourceDirectedDirectionalSignal;
  const fieldsFinite = domains.every((domain) =>
    [
      domain.split,
      domain.coupled,
      domain.refinedSplit,
      domain.refinedCoupled,
    ].every(
      (method) =>
        method.trajectory.phaseNonFiniteCount === 0 &&
        method.trajectory.chemicalPotentialNonFiniteCount === 0,
    ),
  );
  const phaseRangeBounded = domains.every((domain) =>
    [
      domain.split,
      domain.coupled,
      domain.refinedSplit,
      domain.refinedCoupled,
    ].every(
      (method) =>
        method.trajectory.phaseMinimum >= -0.02 &&
        method.trajectory.phaseMaximum <= 1.02,
    ),
  );
  const allCoupledStepsConverged = domains.every(
    (domain) =>
      domain.coupled.maximumFinalNormalizedResidual <= 1 &&
      domain.coupled.maximumFinalNormalizedUpdate <= 1 &&
      domain.refinedCoupled.maximumFinalNormalizedResidual <= 1 &&
      domain.refinedCoupled.maximumFinalNormalizedUpdate <= 1,
  );
  const oneStepChemicalResidualReductionAtLeast100 = domains.every(
    (domain) =>
      domain.coupled.oneStepPredictorResidual.chemicalPotential
        .maximumAbsolute /
        domain.coupled.oneStepFinalResidual.chemicalPotential.maximumAbsolute >=
        100 &&
      domain.refinedCoupled.oneStepPredictorResidual.chemicalPotential
        .maximumAbsolute /
        domain.refinedCoupled.oneStepFinalResidual.chemicalPotential
          .maximumAbsolute >=
        100,
  );
  const budgetPassed = wallMilliseconds <= WALL_BUDGET_MILLISECONDS;
  const passed =
    allCoupledStepsConverged &&
    fieldsFinite &&
    phaseRangeBounded &&
    oneStepChemicalResidualReductionAtLeast100 &&
    budgetPassed;

  return {
    configuration: {
      phaseOperator: 'author-centered',
      domainMode: 'octant',
      precision: 'float32',
      grids: GRID_SIZES,
      spacing: 2,
      fullTimeStep: FULL_TIME_STEP,
      halfTimeStep: HALF_TIME_STEP,
      endTime: END_TIME,
      liquidDiffusivity: 4,
      farFieldChemicalPotential: 0.04,
      criticalRadius: 10,
      initialRadius: 20,
      interfaceWidth: 2,
      residualTolerance: RESIDUAL_TOLERANCE,
      maximumIterations: MAXIMUM_ITERATIONS,
      relaxation: 1,
    },
    domains,
    interpretation: {
      splitMinusCoupledDirectionalRatioDelta,
      refinedSplitMinusRefinedCoupledDirectionalRatioDelta,
      couplingTimeStepScaling,
      couplingDirectionConsistentAcrossDomainsAndTimeSteps,
      couplingSignalExceedsDomainVariation,
      couplingShowsFirstOrderTimeStepScaling,
      sourceDirectedDirectionalSignal,
      awayFromSourceDirectionalSignal,
      matureRunRecommended,
      reason: matureRunRecommended
        ? 'The coupled directional signal is source-directed, domain-consistent, and converges at the expected first-order rate when the time step is halved.'
        : awayFromSourceDirectionalSignal
          ? 'At both time steps and on both domains, the coupled result has a lower body-diagonal/face reach ratio than the split result, moving away from the source dendrite.'
          : 'The coupled directional signal does not pass its domain-consistency and time-step-scaling controls.',
    },
    runtime: {
      matrixWallMilliseconds: wallMilliseconds,
      budgetMilliseconds: WALL_BUDGET_MILLISECONDS,
      passed: budgetPassed,
    },
    checks: {
      allCoupledStepsConverged,
      fieldsFinite,
      phaseRangeBounded,
      oneStepChemicalResidualReductionAtLeast100,
      passed,
    },
    limitations: [
      'Backward Euler isolates future-state coupling but does not reproduce the authors variable-step BDF2 order.',
      'Both grids use the same dx=2 spacing; this is a domain-size control, not spatial convergence.',
      'The t=0.2 horizon measures subcell interface direction and cannot establish mature dendrite morphology.',
      'The experiment retains Float32 storage to isolate integration from precision.',
    ],
  };
}
