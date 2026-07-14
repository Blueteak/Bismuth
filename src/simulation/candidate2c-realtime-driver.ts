/**
 * Retired Candidate 2C reduced driver. The conservative ledger may inform a
 * future target-matched driver, but this six-facet habit is not product input.
 */
import {
  createCandidate2CFacetedState,
  stepCandidate2CFacetedState,
  type Candidate2CFacetedConfiguration,
  type Candidate2CFacetedState,
} from './candidate2c-faceted';

export interface Candidate2CRealtimeDriverConfiguration extends Candidate2CFacetedConfiguration {
  /** Lumped cold-content capacity for the reduced source-backed driver. */
  readonly effectiveHeatCapacity: number;
  /** Positive heat-removal power supplied by the unresolved outer boundary. */
  readonly externalCoolingPower: number;
  readonly initialUndercooling: number;
}

export interface Candidate2CRealtimeDriverState {
  readonly configuration: Candidate2CRealtimeDriverConfiguration;
  readonly faceted: Candidate2CFacetedState;
  readonly undercooling: number;
  readonly initialColdContent: number;
  readonly cumulativeExternalHeatRemoved: number;
  readonly cumulativeLatentHeatReleased: number;
  readonly loopCrossingDetected: boolean;
}

export interface Candidate2CRealtimeDriverLedger {
  readonly storedColdContent: number;
  readonly expectedColdContent: number;
  readonly residual: number;
  readonly scale: number;
  readonly normalizedResidual: number;
}

/** Frozen before evaluating the first realtime-first WebGPU-visible proof. */
export const CANDIDATE2C_REALTIME_DRIVER_PROOF = Object.freeze({
  configuration: Object.freeze({
    orientation: Object.freeze({ x: -Math.PI / 2, y: 0, z: 0 }),
    facetInradius: 4,
    stepHeight: 0.25,
    birthInwardOffset: 0.125,
    stepKineticCoefficient: 1,
    nucleationPrefactor: 0.5,
    nucleationBarrier: 1,
    latentHeatPerVolume: 1,
    timeStep: 0.05,
    effectiveHeatCapacity: 32,
    externalCoolingPower: 3,
    initialUndercooling: 1,
  }) satisfies Candidate2CRealtimeDriverConfiguration,
  totalSteps: 120,
  checkpointInterval: 10,
  minimumEmittedLayers: 3,
  minimumActiveTerraces: 2,
  minimumOpeningDepthInSteps: 2,
  maximumNormalizedEnergyResidual: 1e-12,
  minimumChangedMeshPromotions: 3,
});

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function assertFiniteNonnegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and nonnegative.`);
  }
}

function loopsRemainStrictlyNested(offsets: readonly number[]): boolean {
  for (let index = 1; index < offsets.length; index += 1) {
    if (
      !((offsets[index - 1] ?? Number.NaN) > (offsets[index] ?? Number.NaN))
    ) {
      return false;
    }
  }
  return true;
}

export function candidate2CRealtimeDriverLedger(
  state: Candidate2CRealtimeDriverState,
): Candidate2CRealtimeDriverLedger {
  const storedColdContent =
    state.configuration.effectiveHeatCapacity * state.undercooling;
  const expectedColdContent =
    state.initialColdContent +
    state.cumulativeExternalHeatRemoved -
    state.cumulativeLatentHeatReleased;
  const residual = storedColdContent - expectedColdContent;
  const scale = Math.max(
    1,
    Math.abs(storedColdContent),
    Math.abs(state.initialColdContent),
    Math.abs(state.cumulativeExternalHeatRemoved),
    Math.abs(state.cumulativeLatentHeatReleased),
  );
  return {
    storedColdContent,
    expectedColdContent,
    residual,
    scale,
    normalizedResidual: Math.abs(residual) / scale,
  };
}

export function createCandidate2CRealtimeDriverState(
  configuration: Candidate2CRealtimeDriverConfiguration,
): Candidate2CRealtimeDriverState {
  assertFinitePositive(
    'effectiveHeatCapacity',
    configuration.effectiveHeatCapacity,
  );
  assertFiniteNonnegative(
    'externalCoolingPower',
    configuration.externalCoolingPower,
  );
  assertFiniteNonnegative(
    'initialUndercooling',
    configuration.initialUndercooling,
  );
  const faceted = createCandidate2CFacetedState(configuration);
  return {
    configuration,
    faceted,
    undercooling: configuration.initialUndercooling,
    initialColdContent:
      configuration.effectiveHeatCapacity * configuration.initialUndercooling,
    cumulativeExternalHeatRemoved: 0,
    cumulativeLatentHeatReleased: 0,
    loopCrossingDetected: false,
  };
}

export function stepCandidate2CRealtimeDriverState(
  state: Candidate2CRealtimeDriverState,
): Candidate2CRealtimeDriverState {
  const { configuration } = state;
  const faceted = stepCandidate2CFacetedState(
    state.faceted,
    state.undercooling,
  );
  const latentHeatReleased =
    faceted.releasedLatentHeat - state.faceted.releasedLatentHeat;
  const externalHeatRemoved =
    configuration.externalCoolingPower * configuration.timeStep;
  const storedColdContent =
    configuration.effectiveHeatCapacity * state.undercooling +
    externalHeatRemoved -
    latentHeatReleased;
  const coldContentTolerance =
    1e-12 *
    Math.max(
      1,
      configuration.effectiveHeatCapacity * state.undercooling,
      externalHeatRemoved,
      latentHeatReleased,
    );
  if (storedColdContent < -coldContentTolerance) {
    throw new RangeError(
      'Candidate 2C realtime driver exhausted its available cold content.',
    );
  }
  return {
    configuration,
    faceted,
    undercooling:
      Math.max(0, storedColdContent) / configuration.effectiveHeatCapacity,
    initialColdContent: state.initialColdContent,
    cumulativeExternalHeatRemoved:
      state.cumulativeExternalHeatRemoved + externalHeatRemoved,
    cumulativeLatentHeatReleased:
      state.cumulativeLatentHeatReleased + latentHeatReleased,
    loopCrossingDetected:
      state.loopCrossingDetected ||
      !loopsRemainStrictlyNested(faceted.activeLoopOffsets),
  };
}

export function runCandidate2CRealtimeDriverSteps(
  initial: Candidate2CRealtimeDriverState,
  steps: number,
): Candidate2CRealtimeDriverState {
  if (!Number.isSafeInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a nonnegative safe integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = stepCandidate2CRealtimeDriverState(state);
  }
  return state;
}
