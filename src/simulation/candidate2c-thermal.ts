import { candidate2CNucleationVelocity } from './candidate2c';

/** Conservative radial thermal gate for the Candidate 2C step hypothesis. */
export interface Candidate2CThermalStepConfiguration {
  readonly radialCellCount: number;
  readonly facetRadius: number;
  readonly timeStep: number;
  readonly thermalDiffusivity: number;
  /** Outer Robin coefficient in inverse radial-length units. */
  readonly rimRobinCoefficient: number;
  readonly ambientTemperature: number;
  readonly initialTemperature: number;
  readonly stepHeight: number;
  readonly stepKineticCoefficient: number;
  readonly nucleationPrefactor: number;
  readonly nucleationBarrier: number;
  readonly latentHeatPerVolume: number;
}

export interface DerivedCandidate2CThermalStepConfiguration extends Candidate2CThermalStepConfiguration {
  readonly radialSpacing: number;
  readonly maximumStableTimeStep: number;
  readonly maximumStepCourant: number;
}

export interface Candidate2CThermalStepState {
  readonly configuration: DerivedCandidate2CThermalStepConfiguration;
  readonly temperature: Float64Array;
  readonly activeStepRadii: readonly number[];
  readonly completedLayers: number;
  readonly nucleationAccumulator: number;
  readonly emittedLayers: number;
  readonly integratedSolidVolume: number;
  readonly cumulativeExternalHeat: number;
  readonly cumulativeLatentHeat: number;
  readonly initialThermalEnergy: number;
  readonly time: number;
  readonly step: number;
}

export const CANDIDATE2C_THERMAL_STEP_ISOLATION = Object.freeze({
  radialCellCount: 64,
  facetRadius: 4,
  timeStep: 0.001,
  thermalDiffusivity: 1,
  rimRobinCoefficient: 1,
  ambientTemperature: -1,
  initialTemperature: 0,
  stepHeight: 0.1,
  stepKineticCoefficient: 1,
  nucleationPrefactor: 2,
  nucleationBarrier: 0.1,
  latentHeatPerVolume: 1,
}) satisfies Candidate2CThermalStepConfiguration;

/** Declared before evaluating the fixed coupled isolation. */
export const CANDIDATE2C_THERMAL_STEP_GATES = Object.freeze({
  evaluationTime: 1.5,
  minimumEmittedLayers: 1,
  minimumActiveTerraces: 1,
  maximumEnergyRelativeError: 1e-10,
  maximumRefinementDifference: 0.15,
});

const MAXIMUM_CANDIDATE2C_STEP_COURANT = 0.25;

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

function annularArea(index: number, spacing: number): number {
  const inner = index * spacing;
  const outer = (index + 1) * spacing;
  return Math.PI * (outer ** 2 - inner ** 2);
}

