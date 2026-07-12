import {
  deriveSimulationConfiguration,
  farFieldChemicalPotentialAt,
  type DerivedSimulationConfiguration,
  type GridShape,
  type SimulationConfiguration,
  type Vec3,
} from './config';
import {
  anisotropyFlux,
  chemicalSourceIncrement,
  phaseDiffusivity,
  phaseLocalRate,
} from './model';
import { correlatedPerturbation, createPerturbationSignature } from './random';

export const UNBORN_SOLIDIFICATION_TIME = -1;

const SEED_RADIUS_SIGNATURE_XOR = 0x9e37_79b9;
const CHEMICAL_SIGNATURE_XOR = 0x85eb_ca6b;

export interface CpuSimulationState {
  readonly config: DerivedSimulationConfiguration;
  readonly phase: Float32Array;
  readonly chemicalPotential: Float32Array;
  readonly solidificationTime: Float32Array;
  readonly time: number;
  readonly step: number;
}

export interface CpuPhaseStep {
  readonly phase: Float32Array;
  readonly phaseRate: Float32Array;
}

export interface CpuResidualNorm {
  readonly maximumAbsolute: number;
  readonly rootMeanSquare: number;
  readonly normalizedMaximum: number;
}

export interface CpuCoupledResidual {
  readonly phase: CpuResidualNorm;
  readonly chemicalPotential: CpuResidualNorm;
  readonly phaseBoundaryMaximum: number;
  readonly chemicalPotentialBoundaryMaximum: number;
  readonly maximumNormalized: number;
}

export interface CpuCoupledStepOptions {
  readonly maximumIterations?: number;
  readonly residualTolerance?: number;
  readonly relaxation?: number;
}

export interface CpuCoupledStepDiagnostics {
  readonly converged: boolean;
  readonly iterations: number;
  readonly relaxation: number;
  readonly residualTolerance: number;
  readonly predictorResidual: CpuCoupledResidual;
  readonly residual: CpuCoupledResidual;
  readonly update: CpuCoupledResidual;
  readonly maximumNormalizedResidualHistory: readonly number[];
}

export interface CpuCoupledStepResult {
  readonly phase: Float32Array;
  readonly chemicalPotential: Float32Array;
  /** Present only after the nonlinear residual converges. */
  readonly state: CpuSimulationState | null;
  readonly diagnostics: CpuCoupledStepDiagnostics;
}

export function gridIndex(
  x: number,
  y: number,
  z: number,
  shape: GridShape,
): number {
  return (z * shape[1] + y) * shape[0] + x;
}

export function gridCoordinates(
  index: number,
  shape: GridShape,
): readonly [number, number, number] {
  const plane = shape[0] * shape[1];
  const z = Math.floor(index / plane);
  const remainder = index - z * plane;
  const y = Math.floor(remainder / shape[0]);
  return [remainder - y * shape[0], y, z];
}

function isDerivedConfiguration(
  config: SimulationConfiguration | DerivedSimulationConfiguration,
): config is DerivedSimulationConfiguration {
  return 'voxelCount' in config;
}

function physicalPosition(
  x: number,
  y: number,
  z: number,
  config: DerivedSimulationConfiguration,
): Vec3 {
  const spacing = config.grid.spacing;
  return [
    x * spacing - config.domainCenter[0],
    y * spacing - config.domainCenter[1],
    z * spacing - config.domainCenter[2],
  ];
}

function isBoundary(
  x: number,
  y: number,
  z: number,
  shape: GridShape,
): boolean {
  return (
    x === 0 ||
    y === 0 ||
    z === 0 ||
    x === shape[0] - 1 ||
    y === shape[1] - 1 ||
    z === shape[2] - 1
  );
}

function isFarBoundary(
  x: number,
  y: number,
  z: number,
  config: DerivedSimulationConfiguration,
): boolean {
  const { shape } = config.grid;
  if (config.domainMode === 'full') {
    return isBoundary(x, y, z, shape);
  }
  return x === shape[0] - 1 || y === shape[1] - 1 || z === shape[2] - 1;
}

function isSymmetryBoundary(
  x: number,
  y: number,
  z: number,
  config: DerivedSimulationConfiguration,
): boolean {
  return (
    config.domainMode === 'octant' &&
    !isFarBoundary(x, y, z, config) &&
    (x === 0 || y === 0 || z === 0)
  );
}

function nearestInteriorCoordinate(coordinate: number, size: number): number {
  return Math.min(size - 2, Math.max(1, coordinate));
}

