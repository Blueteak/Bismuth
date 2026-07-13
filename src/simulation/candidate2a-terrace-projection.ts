import {
  candidate2ADiffuseSolidFraction,
  candidate2APhaseForceDecomposition,
  type Candidate2AThermalState,
} from './candidate2a';
import { runCandidate2AThermalPulseDiagnostic } from './candidate2a-thermal-pulse';

export type Candidate2AThermalPulseArmName = 'equal' | 'forward' | 'reverse';

export const CANDIDATE2A_TERRACE_PROJECTION_PARAMETERS = Object.freeze({
  expectedShape: [41, 25, 41] as const,
  expectedSpacing: 0.75,
  expectedInterfaceWidth: 1.5,
  supportSpanInInterfaceWidths: 4,
  riseWidthInInterfaceWidths: 1,
  plateauWidthInInterfaceWidths: 2,
  fallWidthInInterfaceWidths: 1,
  terraceHeightInInterfaceWidths: 2,
  finiteDifferenceAmplitudeInGridCells: 0.25,
});

export interface Candidate2ATerraceProposal {
  readonly footprintCentroid: readonly [number, number];
  readonly footprintVoxelCount: number;
  readonly footprintEquivalentRadius: number;
  readonly supportInnerRadius: number;
  readonly supportRiseEndRadius: number;
  readonly supportPlateauEndRadius: number;
  readonly supportOuterRadius: number;
  readonly terraceHeight: number;
  readonly finiteDifferenceAmplitude: number;
  /** Core subtraction required to make the opening tangent volume-neutral. */
  readonly coreSubtractionScale: number;
  readonly normalizedVolumeResidual: number;
  /** One injected phase proposal shared identically by every thermal arm. */
  readonly orderParameter: Float32Array;
  /** Volume-neutral opening tangent: positive raises the ring vs the core. */
  readonly amplitudeMode: Float64Array;
  readonly modeNormSquared: number;
}

export interface Candidate2ATerraceProjectedRates {
  readonly variational: number;
  readonly thermal: number;
  readonly total: number;
  readonly recompositionError: number;
}

export interface Candidate2ATerraceContrast {
  readonly thermalDelta: number;
  readonly totalDelta: number;
}

export interface Candidate2ATerraceOddEvenContrast {
  readonly thermalOdd: number;
  readonly thermalEven: number;
  readonly totalOdd: number;
  readonly totalEven: number;
}

export interface Candidate2ATerraceProjectionResult {
  readonly proposal: Candidate2ATerraceProposal;
  readonly arms: Readonly<
    Record<Candidate2AThermalPulseArmName, Candidate2ATerraceProjectedRates>
  >;
  readonly relativeToEqual: Readonly<
    Record<'forward' | 'reverse', Candidate2ATerraceContrast>
  >;
  readonly oddEven: Candidate2ATerraceOddEvenContrast;
}

function linearIndex(
  x: number,
  y: number,
  z: number,
  shape: readonly [number, number, number],
): number {
  return x + shape[0] * (y + shape[1] * z);
}

function smoothStep(fraction: number): number {
  return fraction * fraction * (3 - 2 * fraction);
}

/** Fixed C1 W/2W/W outer-ring support ending at the footprint radius. */
export function candidate2ATerraceRingSupport(
  radius: number,
  equivalentRadius: number,
  interfaceWidth: number,
): number {
  if (
    !Number.isFinite(radius) ||
    !Number.isFinite(equivalentRadius) ||
    !Number.isFinite(interfaceWidth) ||
    radius < 0 ||
    interfaceWidth <= 0 ||
    equivalentRadius <= 4 * interfaceWidth
  ) {
    throw new RangeError('Terrace support requires finite resolved radii.');
  }
  const inner = equivalentRadius - 4 * interfaceWidth;
  const riseEnd = equivalentRadius - 3 * interfaceWidth;
  const plateauEnd = equivalentRadius - interfaceWidth;
  if (radius <= inner || radius >= equivalentRadius) return 0;
  if (radius < riseEnd) {
    return smoothStep((radius - inner) / interfaceWidth);
  }
  if (radius <= plateauEnd) return 1;
  return 1 - smoothStep((radius - plateauEnd) / interfaceWidth);
}

