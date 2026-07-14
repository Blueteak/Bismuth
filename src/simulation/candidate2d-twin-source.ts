export type Candidate2DTwinVec2 = readonly [number, number];

export interface Candidate2DTwinSourceGeometry {
  /** Local vertex shared by the two faceted-interface rays. */
  readonly interfaceVertex: Candidate2DTwinVec2;
  /** Rays point away from the vertex along the two local interface facets. */
  readonly interfaceRayDirections: readonly [
    Candidate2DTwinVec2,
    Candidate2DTwinVec2,
  ];
  /** A direction from the vertex into the solid selects the solid sector. */
  readonly solidInteriorDirection: Candidate2DTwinVec2;
  /** A twin boundary is present when this local segment is non-null. */
  readonly twinSegment:
    readonly [Candidate2DTwinVec2, Candidate2DTwinVec2] | null;
}

export interface Candidate2DTwinSourceConfiguration {
  readonly geometry: Candidate2DTwinSourceGeometry;
  readonly facetedInterface: boolean;
  /** Out-of-section length of the local twin/facet intersection. */
  readonly sourceLineLength: number;
  /** Distance from the source vertex to the end of the local strip. */
  readonly maximumFrontTravel: number;
  readonly stepHeight: number;
  /** Dimensionless isolation closure, not a measured bismuth coefficient. */
  readonly frontMobility: number;
  readonly latentHeatPerVolume: number;
  readonly effectiveHeatCapacity: number;
  /** Signed local thermal driving: positive means undercooled. */
  readonly initialUndercooling: number;
  readonly timeStep: number;
}

export interface Candidate2DTwinSourceEligibility {
  readonly facetedInterface: boolean;
  readonly twinPresent: boolean;
  readonly twinTerminatesAtInterface: boolean;
  readonly twinLiesInSolid: boolean;
  readonly growthDirectionLiesInLiquid: boolean;
  readonly reentrantInterface: boolean;
  readonly solidInteriorAngleRadians: number;
  readonly sourcePoint: Candidate2DTwinVec2;
  readonly growthDirection: Candidate2DTwinVec2 | null;
  readonly eligible: boolean;
}

export interface Candidate2DTwinSourceEvent {
  readonly id: 'candidate2d-local-twin-step-0';
  readonly ordinal: 0;
  readonly time: number;
  readonly sourcePoint: Candidate2DTwinVec2;
  readonly growthDirection: Candidate2DTwinVec2;
}

export interface Candidate2DTwinFront {
  readonly emittedAt: number;
  readonly completedAt: number | null;
  readonly sourcePoint: Candidate2DTwinVec2;
  readonly growthDirection: Candidate2DTwinVec2;
  readonly distance: number;
  readonly sweptArea: number;
  readonly sweptVolume: number;
  readonly releasedLatentHeat: number;
  readonly complete: boolean;
}

export interface Candidate2DTwinSourceState {
  readonly configuration: Candidate2DTwinSourceConfiguration;
  readonly eligibility: Candidate2DTwinSourceEligibility;
  readonly front: Candidate2DTwinFront | null;
  readonly events: readonly Candidate2DTwinSourceEvent[];
  readonly integratedSweptArea: number;
  readonly integratedSolidVolume: number;
  readonly releasedLatentHeat: number;
  readonly undercooling: number;
  readonly initialColdContent: number;
  readonly cumulativeExternalHeatRemoved: number;
  readonly time: number;
}

export interface Candidate2DTwinSourceLedger {
  readonly expectedVolume: number;
  readonly volumeResidual: number;
  readonly expectedLatentHeat: number;
  readonly latentResidual: number;
  readonly storedColdContent: number;
  readonly expectedColdContent: number;
  readonly coldContentResidual: number;
  readonly scale: number;
  readonly normalizedResidual: number;
}