function nearestInteriorIndex(
  x: number,
  y: number,
  z: number,
  shape: GridShape,
): number {
  return gridIndex(
    nearestInteriorCoordinate(x, shape[0]),
    nearestInteriorCoordinate(y, shape[1]),
    nearestInteriorCoordinate(z, shape[2]),
    shape,
  );
}

function samplePhaseNeumann(
  phase: Float32Array,
  x: number,
  y: number,
  z: number,
  shape: GridShape,
): number {
  return phase[nearestInteriorIndex(x, y, z, shape)] ?? Number.NaN;
}

function validateState(state: CpuSimulationState): void {
  const expected = state.config.voxelCount;
  if (
    state.phase.length !== expected ||
    state.chemicalPotential.length !== expected ||
    state.solidificationTime.length !== expected
  ) {
    throw new RangeError('CPU field lengths do not match the configured grid.');
  }
  if (!Number.isFinite(state.time) || state.time < 0) {
    throw new RangeError(
      'CPU simulation time must be finite and non-negative.',
    );
  }
  if (!Number.isInteger(state.step) || state.step < 0) {
    throw new RangeError('CPU simulation step must be a non-negative integer.');
  }
}

function validateEvaluationFields(
  state: CpuSimulationState,
  phase: Float32Array,
  chemicalPotential: Float32Array,
): void {
  if (
    phase.length !== state.config.voxelCount ||
    chemicalPotential.length !== state.config.voxelCount
  ) {
    throw new RangeError(
      'CPU evaluation fields do not match the configured grid.',
    );
  }
}

export function createInitialCpuState(
  configuration: SimulationConfiguration | DerivedSimulationConfiguration,
): CpuSimulationState {
  const config = isDerivedConfiguration(configuration)
    ? configuration
    : deriveSimulationConfiguration(configuration);
  const phase = new Float32Array(config.voxelCount);
  const chemicalPotential = new Float32Array(config.voxelCount);
  const solidificationTime = new Float32Array(config.voxelCount);
  solidificationTime.fill(UNBORN_SOLIDIFICATION_TIME);

  const radiusSignature = createPerturbationSignature(
    (config.perturbations.seed ^ SEED_RADIUS_SIGNATURE_XOR) >>> 0,
  );
  const chemicalSignature = createPerturbationSignature(
    (config.perturbations.seed ^ CHEMICAL_SIGNATURE_XOR) >>> 0,
  );
  const { shape, solidificationThreshold } = config.grid;
  const { parameters, perturbations } = config;

  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        const index = gridIndex(x, y, z, shape);
        const position = physicalPosition(x, y, z, config);
        const phasePosition = isBoundary(x, y, z, shape)
          ? physicalPosition(
              nearestInteriorCoordinate(x, shape[0]),
              nearestInteriorCoordinate(y, shape[1]),
              nearestInteriorCoordinate(z, shape[2]),
              config,
            )
          : position;
        const radiusNoise = correlatedPerturbation(
          phasePosition,
          perturbations.seedRadiusCorrelationLength,
          radiusSignature,
        );
        const localRadius =
          parameters.initialRadius +
          perturbations.seedRadiusAmplitude * radiusNoise;
        const radius = Math.hypot(...phasePosition);
        const phi = Math.fround(
          1 /
            (1 + Math.exp(-(radius - localRadius) / parameters.interfaceWidth)),
        );
        const chemicalPosition = isSymmetryBoundary(x, y, z, config)
          ? physicalPosition(
              nearestInteriorCoordinate(x, shape[0]),
              nearestInteriorCoordinate(y, shape[1]),
              nearestInteriorCoordinate(z, shape[2]),
              config,
            )
          : position;
        const farField = farFieldChemicalPotentialAt(config, chemicalPosition);
        const chemicalNoise = correlatedPerturbation(
          phasePosition,
          perturbations.chemicalPotentialCorrelationLength,
          chemicalSignature,
        );
        const mu = Math.fround(
          parameters.equilibriumChemicalPotential -
            phi * (parameters.equilibriumChemicalPotential - farField) +
            phi * perturbations.chemicalPotentialAmplitude * chemicalNoise,
        );

        phase[index] = phi;
        chemicalPotential[index] = Math.fround(farField);
        if (!isFarBoundary(x, y, z, config)) {
          chemicalPotential[index] = mu;
        }
        if (!isFarBoundary(x, y, z, config) && phi <= solidificationThreshold) {
          solidificationTime[index] = 0;
        }
      }
    }
  }

  // Enforce the phase Neumann condition at t=0 as well as during updates.
  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        if (!isBoundary(x, y, z, shape)) continue;
        phase[gridIndex(x, y, z, shape)] =
          phase[nearestInteriorIndex(x, y, z, shape)] ?? Number.NaN;
      }
    }
  }

  return {
    config,
    phase,
    chemicalPotential,
    solidificationTime,
    time: 0,
    step: 0,
  };
}