/** Resolved core support ending exactly where the outer-ring support begins. */
export function candidate2ATerraceCoreSupport(
  radius: number,
  equivalentRadius: number,
  interfaceWidth: number,
): number {
  if (
    !Number.isFinite(radius) ||
    !Number.isFinite(equivalentRadius) ||
    !Number.isFinite(interfaceWidth) ||
    radius < 0 ||
    interfaceWidth <= 0 ||
    equivalentRadius < 6 * interfaceWidth
  ) {
    throw new RangeError(
      'Terrace core support requires a plateau diameter of at least 2W.',
    );
  }
  const ringInnerRadius = equivalentRadius - 4 * interfaceWidth;
  const plateauEnd = ringInnerRadius - interfaceWidth;
  if (radius <= plateauEnd) return 1;
  if (radius >= ringInnerRadius) return 0;
  return 1 - smoothStep((radius - plateauEnd) / interfaceWidth);
}

function validateExactMorphologySeed(seed: Candidate2AThermalState): void {
  const parameters = CANDIDATE2A_TERRACE_PROJECTION_PARAMETERS;
  if (
    seed.config.shape.some(
      (size, axis) => size !== parameters.expectedShape[axis],
    ) ||
    seed.config.spacing !== parameters.expectedSpacing ||
    seed.config.interfaceWidth !== parameters.expectedInterfaceWidth ||
    seed.orderParameter.length !== seed.config.voxelCount
  ) {
    throw new RangeError(
      'Terrace projection requires the exact Candidate 2A morphology seed grid.',
    );
  }
}

function measureSolidFootprint(seed: Candidate2AThermalState): {
  readonly centroid: readonly [number, number];
  readonly voxelCount: number;
  readonly equivalentRadius: number;
} {
  const { shape, spacing } = seed.config;
  let count = 0;
  let sumX = 0;
  let sumZ = 0;
  for (let z = 0; z < shape[2]; z += 1) {
    for (let x = 0; x < shape[0]; x += 1) {
      const psi =
        seed.orderParameter[linearIndex(x, 0, z, shape)] ?? Number.NaN;
      if (!(candidate2ADiffuseSolidFraction(psi) >= 0.5)) continue;
      count += 1;
      sumX += x * spacing;
      sumZ += z * spacing;
    }
  }
  if (count === 0) {
    throw new RangeError('The converged seed has no solid y=0 footprint.');
  }
  return {
    centroid: [sumX / count, sumZ / count],
    voxelCount: count,
    equivalentRadius: Math.sqrt((count * spacing ** 2) / Math.PI),
  };
}

function shiftedSeedOrderParameter(
  seed: Candidate2AThermalState,
  centroid: readonly [number, number],
  columnShift: number,
  supportAtRadius: (radius: number) => number,
): Float32Array {
  const { shape, spacing, voxelCount } = seed.config;
  const shifted = new Float32Array(voxelCount);
  for (let z = 0; z < shape[2]; z += 1) {
    for (let x = 0; x < shape[0]; x += 1) {
      const radius = Math.hypot(
        x * spacing - centroid[0],
        z * spacing - centroid[1],
      );
      const shift = columnShift * supportAtRadius(radius);
      for (let y = 0; y < shape[1]; y += 1) {
        const sourceCoordinate = Math.max(0, y * spacing - shift) / spacing;
        const lowerY = Math.floor(sourceCoordinate);
        const upperY = Math.min(shape[1] - 1, lowerY + 1);
        const fraction = sourceCoordinate - lowerY;
        const lower =
          seed.orderParameter[linearIndex(x, lowerY, z, shape)] ?? Number.NaN;
        const upper =
          seed.orderParameter[linearIndex(x, upperY, z, shape)] ?? Number.NaN;
        shifted[linearIndex(x, y, z, shape)] = Math.fround(
          lower * (1 - fraction) + upper * fraction,
        );
      }
    }
  }
  return shifted;
}

/**
 * Constructs one injected resolved outer-ring terrace. This is a force probe,
 * never an initial condition or generated product morphology.
 */
