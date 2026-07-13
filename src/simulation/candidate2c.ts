/**
 * Candidate 2C outer-source facet-step isolation.
 *
 * The model follows the melt-facet construction of Weinstein and Brandon
 * (2004): a ledge moves with v_step = beta_step DeltaT, while their
 * macroscopic defect-free facet law is approximated by
 * V_2DN = B DeltaT exp(-A / DeltaT). Dividing V_2DN by one step height to
 * create a deterministic layer clock is a derived isolation closure, not an
 * equation asserted by the paper. The outer source is an analogous concave
 * melt-growth boundary, not an established bismuth melt-air source. This is a
 * dimensionless mechanism discriminator, not a calibrated bismuth model or a
 * 3D phase-field coupling.
 */

export interface Candidate2CStepConfiguration {
  readonly facetRadius: number;
  readonly stepHeight: number;
  /** beta_step in v_step = beta_step DeltaT. */
  readonly stepKineticCoefficient: number;
  /** B in V_2DN = B DeltaT exp(-A / DeltaT). Zero disables layer birth. */
  readonly nucleationPrefactor: number;
  /** A in V_2DN = B DeltaT exp(-A / DeltaT). */
  readonly nucleationBarrier: number;
  /** Linear radial DeltaT value at the center sink. */
  readonly coreUndercooling: number;
  /** Linear radial DeltaT value at the outer step source. */
  readonly rimUndercooling: number;
  readonly latentHeatPerVolume: number;
  readonly timeStep: number;
}

export interface Candidate2CStepState {
  readonly configuration: Candidate2CStepConfiguration;
  readonly time: number;
  readonly step: number;
  /** Active circular ledges, expressed as radii in [0, facetRadius]. */
  readonly activeStepRadii: readonly number[];
  readonly completedLayers: number;
  /** Fractional layer-birth clock in [0, 1). */
  readonly nucleationAccumulator: number;
  readonly emittedLayers: number;
  /** Swept solid volume integrated from ledge motion. */
  readonly integratedSolidVolume: number;
  /** Latent heat released from the same, single swept-volume ledger. */
  readonly releasedLatentHeat: number;
}

export interface Candidate2CStepInitialization {
  readonly activeStepRadii?: readonly number[];
  readonly completedLayers?: number;
  readonly nucleationAccumulator?: number;
}

export interface Candidate2CFacetProfile {
  readonly radii: Float64Array;
  readonly heights: Float64Array;
  readonly coreHeight: number;
  readonly rimHeight: number;
  readonly openingDepth: number;
  readonly activeTerraceCount: number;
}

/** Declared before evaluating the fixed Candidate 2C isolation. */
export const CANDIDATE2C_STEP_ISOLATION = Object.freeze({
  facetRadius: 4,
  stepHeight: 0.25,
  stepKineticCoefficient: 1,
  nucleationPrefactor: 0.25,
  nucleationBarrier: 1,
  coreUndercooling: 1,
  rimUndercooling: 1,
  latentHeatPerVolume: 1,
  timeStep: 0.05,
}) satisfies Candidate2CStepConfiguration;