type GridAxis = 0 | 1 | 2;
type GridCoordinate = [number, number, number];

const GRID_AXES = [0, 1, 2] as const;

function vectorDot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function offsetCoordinate(
  coordinate: GridCoordinate,
  axis: GridAxis,
  offset: number,
): GridCoordinate {
  const result = [...coordinate] as GridCoordinate;
  result[axis] += offset;
  return result;
}

function samplePhaseAt(
  phase: Float32Array,
  coordinate: GridCoordinate,
  shape: GridShape,
): number {
  return samplePhaseNeumann(phase, ...coordinate, shape);
}

/**
 * Gradient at a cell face. The normal component is the one-sided difference
 * across the face. Each transverse component averages centered differences
 * in the two cells adjacent to that face.
 */
function faceGradient(
  phase: Float32Array,
  center: GridCoordinate,
  normalAxis: GridAxis,
  direction: -1 | 1,
  shape: GridShape,
  spacing: number,
): Vec3 {
  const lower =
    direction === 1 ? center : offsetCoordinate(center, normalAxis, -1);
  const upper =
    direction === 1 ? offsetCoordinate(center, normalAxis, 1) : center;
  const gradient = [0, 0, 0] as [number, number, number];
  gradient[normalAxis] =
    (samplePhaseAt(phase, upper, shape) - samplePhaseAt(phase, lower, shape)) /
    spacing;

  for (const transverseAxis of GRID_AXES) {
    if (transverseAxis === normalAxis) continue;
    const lowerPlus = offsetCoordinate(lower, transverseAxis, 1);
    const lowerMinus = offsetCoordinate(lower, transverseAxis, -1);
    const upperPlus = offsetCoordinate(upper, transverseAxis, 1);
    const upperMinus = offsetCoordinate(upper, transverseAxis, -1);
    gradient[transverseAxis] =
      (samplePhaseAt(phase, lowerPlus, shape) -
        samplePhaseAt(phase, lowerMinus, shape) +
        samplePhaseAt(phase, upperPlus, shape) -
        samplePhaseAt(phase, upperMinus, shape)) /
      (4 * spacing);
  }

  return gradient;
}

function faceFluxComponent(
  phase: Float32Array,
  center: GridCoordinate,
  axis: GridAxis,
  direction: -1 | 1,
  config: DerivedSimulationConfiguration,
): number {
  const flux = anisotropyFlux(
    faceGradient(
      phase,
      center,
      axis,
      direction,
      config.grid.shape,
      config.grid.spacing,
    ),
    config.crystalAxes,
    config.parameters.anisotropyRegularization,
  );
  return Math.fround(flux[axis]);
}

function conservativeAnisotropyDivergence(
  phase: Float32Array,
  center: GridCoordinate,
  config: DerivedSimulationConfiguration,
): number {
  let fluxDifference = 0;
  for (const axis of GRID_AXES) {
    const plus = faceFluxComponent(phase, center, axis, 1, config);
    const minus = faceFluxComponent(phase, center, axis, -1, config);
    fluxDifference += plus - minus;
  }
  return Math.fround(
    (config.surfaceEnergyNormalization * fluxDifference) / config.grid.spacing,
  );
}

/**
 * Discrete cubic operator used by the authors' active 3D Fortran branch.
 * It contracts a centered phase Hessian with the regularized energy Hessian
 * instead of differencing shared face fluxes.
 */