export interface Candidate2DTwinSourceDiscriminatorResult {
  readonly classification:
    'passes-local-twin-source-isolation' | 'fails-local-twin-source-isolation';
  readonly localSourceIsolationPasses: boolean;
  readonly acceptedAsTargetSource: false;
  readonly acceptedMorphology: false;
  readonly persistentSupplyDemonstrated: false;
  readonly windingTopologyDemonstrated: false;
  readonly nextAction: 'edge-free-surface' | 'repair-local-isolation';
  readonly forward: Candidate2DTwinSourceState;
  readonly noTwin: Candidate2DTwinSourceState;
  readonly nonTerminating: Candidate2DTwinSourceState;
  readonly twinOutsideSolid: Candidate2DTwinSourceState;
  readonly growthNotInLiquid: Candidate2DTwinSourceState;
  readonly nonReentrant: Candidate2DTwinSourceState;
  readonly nonFaceted: Candidate2DTwinSourceState;
  readonly zeroDriving: Candidate2DTwinSourceState;
  readonly reversed: Candidate2DTwinSourceState;
}

const GEOMETRY_EPSILON = 1e-10;
const TWO_PI = 2 * Math.PI;

/**
 * Frozen dimensionless discriminator settings. Wagner and Brown provide the
 * eligibility mechanism, but no bismuth mobility, step size, or rate law.
 */
export const CANDIDATE2D_TWIN_SOURCE_PROOF = Object.freeze({
  configuration: Object.freeze({
    geometry: Object.freeze({
      interfaceVertex: Object.freeze([0, 0] as const),
      interfaceRayDirections: Object.freeze([
        Object.freeze([1, 0] as const),
        Object.freeze([0, 1] as const),
      ] as const),
      solidInteriorDirection: Object.freeze([-1, -1] as const),
      twinSegment: Object.freeze([
        Object.freeze([-1, -1] as const),
        Object.freeze([0, 0] as const),
      ] as const),
    }),
    facetedInterface: true,
    sourceLineLength: 2,
    maximumFrontTravel: 1,
    stepHeight: 0.25,
    frontMobility: 0.5,
    latentHeatPerVolume: 1,
    effectiveHeatCapacity: 10,
    initialUndercooling: 0.4,
    timeStep: 0.125,
  }) satisfies Candidate2DTwinSourceConfiguration,
  evaluationTime: 8,
  expectedSourceEvents: 1,
  maximumNormalizedLedgerResidual: 1e-12,
});

function subtract(
  left: Candidate2DTwinVec2,
  right: Candidate2DTwinVec2,
): Candidate2DTwinVec2 {
  return [left[0] - right[0], left[1] - right[1]];
}

function scale(
  vector: Candidate2DTwinVec2,
  factor: number,
): Candidate2DTwinVec2 {
  return [vector[0] * factor, vector[1] * factor];
}

function magnitude(vector: Candidate2DTwinVec2): number {
  return Math.hypot(vector[0], vector[1]);
}

function normalize(
  name: string,
  vector: Candidate2DTwinVec2,
): Candidate2DTwinVec2 {
  if (!Number.isFinite(vector[0]) || !Number.isFinite(vector[1])) {
    throw new RangeError(`${name} must be finite.`);
  }
  const length = magnitude(vector);
  if (length <= GEOMETRY_EPSILON) {
    throw new RangeError(`${name} must be nonzero.`);
  }
  return [vector[0] / length, vector[1] / length];
}

function distance(
  left: Candidate2DTwinVec2,
  right: Candidate2DTwinVec2,
): number {
  return magnitude(subtract(left, right));
}

function angle(vector: Candidate2DTwinVec2): number {
  const value = Math.atan2(vector[1], vector[0]);
  return value < 0 ? value + TWO_PI : value;
}

function positiveAngle(from: number, to: number): number {
  const value = (to - from) % TWO_PI;
  return value < 0 ? value + TWO_PI : value;
}