export function createCandidate2ATerraceProposal(
  seed: Candidate2AThermalState,
): Candidate2ATerraceProposal {
  validateExactMorphologySeed(seed);
  const parameters = CANDIDATE2A_TERRACE_PROJECTION_PARAMETERS;
  const footprint = measureSolidFootprint(seed);
  const width = seed.config.interfaceWidth;
  if (footprint.equivalentRadius <= 4 * width) {
    throw new RangeError('The seed footprint cannot resolve a 4W ring.');
  }
  if (footprint.equivalentRadius < 6 * width) {
    throw new RangeError(
      'The seed footprint cannot resolve the required 2W core plateau diameter.',
    );
  }
  const terraceHeight = parameters.terraceHeightInInterfaceWidths * width;
  const finiteDifferenceAmplitude =
    parameters.finiteDifferenceAmplitudeInGridCells * seed.config.spacing;
  const orderParameter = shiftedSeedOrderParameter(
    seed,
    footprint.centroid,
    terraceHeight,
    (radius) =>
      candidate2ATerraceRingSupport(radius, footprint.equivalentRadius, width),
  );
  const plus = shiftedSeedOrderParameter(
    seed,
    footprint.centroid,
    terraceHeight + finiteDifferenceAmplitude,
    (radius) =>
      candidate2ATerraceRingSupport(radius, footprint.equivalentRadius, width),
  );
  const minus = shiftedSeedOrderParameter(
    seed,
    footprint.centroid,
    terraceHeight - finiteDifferenceAmplitude,
    (radius) =>
      candidate2ATerraceRingSupport(radius, footprint.equivalentRadius, width),
  );
  const corePlus = shiftedSeedOrderParameter(
    seed,
    footprint.centroid,
    finiteDifferenceAmplitude,
    (radius) =>
      candidate2ATerraceCoreSupport(radius, footprint.equivalentRadius, width),
  );
  const coreMinus = shiftedSeedOrderParameter(
    seed,
    footprint.centroid,
    -finiteDifferenceAmplitude,
    (radius) =>
      candidate2ATerraceCoreSupport(radius, footprint.equivalentRadius, width),
  );
  const amplitudeMode = new Float64Array(seed.config.voxelCount);
  const ringDerivative = new Float64Array(seed.config.voxelCount);
  const coreDerivative = new Float64Array(seed.config.voxelCount);
  let weightedRingDerivative = 0;
  let weightedCoreDerivative = 0;
  for (let index = 0; index < amplitudeMode.length; index += 1) {
    const ring =
      ((plus[index] ?? Number.NaN) - (minus[index] ?? Number.NaN)) /
      (2 * finiteDifferenceAmplitude);
    const core =
      ((corePlus[index] ?? Number.NaN) - (coreMinus[index] ?? Number.NaN)) /
      (2 * finiteDifferenceAmplitude);
    const psi = orderParameter[index] ?? Number.NaN;
    const diffuseVolumeDerivative = 0.75 * (1 - psi * psi);
    ringDerivative[index] = ring;
    coreDerivative[index] = core;
    weightedRingDerivative += diffuseVolumeDerivative * ring;
    weightedCoreDerivative += diffuseVolumeDerivative * core;
  }
  const coreSubtractionScale = weightedRingDerivative / weightedCoreDerivative;
  if (!Number.isFinite(coreSubtractionScale) || !(coreSubtractionScale > 0)) {
    throw new RangeError(
      'The resolved core must supply a finite positive volume tangent.',
    );
  }
  let modeNormSquared = 0;
  let weightedModeSum = 0;
  let weightedModeMagnitude = 0;
  for (let index = 0; index < amplitudeMode.length; index += 1) {
    const value =
      (ringDerivative[index] ?? Number.NaN) -
      coreSubtractionScale * (coreDerivative[index] ?? Number.NaN);
    const psi = orderParameter[index] ?? Number.NaN;
    const weightedValue = 0.75 * (1 - psi * psi) * value;
    amplitudeMode[index] = value;
    modeNormSquared += value * value;
    weightedModeSum += weightedValue;
    weightedModeMagnitude += Math.abs(weightedValue);
  }
  const normalizedVolumeResidual =
    Math.abs(weightedModeSum) / weightedModeMagnitude;
  if (
    !Number.isFinite(modeNormSquared) ||
    !(modeNormSquared > 0) ||
    amplitudeMode.some((value) => !Number.isFinite(value)) ||
    !Number.isFinite(normalizedVolumeResidual)
  ) {
    throw new RangeError(
      'The terrace amplitude mode must be finite and nonzero.',
    );
  }
  return {
    footprintCentroid: footprint.centroid,
    footprintVoxelCount: footprint.voxelCount,
    footprintEquivalentRadius: footprint.equivalentRadius,
    supportInnerRadius: footprint.equivalentRadius - 4 * width,
    supportRiseEndRadius: footprint.equivalentRadius - 3 * width,
    supportPlateauEndRadius: footprint.equivalentRadius - width,
    supportOuterRadius: footprint.equivalentRadius,
    terraceHeight,
    finiteDifferenceAmplitude,
    coreSubtractionScale,
    normalizedVolumeResidual,
    orderParameter,
    amplitudeMode,
    modeNormSquared,
  };
}