export function authorCenteredAnisotropyDivergence(
  phase: Float32Array,
  center: GridCoordinate,
  config: DerivedSimulationConfiguration,
): number {
  const { shape, spacing } = config.grid;
  const inverseTwoSpacing = 1 / (2 * spacing);
  const inverseSpacingSquared = 1 / (spacing * spacing);
  const sample = (offset: GridCoordinate) =>
    samplePhaseAt(
      phase,
      [center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]],
      shape,
    );
  const centerValue = sample([0, 0, 0]);
  const gradient: Vec3 = [
    (sample([1, 0, 0]) - sample([-1, 0, 0])) * inverseTwoSpacing,
    (sample([0, 1, 0]) - sample([0, -1, 0])) * inverseTwoSpacing,
    (sample([0, 0, 1]) - sample([0, 0, -1])) * inverseTwoSpacing,
  ];
  const hessian = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  hessian[0]![0] =
    (sample([1, 0, 0]) - 2 * centerValue + sample([-1, 0, 0])) *
    inverseSpacingSquared;
  hessian[1]![1] =
    (sample([0, 1, 0]) - 2 * centerValue + sample([0, -1, 0])) *
    inverseSpacingSquared;
  hessian[2]![2] =
    (sample([0, 0, 1]) - 2 * centerValue + sample([0, 0, -1])) *
    inverseSpacingSquared;
  const mixed = (first: GridAxis, second: GridAxis) => {
    const plusPlus = [0, 0, 0] as GridCoordinate;
    const plusMinus = [0, 0, 0] as GridCoordinate;
    const minusPlus = [0, 0, 0] as GridCoordinate;
    const minusMinus = [0, 0, 0] as GridCoordinate;
    plusPlus[first] = 1;
    plusPlus[second] = 1;
    plusMinus[first] = 1;
    plusMinus[second] = -1;
    minusPlus[first] = -1;
    minusPlus[second] = 1;
    minusMinus[first] = -1;
    minusMinus[second] = -1;
    return (
      (sample(plusPlus) -
        sample(plusMinus) -
        sample(minusPlus) +
        sample(minusMinus)) /
      (4 * spacing * spacing)
    );
  };
  hessian[0]![1] = hessian[1]![0] = mixed(0, 1);
  hessian[0]![2] = hessian[2]![0] = mixed(0, 2);
  hessian[1]![2] = hessian[2]![1] = mixed(1, 2);

  const gradientMagnitude = Math.hypot(...gradient);
  if (gradientMagnitude <= 1e-6) {
    return Math.fround(
      (hessian[0]![0] ?? 0) + (hessian[1]![1] ?? 0) + (hessian[2]![2] ?? 0),
    );
  }

  const crystalGradient = config.crystalAxes.map((axis) =>
    vectorDot(gradient, axis),
  );
  const crystalHessian = config.crystalAxes.map((left) =>
    config.crystalAxes.map((right) => {
      let value = 0;
      for (const i of GRID_AXES) {
        for (const j of GRID_AXES) {
          value += left[i] * (hessian[i]![j] ?? 0) * right[j];
        }
      }
      return value;
    }),
  );
  const epsilon = config.parameters.anisotropyRegularization;
  const epsilonSquared = epsilon * epsilon;
  const direction = crystalGradient.map(
    (component) => component / gradientMagnitude,
  );
  const roots = direction.map((component) =>
    Math.sqrt(component * component + epsilonSquared),
  );
  const a0 = roots.reduce((sum, root) => sum + root, 0) / (1 + epsilon);
  const first = Array.from({ length: 3 }, () => [0, 0, 0]);
  const second = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => [0, 0, 0]),
  );

  for (const term of GRID_AXES) {
    for (const i of GRID_AXES) {
      first[term]![i] =
        (((term === i ? 1 : 0) + epsilonSquared) * (direction[i] ?? 0)) /
        (roots[term] ?? 1);
      for (const j of GRID_AXES) {
        second[term]![i]![j] =
          (((term === i ? 1 : 0) + epsilonSquared) * (i === j ? 1 : 0) -
            (first[term]![i] ?? 0) * (first[term]![j] ?? 0)) /
          (roots[term] ?? 1);
      }
    }
  }

  let contraction = 0;
  const normalization = (1 + epsilon) ** 2;
  for (const i of GRID_AXES) {
    for (const j of GRID_AXES) {
      let firstSumI = 0;
      let firstSumJ = 0;
      let secondSum = 0;
      for (const term of GRID_AXES) {
        firstSumI += first[term]![i] ?? 0;
        firstSumJ += first[term]![j] ?? 0;
        secondSum += second[term]![i]![j] ?? 0;
      }
      const energyHessian =
        (a0 * secondSum + firstSumI * firstSumJ) / normalization;
      contraction += (crystalHessian[i]![j] ?? 0) * energyHessian;
    }
  }
  return Math.fround(contraction / 3);
}

/**
 * Evaluates the backward-Euler phase fixed-point map while anchoring the
 * update at state.phase. Passing the old fields reproduces the explicit step.
 */