function liesStrictlyInCcwSector(
  directionAngle: number,
  startAngle: number,
  span: number,
): boolean {
  const offset = positiveAngle(startAngle, directionAngle);
  return offset > GEOMETRY_EPSILON && offset < span - GEOMETRY_EPSILON;
}

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertPoint(name: string, point: Candidate2DTwinVec2): void {
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function validateConfiguration(
  configuration: Candidate2DTwinSourceConfiguration,
): void {
  assertPoint('interfaceVertex', configuration.geometry.interfaceVertex);
  const firstRay = normalize(
    'interfaceRayDirections[0]',
    configuration.geometry.interfaceRayDirections[0],
  );
  const secondRay = normalize(
    'interfaceRayDirections[1]',
    configuration.geometry.interfaceRayDirections[1],
  );
  const rayCross = firstRay[0] * secondRay[1] - firstRay[1] * secondRay[0];
  if (Math.abs(rayCross) <= GEOMETRY_EPSILON) {
    throw new RangeError(
      'Candidate 2D twin source interface rays must form a facet corner.',
    );
  }
  const solidDirection = normalize(
    'solidInteriorDirection',
    configuration.geometry.solidInteriorDirection,
  );
  const solidOnFirstRay =
    Math.abs(
      firstRay[0] * solidDirection[1] - firstRay[1] * solidDirection[0],
    ) <= GEOMETRY_EPSILON;
  const solidOnSecondRay =
    Math.abs(
      secondRay[0] * solidDirection[1] - secondRay[1] * solidDirection[0],
    ) <= GEOMETRY_EPSILON;
  if (solidOnFirstRay || solidOnSecondRay) {
    throw new RangeError(
      'Candidate 2D solid-interior direction cannot lie on an interface ray.',
    );
  }
  const twinSegment = configuration.geometry.twinSegment;
  if (twinSegment !== null) {
    assertPoint('twinSegment[0]', twinSegment[0]);
    assertPoint('twinSegment[1]', twinSegment[1]);
    if (distance(twinSegment[0], twinSegment[1]) <= GEOMETRY_EPSILON) {
      throw new RangeError('Candidate 2D twin segment must be nondegenerate.');
    }
  }
  assertFinitePositive('sourceLineLength', configuration.sourceLineLength);
  assertFinitePositive('maximumFrontTravel', configuration.maximumFrontTravel);
  assertFinitePositive('stepHeight', configuration.stepHeight);
  assertFinitePositive('frontMobility', configuration.frontMobility);
  assertFinitePositive(
    'latentHeatPerVolume',
    configuration.latentHeatPerVolume,
  );
  assertFinitePositive(
    'effectiveHeatCapacity',
    configuration.effectiveHeatCapacity,
  );
  assertFinite('initialUndercooling', configuration.initialUndercooling);
  assertFinitePositive('timeStep', configuration.timeStep);
}

export function candidate2DTwinSourceEligibility(
  configuration: Candidate2DTwinSourceConfiguration,
): Candidate2DTwinSourceEligibility {
  validateConfiguration(configuration);
  const { geometry } = configuration;
  const firstRay = normalize(
    'interfaceRayDirections[0]',
    geometry.interfaceRayDirections[0],
  );
  const secondRay = normalize(
    'interfaceRayDirections[1]',
    geometry.interfaceRayDirections[1],
  );
  const solidDirection = normalize(
    'solidInteriorDirection',
    geometry.solidInteriorDirection,
  );
  const firstAngle = angle(firstRay);
  const ccwFacetSpan = positiveAngle(firstAngle, angle(secondRay));
  const solidUsesCcwSector = liesStrictlyInCcwSector(
    angle(solidDirection),
    firstAngle,
    ccwFacetSpan,
  );
  const solidInteriorAngleRadians = solidUsesCcwSector
    ? ccwFacetSpan
    : TWO_PI - ccwFacetSpan;
  const reentrantInterface =
    solidInteriorAngleRadians > Math.PI + GEOMETRY_EPSILON;

  const twinSegment = geometry.twinSegment;
  const twinPresent = twinSegment !== null;
  let twinTerminatesAtInterface = false;
  let twinLiesInSolid = false;
  let growthDirectionLiesInLiquid = false;
  let growthDirection: Candidate2DTwinVec2 | null = null;
  if (twinSegment !== null) {
    const firstAtVertex =
      distance(twinSegment[0], geometry.interfaceVertex) <= GEOMETRY_EPSILON;
    const secondAtVertex =
      distance(twinSegment[1], geometry.interfaceVertex) <= GEOMETRY_EPSILON;
    twinTerminatesAtInterface = firstAtVertex !== secondAtVertex;
    if (twinTerminatesAtInterface) {
      const interiorEndpoint = firstAtVertex ? twinSegment[1] : twinSegment[0];
      const inwardDirection = normalize(
        'twin inward direction',
        subtract(interiorEndpoint, geometry.interfaceVertex),
      );
      const inwardInCcwSector = liesStrictlyInCcwSector(
        angle(inwardDirection),
        firstAngle,
        ccwFacetSpan,
      );
      const inwardInOppositeSector = liesStrictlyInCcwSector(
        angle(inwardDirection),
        angle(secondRay),
        TWO_PI - ccwFacetSpan,
      );
      twinLiesInSolid = solidUsesCcwSector
        ? inwardInCcwSector
        : inwardInOppositeSector;
      growthDirection = scale(inwardDirection, -1);
      const growthInCcwSector = liesStrictlyInCcwSector(
        angle(growthDirection),
        firstAngle,
        ccwFacetSpan,
      );
      const growthInOppositeSector = liesStrictlyInCcwSector(
        angle(growthDirection),
        angle(secondRay),
        TWO_PI - ccwFacetSpan,
      );
      growthDirectionLiesInLiquid = solidUsesCcwSector
        ? growthInOppositeSector
        : growthInCcwSector;
    }
  }
  const eligible =
    configuration.facetedInterface &&
    twinPresent &&
    twinTerminatesAtInterface &&
    twinLiesInSolid &&
    growthDirectionLiesInLiquid &&
    reentrantInterface;
  return {
    facetedInterface: configuration.facetedInterface,
    twinPresent,
    twinTerminatesAtInterface,
    twinLiesInSolid,
    growthDirectionLiesInLiquid,
    reentrantInterface,
    solidInteriorAngleRadians,
    sourcePoint: geometry.interfaceVertex,
    growthDirection,
    eligible,
  };
}

function createFront(
  state: Candidate2DTwinSourceState,
): Candidate2DTwinSourceState {
  const growthDirection = state.eligibility.growthDirection;
  if (
    !state.eligibility.eligible ||
    growthDirection === null ||
    state.events.length > 0
  ) {
    return state;
  }
  const event: Candidate2DTwinSourceEvent = {
    id: 'candidate2d-local-twin-step-0',
    ordinal: 0,
    time: state.time,
    sourcePoint: state.eligibility.sourcePoint,
    growthDirection,
  };
  return {
    ...state,
    front: {
      emittedAt: state.time,
      completedAt: null,
      sourcePoint: state.eligibility.sourcePoint,
      growthDirection,
      distance: 0,
      sweptArea: 0,
      sweptVolume: 0,
      releasedLatentHeat: 0,
      complete: false,
    },
    events: [event],
  };
}

export function createCandidate2DTwinSourceState(
  configuration: Candidate2DTwinSourceConfiguration,
): Candidate2DTwinSourceState {
  const eligibility = candidate2DTwinSourceEligibility(configuration);
  const initial: Candidate2DTwinSourceState = {
    configuration,
    eligibility,
    front: null,
    events: [],
    integratedSweptArea: 0,
    integratedSolidVolume: 0,
    releasedLatentHeat: 0,
    undercooling: configuration.initialUndercooling,
    initialColdContent:
      configuration.effectiveHeatCapacity * configuration.initialUndercooling,
    cumulativeExternalHeatRemoved: 0,
    time: 0,
  };
  return configuration.initialUndercooling > 0 ? createFront(initial) : initial;
}

function activeTravel(
  undercooling: number,
  duration: number,
  configuration: Candidate2DTwinSourceConfiguration,
): number {
  const latentPerDistance =
    configuration.latentHeatPerVolume *
    configuration.stepHeight *
    configuration.sourceLineLength;
  const alpha =
    (latentPerDistance * configuration.frontMobility) /
    configuration.effectiveHeatCapacity;
  const oneMinusExponential = -Math.expm1(-alpha * duration);
  return (
    (configuration.effectiveHeatCapacity * undercooling * oneMinusExponential) /
    latentPerDistance
  );
}

function solveTravelTime(
  undercooling: number,
  targetDistance: number,
  configuration: Candidate2DTwinSourceConfiguration,
): number {
  const latentPerDistance =
    configuration.latentHeatPerVolume *
    configuration.stepHeight *
    configuration.sourceLineLength;
  const alpha =
    (latentPerDistance * configuration.frontMobility) /
    configuration.effectiveHeatCapacity;
  const remainingFraction =
    1 -
    (latentPerDistance * targetDistance) /
      (configuration.effectiveHeatCapacity * undercooling);
  if (!(remainingFraction > 0)) {
    return Number.POSITIVE_INFINITY;
  }
  return -Math.log(remainingFraction) / alpha;
}

export function advanceCandidate2DTwinSourceState(
  state: Candidate2DTwinSourceState,
  duration: number,
): Candidate2DTwinSourceState {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(
      'Candidate 2D twin source duration must be finite and nonnegative.',
    );
  }
  if (duration === 0) return state;

  const { configuration } = state;
  const heatCapacity = configuration.effectiveHeatCapacity;
  const current =
    state.front === null && state.undercooling > 0 ? createFront(state) : state;
  const front = current.front;
  if (front === null || front.complete || current.undercooling <= 0) {
    return {
      ...current,
      time: state.time + duration,
    };
  }

  const travelRemaining = configuration.maximumFrontTravel - front.distance;
  const possibleTravel = activeTravel(
    current.undercooling,
    duration,
    configuration,
  );
  const completes = possibleTravel >= travelRemaining;
  const interval = completes
    ? solveTravelTime(current.undercooling, travelRemaining, configuration)
    : duration;
  const distanceAdvanced = completes ? travelRemaining : possibleTravel;
  const sweptArea = configuration.sourceLineLength * distanceAdvanced;
  const sweptVolume = configuration.stepHeight * sweptArea;
  const latentHeat = configuration.latentHeatPerVolume * sweptVolume;
  const nextFront: Candidate2DTwinFront = {
    ...front,
    completedAt: completes ? current.time + interval : front.completedAt,
    distance: completes
      ? configuration.maximumFrontTravel
      : front.distance + distanceAdvanced,
    sweptArea: front.sweptArea + sweptArea,
    sweptVolume: front.sweptVolume + sweptVolume,
    releasedLatentHeat: front.releasedLatentHeat + latentHeat,
    complete: completes,
  };
  return {
    ...current,
    front: nextFront,
    integratedSweptArea: current.integratedSweptArea + sweptArea,
    integratedSolidVolume: current.integratedSolidVolume + sweptVolume,
    releasedLatentHeat: current.releasedLatentHeat + latentHeat,
    undercooling:
      (heatCapacity * current.undercooling - latentHeat) / heatCapacity,
    time: state.time + duration,
  };
}

