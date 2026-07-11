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
        const radiusNoise = correlatedPerturbation(
          position,
          perturbations.seedRadiusCorrelationLength,
          radiusSignature,
        );
        const localRadius =
          parameters.initialRadius +
          perturbations.seedRadiusAmplitude * radiusNoise;
        const radius = Math.hypot(...position);
        const phi = Math.fround(
          1 /
            (1 + Math.exp(-(radius - localRadius) / parameters.interfaceWidth)),
        );
        const farField = farFieldChemicalPotentialAt(config, position);
        const chemicalNoise = correlatedPerturbation(
          position,
          perturbations.chemicalPotentialCorrelationLength,
          chemicalSignature,
        );
        const mu = Math.fround(
          parameters.equilibriumChemicalPotential -
            phi * (parameters.equilibriumChemicalPotential - farField) +
            phi * perturbations.chemicalPotentialAmplitude * chemicalNoise,
        );

        phase[index] = phi;
        chemicalPotential[index] = isBoundary(x, y, z, shape)
          ? Math.fround(farField)
          : mu;
        if (!isBoundary(x, y, z, shape) && phi <= solidificationThreshold) {
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

export function computeCpuPhaseStep(state: CpuSimulationState): CpuPhaseStep {
  validateState(state);
  const { config } = state;
  const { shape, timeStep } = config.grid;
  const nextPhase = new Float32Array(config.voxelCount);
  const phaseRate = new Float32Array(config.voxelCount);

  for (let z = 1; z < shape[2] - 1; z += 1) {
    for (let y = 1; y < shape[1] - 1; y += 1) {
      for (let x = 1; x < shape[0] - 1; x += 1) {
        const index = gridIndex(x, y, z, shape);
        const divergence = conservativeAnisotropyDivergence(
          state.phase,
          [x, y, z],
          config,
        );
        const oldPhi = state.phase[index] ?? Number.NaN;
        const rate = phaseLocalRate(
          oldPhi,
          state.chemicalPotential[index] ?? Number.NaN,
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

function axisDiffusionFlux(
  centerMu: number,
  neighborMu: number,
  centerDiffusivity: number,
  neighborDiffusivity: number,
): number {
  const faceDiffusivity = 0.5 * (centerDiffusivity + neighborDiffusivity);
  return faceDiffusivity * (neighborMu - centerMu);
}

export function computeCpuChemicalPotentialStep(
  state: CpuSimulationState,
  phaseStep: CpuPhaseStep,
): Float32Array {
  validateState(state);
  const { config } = state;
  if (
    phaseStep.phase.length !== config.voxelCount ||
    phaseStep.phaseRate.length !== config.voxelCount
  ) {
    throw new RangeError('Phase-step fields do not match the configured grid.');
  }

  const { shape, spacing, timeStep } = config.grid;
  const nextMu = new Float32Array(config.voxelCount);
  const inverseSpacingSquared = 1 / (spacing * spacing);

  for (let z = 1; z < shape[2] - 1; z += 1) {
    for (let y = 1; y < shape[1] - 1; y += 1) {
      for (let x = 1; x < shape[0] - 1; x += 1) {
        const index = gridIndex(x, y, z, shape);
        const centerPhi = phaseStep.phase[index] ?? Number.NaN;
        const centerMu = state.chemicalPotential[index] ?? Number.NaN;
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
            state.chemicalPotential[neighbor] ?? Number.NaN,
            centerDiffusivity,
            phaseDiffusivity(phaseStep.phase[neighbor] ?? Number.NaN, config),
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
          centerMu + timeStep * diffusionRate + sourceIncrement,
        );
      }
    }
  }

  // The far boundary is a fixed chemical-potential reservoir.
  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        if (!isBoundary(x, y, z, shape)) continue;
        const index = gridIndex(x, y, z, shape);
        nextMu[index] = Math.fround(
          farFieldChemicalPotentialAt(
            config,
            physicalPosition(x, y, z, config),
          ),
        );
      }
    }
  }

  return nextMu;
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

export function stepCpuSimulation(
  state: CpuSimulationState,
): CpuSimulationState {
  const phaseStep = computeCpuPhaseStep(state);
  const chemicalPotential = computeCpuChemicalPotentialStep(state, phaseStep);
  const nextTime = state.time + state.config.grid.timeStep;
  const solidificationTime = captureSolidificationTimes(
    state.phase,
    phaseStep.phase,
    state.solidificationTime,
    nextTime,
    state.config.grid.solidificationThreshold,
  );
  const { shape } = state.config.grid;

  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        if (isBoundary(x, y, z, shape)) {
          solidificationTime[gridIndex(x, y, z, shape)] =
            UNBORN_SOLIDIFICATION_TIME;
        }
      }
    }
  }

  return {
    config: state.config,
    phase: phaseStep.phase,
    chemicalPotential,
    solidificationTime,
    time: nextTime,
    step: state.step + 1,
  };
}