export function evaluateCpuPhaseUpdateMap(
  state: CpuSimulationState,
  evaluationPhase: Float32Array,
  evaluationChemicalPotential: Float32Array,
): CpuPhaseStep {
  validateState(state);
  validateEvaluationFields(state, evaluationPhase, evaluationChemicalPotential);
  const { config } = state;
  const { shape, timeStep } = config.grid;
  const nextPhase = new Float32Array(config.voxelCount);
  const phaseRate = new Float32Array(config.voxelCount);

  for (let z = 1; z < shape[2] - 1; z += 1) {
    for (let y = 1; y < shape[1] - 1; y += 1) {
      for (let x = 1; x < shape[0] - 1; x += 1) {
        const index = gridIndex(x, y, z, shape);
        const divergence =
          config.phaseOperator === 'author-centered'
            ? authorCenteredAnisotropyDivergence(
                evaluationPhase,
                [x, y, z],
                config,
              )
            : conservativeAnisotropyDivergence(
                evaluationPhase,
                [x, y, z],
                config,
              );
        const oldPhi = state.phase[index] ?? Number.NaN;
        const rate = phaseLocalRate(
          evaluationPhase[index] ?? Number.NaN,
          evaluationChemicalPotential[index] ?? Number.NaN,
          divergence,
          config,
        );
        const updated = Math.fround(oldPhi + timeStep * rate);
        nextPhase[index] = updated;
        phaseRate[index] = Math.fround((updated - oldPhi) / timeStep);
      }
    }
  }

  // Zero-normal-gradient phase boundary: copy the nearest updated interior.
  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        if (!isBoundary(x, y, z, shape)) continue;
        const index = gridIndex(x, y, z, shape);
        const copied =
          nextPhase[nearestInteriorIndex(x, y, z, shape)] ?? Number.NaN;
        const oldPhi = state.phase[index] ?? Number.NaN;
        nextPhase[index] = copied;
        phaseRate[index] = Math.fround((copied - oldPhi) / timeStep);
      }
    }
  }

  return { phase: nextPhase, phaseRate };
}

export function computeCpuPhaseStep(state: CpuSimulationState): CpuPhaseStep {
  return evaluateCpuPhaseUpdateMap(state, state.phase, state.chemicalPotential);
}

function axisDiffusionFlux(
  centerMu: number,
  neighborMu: number,
  centerDiffusivity: number,
  neighborDiffusivity: number,
): number {
  const faceDiffusivity = 0.5 * (centerDiffusivity + neighborDiffusivity);
  return faceDiffusivity * (neighborMu - centerMu);
}

/**
 * Evaluates the conserved backward-Euler chemical fixed-point map while
 * anchoring the update at state.chemicalPotential. The exact Delta-g source
 * keeps mu + a DeltaC g(phi) unchanged by local phase conversion.
 */
export function evaluateCpuChemicalPotentialUpdateMap(
  state: CpuSimulationState,
  evaluationPhase: Float32Array,
  evaluationChemicalPotential: Float32Array,
): Float32Array {
  validateState(state);
  const { config } = state;
  validateEvaluationFields(state, evaluationPhase, evaluationChemicalPotential);

  const { shape, spacing, timeStep } = config.grid;
  const nextMu = new Float32Array(config.voxelCount);
  const inverseSpacingSquared = 1 / (spacing * spacing);

  for (let z = 1; z < shape[2] - 1; z += 1) {
    for (let y = 1; y < shape[1] - 1; y += 1) {
      for (let x = 1; x < shape[0] - 1; x += 1) {
        const index = gridIndex(x, y, z, shape);
        const centerPhi = evaluationPhase[index] ?? Number.NaN;
        const oldMu = state.chemicalPotential[index] ?? Number.NaN;
        const centerMu = evaluationChemicalPotential[index] ?? Number.NaN;
        const centerDiffusivity = phaseDiffusivity(centerPhi, config);
        let fluxSum = 0;

        const neighbors = [
          gridIndex(x - 1, y, z, shape),
          gridIndex(x + 1, y, z, shape),
          gridIndex(x, y - 1, z, shape),
          gridIndex(x, y + 1, z, shape),
          gridIndex(x, y, z - 1, shape),
          gridIndex(x, y, z + 1, shape),
        ];
        for (const neighbor of neighbors) {
          fluxSum += axisDiffusionFlux(
            centerMu,
            evaluationChemicalPotential[neighbor] ?? Number.NaN,
            centerDiffusivity,
            phaseDiffusivity(evaluationPhase[neighbor] ?? Number.NaN, config),
          );
        }

        const diffusionRate =
          config.parameters.freeEnergyCurvature *
          fluxSum *
          inverseSpacingSquared;
        const sourceIncrement = chemicalSourceIncrement(
          state.phase[index] ?? Number.NaN,
          centerPhi,
          config,
        );
        nextMu[index] = Math.fround(
          oldMu + timeStep * diffusionRate + sourceIncrement,
        );
      }
    }
  }

  // Full-domain faces and octant high faces are fixed reservoirs. Octant
  // origin planes copy the nearest interior update to impose symmetry.
  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        if (!isBoundary(x, y, z, shape)) continue;
        const index = gridIndex(x, y, z, shape);
        nextMu[index] = isFarBoundary(x, y, z, config)
          ? Math.fround(
              farFieldChemicalPotentialAt(
                config,
                physicalPosition(x, y, z, config),
              ),
            )
          : (nextMu[nearestInteriorIndex(x, y, z, shape)] ?? Number.NaN);
      }
    }
  }

  return nextMu;
}