export function applyCandidate2DTwinSourceHeatRemoval(
  state: Candidate2DTwinSourceState,
  heatRemoved: number,
): Candidate2DTwinSourceState {
  assertFinite('heatRemoved', heatRemoved);
  const next: Candidate2DTwinSourceState = {
    ...state,
    undercooling:
      state.undercooling +
      heatRemoved / state.configuration.effectiveHeatCapacity,
    cumulativeExternalHeatRemoved:
      state.cumulativeExternalHeatRemoved + heatRemoved,
  };
  return next.undercooling > 0 ? createFront(next) : next;
}

export function runCandidate2DTwinSourceSteps(
  initial: Candidate2DTwinSourceState,
  steps: number,
): Candidate2DTwinSourceState {
  if (!Number.isSafeInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a nonnegative safe integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = advanceCandidate2DTwinSourceState(
      state,
      state.configuration.timeStep,
    );
  }
  return state;
}

export function candidate2DTwinSourceLedger(
  state: Candidate2DTwinSourceState,
): Candidate2DTwinSourceLedger {
  const expectedVolume =
    state.configuration.stepHeight * state.integratedSweptArea;
  const volumeResidual = state.integratedSolidVolume - expectedVolume;
  const expectedLatentHeat =
    state.configuration.latentHeatPerVolume * state.integratedSolidVolume;
  const latentResidual = state.releasedLatentHeat - expectedLatentHeat;
  const storedColdContent =
    state.configuration.effectiveHeatCapacity * state.undercooling;
  const expectedColdContent =
    state.initialColdContent +
    state.cumulativeExternalHeatRemoved -
    state.releasedLatentHeat;
  const coldContentResidual = storedColdContent - expectedColdContent;
  const scaleValue = Math.max(
    1,
    Math.abs(state.integratedSolidVolume),
    Math.abs(expectedVolume),
    Math.abs(state.releasedLatentHeat),
    Math.abs(expectedLatentHeat),
    Math.abs(storedColdContent),
    Math.abs(expectedColdContent),
  );
  return {
    expectedVolume,
    volumeResidual,
    expectedLatentHeat,
    latentResidual,
    storedColdContent,
    expectedColdContent,
    coldContentResidual,
    scale: scaleValue,
    normalizedResidual:
      Math.max(
        Math.abs(volumeResidual),
        Math.abs(latentResidual),
        Math.abs(coldContentResidual),
      ) / scaleValue,
  };
}