export const CANDIDATE2C_STEP_GATES = Object.freeze({
  evaluationTime: 6,
  minimumActiveTerraces: 2,
  minimumOpeningDepthInSteps: 2,
  maximumLedgerRelativeError: 1e-12,
  maximumTimeRefinementError: 1e-11,
  maximumFineProfileVolumeError: 0.01,
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

export function validateCandidate2CStepConfiguration(
  configuration: Candidate2CStepConfiguration,
): void {
  assertFinitePositive('facetRadius', configuration.facetRadius);
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
  assertFiniteNonnegative('coreUndercooling', configuration.coreUndercooling);
  assertFiniteNonnegative('rimUndercooling', configuration.rimUndercooling);
  if (
    configuration.coreUndercooling === 0 &&
    configuration.rimUndercooling === 0
  ) {
    throw new RangeError('At least one undercooling must be positive.');
  }
  assertFinitePositive(
    'latentHeatPerVolume',
    configuration.latentHeatPerVolume,
  );
  assertFinitePositive('timeStep', configuration.timeStep);
}

export function candidate2CNucleationVelocity(
  undercooling: number,
  nucleationPrefactor: number,
  nucleationBarrier: number,
): number {
  assertFiniteNonnegative('undercooling', undercooling);
  assertFiniteNonnegative('nucleationPrefactor', nucleationPrefactor);
  assertFiniteNonnegative('nucleationBarrier', nucleationBarrier);
  if (undercooling === 0 || nucleationPrefactor === 0) return 0;
  return (
    nucleationPrefactor *
    undercooling *
    Math.exp(-nucleationBarrier / undercooling)
  );
}

export function candidate2CLayerBirthRate(
  configuration: Candidate2CStepConfiguration,
): number {
  return (
    candidate2CNucleationVelocity(
      configuration.rimUndercooling,
      configuration.nucleationPrefactor,
      configuration.nucleationBarrier,
    ) / configuration.stepHeight
  );
}

function geometryVolume(
  configuration: Candidate2CStepConfiguration,
  completedLayers: number,
  activeStepRadii: readonly number[],
): number {
  const { facetRadius, stepHeight } = configuration;
  const layerVolume = Math.PI * stepHeight * facetRadius ** 2;
  return (
    completedLayers * layerVolume +
    activeStepRadii.reduce(
      (sum, radius) =>
        sum + Math.PI * stepHeight * (facetRadius ** 2 - radius ** 2),
      0,
    )
  );
}

export function candidate2CGeometryVolume(state: Candidate2CStepState): number {
  return geometryVolume(
    state.configuration,
    state.completedLayers,
    state.activeStepRadii,
  );
}

export function createCandidate2CStepState(
  configuration: Candidate2CStepConfiguration,
  initialization: Candidate2CStepInitialization = {},
): Candidate2CStepState {
  validateCandidate2CStepConfiguration(configuration);
  const activeStepRadii = [...(initialization.activeStepRadii ?? [])];
  for (const radius of activeStepRadii) {
    if (
      !Number.isFinite(radius) ||
      radius <= 0 ||
      radius > configuration.facetRadius
    ) {
      throw new RangeError(
        'Initial active step radii must lie in (0, facetRadius].',
      );
    }
  }
  const completedLayers = initialization.completedLayers ?? 0;
  if (!Number.isInteger(completedLayers) || completedLayers < 0) {
    throw new RangeError('completedLayers must be a nonnegative integer.');
  }
  const nucleationAccumulator = initialization.nucleationAccumulator ?? 0;
  if (
    !Number.isFinite(nucleationAccumulator) ||
    nucleationAccumulator < 0 ||
    nucleationAccumulator >= 1
  ) {
    throw new RangeError('nucleationAccumulator must lie in [0, 1).');
  }
  activeStepRadii.sort((left, right) => left - right);
  const initialVolume = geometryVolume(
    configuration,
    completedLayers,
    activeStepRadii,
  );
  return {
    configuration,
    time: 0,
    step: 0,
    activeStepRadii,
    completedLayers,
    nucleationAccumulator,
    emittedLayers: completedLayers + activeStepRadii.length,
    integratedSolidVolume: initialVolume,
    releasedLatentHeat: initialVolume * configuration.latentHeatPerVolume,
  };
}

function advanceRadius(
  radius: number,
  duration: number,
  configuration: Candidate2CStepConfiguration,
): number {
  if (!(duration > 0)) return radius;
  const {
    facetRadius,
    stepKineticCoefficient,
    coreUndercooling,
    rimUndercooling,
  } = configuration;
  const difference = rimUndercooling - coreUndercooling;
  if (Math.abs(difference) < 1e-14) {
    return Math.max(
      0,
      radius - stepKineticCoefficient * coreUndercooling * duration,
    );
  }
  const rate = (stepKineticCoefficient * difference) / facetRadius;
  const offset = (coreUndercooling * facetRadius) / difference;
  return Math.max(0, (radius + offset) * Math.exp(-rate * duration) - offset);
}

interface MovedSteps {
  readonly radii: number[];
  readonly completed: number;
  readonly sweptVolume: number;
}

function moveSteps(
  radii: readonly number[],
  duration: number,
  configuration: Candidate2CStepConfiguration,
): MovedSteps {
  const moved: number[] = [];
  let completed = 0;
  let sweptVolume = 0;
  for (const radius of radii) {
    const nextRadius = advanceRadius(radius, duration, configuration);
    sweptVolume +=
      Math.PI * configuration.stepHeight * (radius ** 2 - nextRadius ** 2);
    if (nextRadius === 0) completed += 1;
    else moved.push(nextRadius);
  }
  return { radii: moved, completed, sweptVolume };
}

export function stepCandidate2CStepState(
  state: Candidate2CStepState,
): Candidate2CStepState {
  const { configuration } = state;
  const duration = configuration.timeStep;
  const existing = moveSteps(state.activeStepRadii, duration, configuration);
  const nextRadii = [...existing.radii];
  let newlyCompleted = existing.completed;
  let sweptVolume = existing.sweptVolume;
  const layerBirthRate = candidate2CLayerBirthRate(configuration);
  const accumulatedLayers =
    state.nucleationAccumulator + layerBirthRate * duration;
  const births = Math.floor(accumulatedLayers);

  if (layerBirthRate > 0) {
    for (let birth = 0; birth < births; birth += 1) {
      const eventTime =
        (1 - state.nucleationAccumulator + birth) / layerBirthRate;
      const moved = moveSteps(
        [configuration.facetRadius],
        duration - eventTime,
        configuration,
      );
      nextRadii.push(...moved.radii);
      newlyCompleted += moved.completed;
      sweptVolume += moved.sweptVolume;
    }
  }

  nextRadii.sort((left, right) => left - right);
  const completedLayers = state.completedLayers + newlyCompleted;
  const integratedSolidVolume = state.integratedSolidVolume + sweptVolume;
  return {
    configuration,
    time: state.time + duration,
    step: state.step + 1,
    activeStepRadii: nextRadii,
    completedLayers,
    nucleationAccumulator: accumulatedLayers - births,
    emittedLayers: state.emittedLayers + births,
    integratedSolidVolume,
    releasedLatentHeat:
      state.releasedLatentHeat +
      sweptVolume * configuration.latentHeatPerVolume,
  };
}

export function runCandidate2CStepSteps(
  initial: Candidate2CStepState,
  steps: number,
): Candidate2CStepState {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a nonnegative integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = stepCandidate2CStepState(state);
  }
  return state;
}

export function sampleCandidate2CFacetProfile(
  state: Candidate2CStepState,
  sampleCount: number,
): Candidate2CFacetProfile {
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new RangeError('sampleCount must be an integer >= 2.');
  }
  const radii = new Float64Array(sampleCount);
  const heights = new Float64Array(sampleCount);
  const { facetRadius, stepHeight } = state.configuration;
  for (let index = 0; index < sampleCount; index += 1) {
    const radius = (index * facetRadius) / (sampleCount - 1);
    const activeLayers = state.activeStepRadii.filter(
      (stepRadius) => stepRadius <= radius,
    ).length;
    radii[index] = radius;
    heights[index] = stepHeight * (state.completedLayers + activeLayers);
  }
  const coreHeight = heights[0] ?? Number.NaN;
  const rimHeight = heights[sampleCount - 1] ?? Number.NaN;
  return {
    radii,
    heights,
    coreHeight,
    rimHeight,
    openingDepth: rimHeight - coreHeight,
    activeTerraceCount: state.activeStepRadii.length,
  };
}

/** Midpoint annular quadrature used only for spatial-refinement validation. */
export function candidate2CProfileVolume(
  state: Candidate2CStepState,
  radialCellCount: number,
): number {
  if (!Number.isInteger(radialCellCount) || radialCellCount < 1) {
    throw new RangeError('radialCellCount must be a positive integer.');
  }
  const { facetRadius, stepHeight } = state.configuration;
  const spacing = facetRadius / radialCellCount;
  let volume = 0;
  for (let cell = 0; cell < radialCellCount; cell += 1) {
    const radius = (cell + 0.5) * spacing;
    const activeLayers = state.activeStepRadii.filter(
      (stepRadius) => stepRadius <= radius,
    ).length;
    const height = stepHeight * (state.completedLayers + activeLayers);
    volume += 2 * Math.PI * radius * height * spacing;
  }
  return volume;
}