export function computeCpuChemicalPotentialStep(
  state: CpuSimulationState,
  phaseStep: CpuPhaseStep,
): Float32Array {
  if (
    phaseStep.phase.length !== state.config.voxelCount ||
    phaseStep.phaseRate.length !== state.config.voxelCount
  ) {
    throw new RangeError('Phase-step fields do not match the configured grid.');
  }
  return evaluateCpuChemicalPotentialUpdateMap(
    state,
    phaseStep.phase,
    state.chemicalPotential,
  );
}

export function captureSolidificationTimes(
  previousPhase: Float32Array,
  nextPhase: Float32Array,
  previousTimes: Float32Array,
  crossingTime: number,
  threshold: number,
): Float32Array {
  if (
    previousPhase.length !== nextPhase.length ||
    previousPhase.length !== previousTimes.length
  ) {
    throw new RangeError('Solidification-time fields must have equal lengths.');
  }
  if (!Number.isFinite(crossingTime) || crossingTime < 0) {
    throw new RangeError('crossingTime must be finite and non-negative.');
  }

  const nextTimes = new Float32Array(previousTimes);
  for (let index = 0; index < nextTimes.length; index += 1) {
    if ((nextTimes[index] ?? UNBORN_SOLIDIFICATION_TIME) >= 0) continue;
    if (
      (previousPhase[index] ?? Number.NaN) > threshold &&
      (nextPhase[index] ?? Number.NaN) <= threshold
    ) {
      nextTimes[index] = Math.fround(crossingTime);
    }
  }
  return nextTimes;
}

function advanceCpuState(
  state: CpuSimulationState,
  phase: Float32Array,
  chemicalPotential: Float32Array,
): CpuSimulationState {
  const nextTime = state.time + state.config.grid.timeStep;
  const solidificationTime = captureSolidificationTimes(
    state.phase,
    phase,
    state.solidificationTime,
    nextTime,
    state.config.grid.solidificationThreshold,
  );
  const { shape } = state.config.grid;

  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        if (isFarBoundary(x, y, z, state.config)) {
          solidificationTime[gridIndex(x, y, z, shape)] =
            UNBORN_SOLIDIFICATION_TIME;
        }
      }
    }
  }

  return {
    config: state.config,
    phase,
    chemicalPotential,
    solidificationTime,
    time: nextTime,
    step: state.step + 1,
  };
}

function residualNorm(
  maximumAbsolute: number,
  sumSquares: number,
  count: number,
  scale: number,
  tolerance: number,
): CpuResidualNorm {
  return {
    maximumAbsolute,
    rootMeanSquare: Math.sqrt(sumSquares / Math.max(1, count)),
    normalizedMaximum: maximumAbsolute / (tolerance * Math.max(1, scale)),
  };
}