export function deriveCandidate2CThermalStepConfiguration(
  configuration: Candidate2CThermalStepConfiguration,
): DerivedCandidate2CThermalStepConfiguration {
  if (
    !Number.isInteger(configuration.radialCellCount) ||
    configuration.radialCellCount < 4
  ) {
    throw new RangeError('radialCellCount must be an integer >= 4.');
  }
  assertFinitePositive('facetRadius', configuration.facetRadius);
  assertFinitePositive('timeStep', configuration.timeStep);
  assertFinitePositive('thermalDiffusivity', configuration.thermalDiffusivity);
  assertFiniteNonnegative(
    'rimRobinCoefficient',
    configuration.rimRobinCoefficient,
  );
  if (
    !Number.isFinite(configuration.ambientTemperature) ||
    !Number.isFinite(configuration.initialTemperature)
  ) {
    throw new RangeError('Thermal temperatures must be finite.');
  }
  assertFinitePositive('stepHeight', configuration.stepHeight);
  assertFinitePositive(
    'stepKineticCoefficient',
    configuration.stepKineticCoefficient,
  );
  assertFiniteNonnegative(
    'nucleationPrefactor',
    configuration.nucleationPrefactor,
  );
  assertFiniteNonnegative('nucleationBarrier', configuration.nucleationBarrier);
  assertFinitePositive(
    'latentHeatPerVolume',
    configuration.latentHeatPerVolume,
  );

  const radialSpacing =
    configuration.facetRadius / configuration.radialCellCount;
  let maximumLossRate = 0;
  for (let index = 0; index < configuration.radialCellCount; index += 1) {
    const innerRadius = index * radialSpacing;
    const outerRadius = (index + 1) * radialSpacing;
    const innerConductance =
      index > 0
        ? (configuration.thermalDiffusivity * 2 * Math.PI * innerRadius) /
          radialSpacing
        : 0;
    const outerConductance =
      index + 1 < configuration.radialCellCount
        ? (configuration.thermalDiffusivity * 2 * Math.PI * outerRadius) /
          radialSpacing
        : configuration.thermalDiffusivity *
          2 *
          Math.PI *
          configuration.facetRadius *
          configuration.rimRobinCoefficient;
    maximumLossRate = Math.max(
      maximumLossRate,
      (innerConductance + outerConductance) / annularArea(index, radialSpacing),
    );
  }
  const maximumStableTimeStep = 0.8 / maximumLossRate;
  if (configuration.timeStep > maximumStableTimeStep) {
    throw new RangeError(
      `timeStep ${configuration.timeStep} exceeds Candidate 2C thermal bound ${maximumStableTimeStep}.`,
    );
  }
  const maximumUndercooling = Math.max(
    0,
    -configuration.initialTemperature,
    -configuration.ambientTemperature,
  );
  const maximumStepCourant =
    (configuration.stepKineticCoefficient *
      maximumUndercooling *
      configuration.timeStep) /
    radialSpacing;
  if (maximumStepCourant > MAXIMUM_CANDIDATE2C_STEP_COURANT) {
    throw new RangeError(
      `Candidate 2C step Courant ${maximumStepCourant} exceeds ${MAXIMUM_CANDIDATE2C_STEP_COURANT}.`,
    );
  }
  return {
    ...configuration,
    radialSpacing,
    maximumStableTimeStep,
    maximumStepCourant,
  };
}

export function candidate2CThermalEnergy(
  state: Candidate2CThermalStepState,
): number {
  const { radialSpacing } = state.configuration;
  let energy = 0;
  for (let index = 0; index < state.temperature.length; index += 1) {
    energy +=
      (state.temperature[index] ?? Number.NaN) *
      annularArea(index, radialSpacing);
  }
  return energy;
}

export function createCandidate2CThermalStepState(
  configuration: Candidate2CThermalStepConfiguration,
): Candidate2CThermalStepState {
  const derived = deriveCandidate2CThermalStepConfiguration(configuration);
  const temperature = new Float64Array(derived.radialCellCount);
  temperature.fill(derived.initialTemperature);
  const initialThermalEnergy = temperature.reduce(
    (sum, value, index) =>
      sum + value * annularArea(index, derived.radialSpacing),
    0,
  );
  return {
    configuration: derived,
    temperature,
    activeStepRadii: [],
    completedLayers: 0,
    nucleationAccumulator: 0,
    emittedLayers: 0,
    integratedSolidVolume: 0,
    cumulativeExternalHeat: 0,
    cumulativeLatentHeat: 0,
    initialThermalEnergy,
    time: 0,
    step: 0,
  };
}

function temperatureAtRadius(
  temperature: Float64Array,
  radius: number,
  configuration: DerivedCandidate2CThermalStepConfiguration,
): number {
  const coordinate = radius / configuration.radialSpacing - 0.5;
  const lowerIndex = Math.max(
    0,
    Math.min(configuration.radialCellCount - 1, Math.floor(coordinate)),
  );
  const upperIndex = Math.min(
    configuration.radialCellCount - 1,
    lowerIndex + 1,
  );
  const fraction = Math.max(0, Math.min(1, coordinate - lowerIndex));
  return (
    (temperature[lowerIndex] ?? Number.NaN) * (1 - fraction) +
    (temperature[upperIndex] ?? Number.NaN) * fraction
  );
}

function addSweptLatentHeat(
  energy: Float64Array,
  outerRadius: number,
  innerRadius: number,
  configuration: DerivedCandidate2CThermalStepConfiguration,
): number {
  let sweptVolume = 0;
  for (let index = 0; index < configuration.radialCellCount; index += 1) {
    const cellInner = index * configuration.radialSpacing;
    const cellOuter = (index + 1) * configuration.radialSpacing;
    const overlapInner = Math.max(innerRadius, cellInner);
    const overlapOuter = Math.min(outerRadius, cellOuter);
    if (overlapOuter <= overlapInner) continue;
    const volume =
      Math.PI *
      configuration.stepHeight *
      (overlapOuter ** 2 - overlapInner ** 2);
    energy[index] =
      (energy[index] ?? Number.NaN) +
      volume * configuration.latentHeatPerVolume;
    sweptVolume += volume;
  }
  return sweptVolume;
}