function runProofArm(
  configuration: Candidate2DTwinSourceConfiguration,
): Candidate2DTwinSourceState {
  const steps =
    CANDIDATE2D_TWIN_SOURCE_PROOF.evaluationTime / configuration.timeStep;
  if (!Number.isSafeInteger(steps)) {
    throw new RangeError(
      'Candidate 2D twin source proof duration must divide into whole steps.',
    );
  }
  return runCandidate2DTwinSourceSteps(
    createCandidate2DTwinSourceState(configuration),
    steps,
  );
}

export function runCandidate2DTwinSourceDiscriminator(): Candidate2DTwinSourceDiscriminatorResult {
  const configuration = CANDIDATE2D_TWIN_SOURCE_PROOF.configuration;
  const geometry = configuration.geometry;
  const forward = runProofArm(configuration);
  const noTwin = runProofArm({
    ...configuration,
    geometry: { ...geometry, twinSegment: null },
  });
  const nonTerminating = runProofArm({
    ...configuration,
    geometry: {
      ...geometry,
      twinSegment: [
        [-2, -2],
        [-1, -1],
      ],
    },
  });
  const twinOutsideSolid = runProofArm({
    ...configuration,
    geometry: {
      ...geometry,
      twinSegment: [
        [1, 1],
        [0, 0],
      ],
    },
  });
  const growthNotInLiquid = runProofArm({
    ...configuration,
    geometry: {
      ...geometry,
      twinSegment: [
        [-1, 1],
        [0, 0],
      ],
    },
  });
  const nonReentrant = runProofArm({
    ...configuration,
    geometry: {
      ...geometry,
      solidInteriorDirection: [1, 1],
      twinSegment: [
        [1, 1],
        [0, 0],
      ],
    },
  });
  const nonFaceted = runProofArm({
    ...configuration,
    facetedInterface: false,
  });
  const zeroDriving = runProofArm({
    ...configuration,
    initialUndercooling: 0,
  });
  const reversed = runProofArm({
    ...configuration,
    initialUndercooling: -configuration.initialUndercooling,
  });
  const inactiveArms = [
    noTwin,
    nonTerminating,
    twinOutsideSolid,
    growthNotInLiquid,
    nonReentrant,
    nonFaceted,
    zeroDriving,
    reversed,
  ];
  const localSourceIsolationPasses =
    forward.events.length ===
      CANDIDATE2D_TWIN_SOURCE_PROOF.expectedSourceEvents &&
    forward.front?.complete === true &&
    inactiveArms.every(
      (arm) =>
        arm.events.length === 0 &&
        arm.integratedSweptArea === 0 &&
        arm.integratedSolidVolume === 0,
    ) &&
    [forward, ...inactiveArms].every(
      (arm) =>
        candidate2DTwinSourceLedger(arm).normalizedResidual <=
        CANDIDATE2D_TWIN_SOURCE_PROOF.maximumNormalizedLedgerResidual,
    );
  return {
    classification: localSourceIsolationPasses
      ? 'passes-local-twin-source-isolation'
      : 'fails-local-twin-source-isolation',
    localSourceIsolationPasses,
    acceptedAsTargetSource: false,
    acceptedMorphology: false,
    persistentSupplyDemonstrated: false,
    windingTopologyDemonstrated: false,
    nextAction: localSourceIsolationPasses
      ? 'edge-free-surface'
      : 'repair-local-isolation',
    forward,
    noTwin,
    nonTerminating,
    twinOutsideSolid,
    growthNotInLiquid,
    nonReentrant,
    nonFaceted,
    zeroDriving,
    reversed,
  };
}