function measureCoupledResidual(
  state: CpuSimulationState,
  phase: Float32Array,
  chemicalPotential: Float32Array,
  phaseMap: Float32Array,
  chemicalPotentialMap: Float32Array,
  tolerance: number,
): CpuCoupledResidual {
  const { shape } = state.config.grid;
  let phaseMaximum = 0;
  let chemicalMaximum = 0;
  let phaseSquares = 0;
  let chemicalSquares = 0;
  let phaseScale = 1;
  let chemicalScale = 1;
  let phaseBoundaryMaximum = 0;
  let chemicalBoundaryMaximum = 0;

  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        const index = gridIndex(x, y, z, shape);
        const phaseValue = phase[index] ?? Number.NaN;
        const chemicalValue = chemicalPotential[index] ?? Number.NaN;
        phaseScale = Math.max(phaseScale, Math.abs(phaseValue));
        chemicalScale = Math.max(chemicalScale, Math.abs(chemicalValue));

        let phaseResidual: number;
        let chemicalResidual: number;
        if (isBoundary(x, y, z, shape)) {
          const interior = nearestInteriorIndex(x, y, z, shape);
          phaseResidual = (phase[interior] ?? Number.NaN) - phaseValue;
          const chemicalTarget = isFarBoundary(x, y, z, state.config)
            ? farFieldChemicalPotentialAt(
                state.config,
                physicalPosition(x, y, z, state.config),
              )
            : (chemicalPotential[interior] ?? Number.NaN);
          chemicalResidual = chemicalTarget - chemicalValue;
          phaseBoundaryMaximum = Math.max(
            phaseBoundaryMaximum,
            Math.abs(phaseResidual),
          );
          chemicalBoundaryMaximum = Math.max(
            chemicalBoundaryMaximum,
            Math.abs(chemicalResidual),
          );
        } else {
          phaseResidual = (phaseMap[index] ?? Number.NaN) - phaseValue;
          chemicalResidual =
            (chemicalPotentialMap[index] ?? Number.NaN) - chemicalValue;
        }

        const absolutePhaseResidual = Math.abs(phaseResidual);
        const absoluteChemicalResidual = Math.abs(chemicalResidual);
        phaseMaximum = Math.max(phaseMaximum, absolutePhaseResidual);
        chemicalMaximum = Math.max(chemicalMaximum, absoluteChemicalResidual);
        phaseSquares += phaseResidual * phaseResidual;
        chemicalSquares += chemicalResidual * chemicalResidual;
      }
    }
  }

  const phaseNorm = residualNorm(
    phaseMaximum,
    phaseSquares,
    state.config.voxelCount,
    phaseScale,
    tolerance,
  );
  const chemicalNorm = residualNorm(
    chemicalMaximum,
    chemicalSquares,
    state.config.voxelCount,
    chemicalScale,
    tolerance,
  );
  return {
    phase: phaseNorm,
    chemicalPotential: chemicalNorm,
    phaseBoundaryMaximum,
    chemicalPotentialBoundaryMaximum: chemicalBoundaryMaximum,
    maximumNormalized: Math.max(
      phaseNorm.normalizedMaximum,
      chemicalNorm.normalizedMaximum,
    ),
  };
}

function measureCoupledUpdate(
  previousPhase: Float32Array,
  nextPhase: Float32Array,
  previousChemicalPotential: Float32Array,
  nextChemicalPotential: Float32Array,
  shape: GridShape,
  tolerance: number,
): CpuCoupledResidual {
  let phaseMaximum = 0;
  let chemicalMaximum = 0;
  let phaseSquares = 0;
  let chemicalSquares = 0;
  let phaseScale = 1;
  let chemicalScale = 1;
  let phaseBoundaryMaximum = 0;
  let chemicalBoundaryMaximum = 0;

  for (let index = 0; index < nextPhase.length; index += 1) {
    const phaseDifference =
      (nextPhase[index] ?? Number.NaN) - (previousPhase[index] ?? Number.NaN);
    const chemicalDifference =
      (nextChemicalPotential[index] ?? Number.NaN) -
      (previousChemicalPotential[index] ?? Number.NaN);
    const absolutePhaseDifference = Math.abs(phaseDifference);
    const absoluteChemicalDifference = Math.abs(chemicalDifference);
    phaseMaximum = Math.max(phaseMaximum, absolutePhaseDifference);
    chemicalMaximum = Math.max(chemicalMaximum, absoluteChemicalDifference);
    phaseSquares += phaseDifference * phaseDifference;
    chemicalSquares += chemicalDifference * chemicalDifference;
    phaseScale = Math.max(phaseScale, Math.abs(nextPhase[index] ?? Number.NaN));
    chemicalScale = Math.max(
      chemicalScale,
      Math.abs(nextChemicalPotential[index] ?? Number.NaN),
    );
    const [x, y, z] = gridCoordinates(index, shape);
    if (isBoundary(x, y, z, shape)) {
      phaseBoundaryMaximum = Math.max(
        phaseBoundaryMaximum,
        absolutePhaseDifference,
      );
      chemicalBoundaryMaximum = Math.max(
        chemicalBoundaryMaximum,
        absoluteChemicalDifference,
      );
    }
  }

  const phaseNorm = residualNorm(
    phaseMaximum,
    phaseSquares,
    nextPhase.length,
    phaseScale,
    tolerance,
  );
  const chemicalNorm = residualNorm(
    chemicalMaximum,
    chemicalSquares,
    nextChemicalPotential.length,
    chemicalScale,
    tolerance,
  );
  return {
    phase: phaseNorm,
    chemicalPotential: chemicalNorm,
    phaseBoundaryMaximum,
    chemicalPotentialBoundaryMaximum: chemicalBoundaryMaximum,
    maximumNormalized: Math.max(
      phaseNorm.normalizedMaximum,
      chemicalNorm.normalizedMaximum,
    ),
  };
}