export function stepCandidate2CThermalStepState(
  state: Candidate2CThermalStepState,
): Candidate2CThermalStepState {
  const { configuration } = state;
  const { radialCellCount, radialSpacing, thermalDiffusivity, timeStep } =
    configuration;
  const energy = new Float64Array(radialCellCount);
  for (let index = 0; index < radialCellCount; index += 1) {
    energy[index] =
      (state.temperature[index] ?? Number.NaN) *
      annularArea(index, radialSpacing);
  }

  for (let face = 1; face < radialCellCount; face += 1) {
    const radius = face * radialSpacing;
    const heatRate =
      (thermalDiffusivity *
        2 *
        Math.PI *
        radius *
        ((state.temperature[face] ?? Number.NaN) -
          (state.temperature[face - 1] ?? Number.NaN))) /
      radialSpacing;
    energy[face - 1] = (energy[face - 1] ?? Number.NaN) + timeStep * heatRate;
    energy[face] = (energy[face] ?? Number.NaN) - timeStep * heatRate;
  }

  const rimTemperature = state.temperature[radialCellCount - 1] ?? Number.NaN;
  const externalHeatRate =
    -thermalDiffusivity *
    2 *
    Math.PI *
    configuration.facetRadius *
    configuration.rimRobinCoefficient *
    (rimTemperature - configuration.ambientTemperature);
  energy[radialCellCount - 1] =
    (energy[radialCellCount - 1] ?? Number.NaN) + timeStep * externalHeatRate;

  const movedRadii: number[] = [];
  let completedLayers = state.completedLayers;
  let sweptVolume = 0;
  for (const radius of state.activeStepRadii) {
    const localUndercooling = Math.max(
      0,
      -temperatureAtRadius(state.temperature, radius, configuration),
    );
    const nextRadius = Math.max(
      0,
      radius -
        configuration.stepKineticCoefficient * localUndercooling * timeStep,
    );
    sweptVolume += addSweptLatentHeat(
      energy,
      radius,
      nextRadius,
      configuration,
    );
    if (nextRadius === 0) completedLayers += 1;
    else movedRadii.push(nextRadius);
  }

  const rimUndercooling = Math.max(0, -rimTemperature);
  const layerBirthRate =
    candidate2CNucleationVelocity(
      rimUndercooling,
      configuration.nucleationPrefactor,
      configuration.nucleationBarrier,
    ) / configuration.stepHeight;
  const accumulatedLayers =
    state.nucleationAccumulator + layerBirthRate * timeStep;
  const births = Math.floor(accumulatedLayers);
  for (let birth = 0; birth < births; birth += 1) {
    movedRadii.push(configuration.facetRadius);
  }
  movedRadii.sort((left, right) => left - right);

  const nextTemperature = new Float64Array(radialCellCount);
  for (let index = 0; index < radialCellCount; index += 1) {
    nextTemperature[index] =
      (energy[index] ?? Number.NaN) / annularArea(index, radialSpacing);
  }
  const latentHeat = sweptVolume * configuration.latentHeatPerVolume;
  return {
    configuration,
    temperature: nextTemperature,
    activeStepRadii: movedRadii,
    completedLayers,
    nucleationAccumulator: accumulatedLayers - births,
    emittedLayers: state.emittedLayers + births,
    integratedSolidVolume: state.integratedSolidVolume + sweptVolume,
    cumulativeExternalHeat:
      state.cumulativeExternalHeat + timeStep * externalHeatRate,
    cumulativeLatentHeat: state.cumulativeLatentHeat + latentHeat,
    initialThermalEnergy: state.initialThermalEnergy,
    time: state.time + timeStep,
    step: state.step + 1,
  };
}

export function runCandidate2CThermalStepSteps(
  initial: Candidate2CThermalStepState,
  steps: number,
): Candidate2CThermalStepState {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a nonnegative integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = stepCandidate2CThermalStepState(state);
  }
  return state;
}

export function candidate2CThermalStepOpeningDepth(
  state: Candidate2CThermalStepState,
): number {
  const resolvedTerraces = state.activeStepRadii.filter(
    (radius) =>
      state.configuration.facetRadius - radius >=
      state.configuration.radialSpacing,
  ).length;
  return resolvedTerraces * state.configuration.stepHeight;
}