function projectArm(
  proposal: Candidate2ATerraceProposal,
  temperatureState: Candidate2AThermalState,
): Candidate2ATerraceProjectedRates {
  if (
    proposal.orderParameter.length !== temperatureState.config.voxelCount ||
    proposal.amplitudeMode.length !== temperatureState.config.voxelCount
  ) {
    throw new RangeError('Terrace proposal and pulse state grids must match.');
  }
  const decomposition = candidate2APhaseForceDecomposition({
    ...temperatureState,
    orderParameter: proposal.orderParameter,
  });
  let variationalNumerator = 0;
  let thermalNumerator = 0;
  let totalNumerator = 0;
  for (let index = 0; index < proposal.amplitudeMode.length; index += 1) {
    const mode = proposal.amplitudeMode[index] ?? Number.NaN;
    const inverseRelaxation =
      1 / (decomposition.relaxationTime[index] ?? Number.NaN);
    variationalNumerator +=
      mode *
      (decomposition.variationalDriving[index] ?? Number.NaN) *
      inverseRelaxation;
    thermalNumerator +=
      mode *
      (decomposition.thermalDriving[index] ?? Number.NaN) *
      inverseRelaxation;
    totalNumerator +=
      mode *
      (decomposition.totalDrivingForce[index] ?? Number.NaN) *
      inverseRelaxation;
  }
  const variational = variationalNumerator / proposal.modeNormSquared;
  const thermal = thermalNumerator / proposal.modeNormSquared;
  const total = totalNumerator / proposal.modeNormSquared;
  const recompositionError = Math.abs(total - (variational + thermal));
  if (
    ![variational, thermal, total, recompositionError].every(Number.isFinite)
  ) {
    throw new RangeError('Projected terrace rates must be finite.');
  }
  return { variational, thermal, total, recompositionError };
}

export function projectCandidate2ATerraceForces(
  proposal: Candidate2ATerraceProposal,
  temperatureStates: Readonly<
    Record<Candidate2AThermalPulseArmName, Candidate2AThermalState>
  >,
): Omit<Candidate2ATerraceProjectionResult, 'proposal'> {
  const arms = {
    equal: projectArm(proposal, temperatureStates.equal),
    forward: projectArm(proposal, temperatureStates.forward),
    reverse: projectArm(proposal, temperatureStates.reverse),
  };
  const relativeToEqual = {
    forward: {
      thermalDelta: arms.forward.thermal - arms.equal.thermal,
      totalDelta: arms.forward.total - arms.equal.total,
    },
    reverse: {
      thermalDelta: arms.reverse.thermal - arms.equal.thermal,
      totalDelta: arms.reverse.total - arms.equal.total,
    },
  };
  const oddEven = {
    thermalOdd: 0.5 * (arms.forward.thermal - arms.reverse.thermal),
    thermalEven:
      0.5 * (arms.forward.thermal + arms.reverse.thermal) - arms.equal.thermal,
    totalOdd: 0.5 * (arms.forward.total - arms.reverse.total),
    totalEven:
      0.5 * (arms.forward.total + arms.reverse.total) - arms.equal.total,
  };
  return { arms, relativeToEqual, oddEven };
}

/**
 * Runs the frozen thermal pulse and evaluates one identical injected terrace
 * against every final temperature. Positive projected rates amplify opening;
 * negative rates heal it. No phase state is evolved by this diagnostic.
 */
export function runCandidate2ATerraceProjectionDiagnostic(): Candidate2ATerraceProjectionResult {
  const pulse = runCandidate2AThermalPulseDiagnostic();
  const proposal = createCandidate2ATerraceProposal(pulse.seed);
  const projection = projectCandidate2ATerraceForces(proposal, {
    equal: pulse.arms.equal.finalState,
    forward: pulse.arms.forward.finalState,
    reverse: pulse.arms.reverse.finalState,
  });
  return { proposal, ...projection };
}