function relaxField(
  current: Float32Array,
  mapped: Float32Array,
  relaxation: number,
): Float32Array {
  const relaxed = new Float32Array(current.length);
  for (let index = 0; index < relaxed.length; index += 1) {
    const currentValue = current[index] ?? Number.NaN;
    relaxed[index] = Math.fround(
      currentValue +
        relaxation * ((mapped[index] ?? Number.NaN) - currentValue),
    );
  }
  return relaxed;
}

/**
 * Developer-only coupled backward-Euler reference. This is a Float32 block
 * Picard solve, not the authors' variable-step BDF2/multigrid integrator.
 * Time and solidification state advance only after the coupled residual and
 * final iterate update both satisfy the configured tolerance.
 */
export function solveCpuCoupledBackwardEulerStep(
  state: CpuSimulationState,
  options: CpuCoupledStepOptions = {},
): CpuCoupledStepResult {
  validateState(state);
  const maximumIterations = options.maximumIterations ?? 32;
  const residualTolerance = options.residualTolerance ?? 2e-7;
  const relaxation = options.relaxation ?? 1;
  if (!Number.isInteger(maximumIterations) || maximumIterations < 0) {
    throw new RangeError('maximumIterations must be a non-negative integer.');
  }
  if (!Number.isFinite(residualTolerance) || residualTolerance <= 0) {
    throw new RangeError('residualTolerance must be finite and positive.');
  }
  if (!Number.isFinite(relaxation) || relaxation <= 0 || relaxation > 1) {
    throw new RangeError('relaxation must be in the interval (0, 1].');
  }

  const predictorPhaseStep = computeCpuPhaseStep(state);
  let phase = predictorPhaseStep.phase;
  let chemicalPotential = computeCpuChemicalPotentialStep(
    state,
    predictorPhaseStep,
  );
  let update = measureCoupledUpdate(
    phase,
    phase,
    chemicalPotential,
    chemicalPotential,
    state.config.grid.shape,
    residualTolerance,
  );
  let iterations = 0;
  const residualHistory: number[] = [];
  let predictorResidual: CpuCoupledResidual | null = null;

  while (true) {
    const phaseMap = evaluateCpuPhaseUpdateMap(
      state,
      phase,
      chemicalPotential,
    ).phase;
    const chemicalPotentialMap = evaluateCpuChemicalPotentialUpdateMap(
      state,
      phase,
      chemicalPotential,
    );
    const residual = measureCoupledResidual(
      state,
      phase,
      chemicalPotential,
      phaseMap,
      chemicalPotentialMap,
      residualTolerance,
    );
    predictorResidual ??= residual;
    residualHistory.push(residual.maximumNormalized);
    const converged =
      residual.maximumNormalized <= 1 && update.maximumNormalized <= 1;
    if (converged || iterations === maximumIterations) {
      return {
        phase,
        chemicalPotential,
        state: converged
          ? advanceCpuState(state, phase, chemicalPotential)
          : null,
        diagnostics: {
          converged,
          iterations,
          relaxation,
          residualTolerance,
          predictorResidual,
          residual,
          update,
          maximumNormalizedResidualHistory: residualHistory,
        },
      };
    }

    const nextPhase = relaxField(phase, phaseMap, relaxation);
    const nextChemicalMap = evaluateCpuChemicalPotentialUpdateMap(
      state,
      nextPhase,
      chemicalPotential,
    );
    const nextChemicalPotential = relaxField(
      chemicalPotential,
      nextChemicalMap,
      relaxation,
    );
    update = measureCoupledUpdate(
      phase,
      nextPhase,
      chemicalPotential,
      nextChemicalPotential,
      state.config.grid.shape,
      residualTolerance,
    );
    phase = nextPhase;
    chemicalPotential = nextChemicalPotential;
    iterations += 1;
  }
}

export function stepCpuSimulation(
  state: CpuSimulationState,
): CpuSimulationState {
  const phaseStep = computeCpuPhaseStep(state);
  const chemicalPotential = computeCpuChemicalPotentialStep(state, phaseStep);
  return advanceCpuState(state, phaseStep.phase, chemicalPotential);
}
