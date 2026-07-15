export type Candidate2DEdgeVec2 = readonly [number, number];

export interface Candidate2DEdgeSourceGeometry {
  readonly freeSurfaceOrigin: Candidate2DEdgeVec2;
  readonly freeSurfaceTangent: Candidate2DEdgeVec2;
  /** Points from the free surface into the melt. */
  readonly liquidInteriorDirection: Candidate2DEdgeVec2;
  readonly contactPoint: Candidate2DEdgeVec2;
  /** Existing heterogeneous seed; exactly one endpoint must be the contact. */
  readonly seedSegment:
    readonly [Candidate2DEdgeVec2, Candidate2DEdgeVec2] | null;
}

export interface Candidate2DEdgeSourceConfiguration {
  readonly geometry: Candidate2DEdgeSourceGeometry;
  /** Out-of-section length of the local three-phase contact line. */
  readonly contactLineLength: number;
  /** Local observational front thickness; not a target ledge height. */
  readonly frontThickness: number;
  readonly maximumFrontTravel: number;
  readonly latentHeatPerVolume: number;
  /** Signed heat removal assigned to this local Stefan front. */
  readonly initialHeatRemovalRate: number;
  readonly timeStep: number;
}

export interface Candidate2DEdgeSourceEligibility {
  readonly seedPresent: boolean;
  readonly contactOnFreeSurface: boolean;
  readonly seedTerminatesAtContact: boolean;
  readonly seedApproachesFromNonLiquid: boolean;
  readonly growthDirectionIntoLiquid: boolean;
  readonly realThreePhaseContact: boolean;
  readonly sourcePoint: Candidate2DEdgeVec2;
  readonly growthDirection: Candidate2DEdgeVec2 | null;
  readonly eligible: boolean;
}

export interface Candidate2DEdgeSourceEvent {
  readonly id: 'candidate2d-edge-front-0';
  readonly ordinal: 0;
  readonly time: number;
  readonly sourcePoint: Candidate2DEdgeVec2;
  readonly growthDirection: Candidate2DEdgeVec2;
}

export interface Candidate2DEdgeFront {
  readonly emittedAt: number;
  readonly completedAt: number | null;
  readonly sourcePoint: Candidate2DEdgeVec2;
  readonly growthDirection: Candidate2DEdgeVec2;
  readonly distance: number;
  readonly sweptArea: number;
  readonly sweptVolume: number;
  readonly releasedLatentHeat: number;
  readonly complete: boolean;
}

export interface Candidate2DEdgeSourceState {
  readonly configuration: Candidate2DEdgeSourceConfiguration;
  readonly eligibility: Candidate2DEdgeSourceEligibility;
  readonly front: Candidate2DEdgeFront | null;
  readonly events: readonly Candidate2DEdgeSourceEvent[];
  readonly heatRemovalRate: number;
  readonly integratedSweptArea: number;
  readonly integratedSolidVolume: number;
  readonly releasedLatentHeat: number;
  readonly cumulativeStefanHeatRemoved: number;
  readonly time: number;
}

export interface Candidate2DEdgeSourceLedger {
  readonly expectedArea: number;
  readonly areaResidual: number;
  readonly expectedVolume: number;
  readonly volumeResidual: number;
  readonly expectedLatentHeat: number;
  readonly latentResidual: number;
  readonly stefanResidual: number;
  readonly scale: number;
  readonly normalizedResidual: number;
}

export interface Candidate2DEdgeSourceDiscriminatorResult {
  readonly classification:
    'passes-one-edge-front-isolation' | 'fails-one-edge-front-isolation';
  readonly localSourceIsolationPasses: boolean;
  readonly acceptedAsTargetSource: false;
  readonly acceptedMorphology: false;
  readonly persistentSupplyDemonstrated: false;
  readonly routeSelectionDemonstrated: false;
  readonly nextAction: 'strategy-review' | 'repair-edge-isolation';
  readonly forward: Candidate2DEdgeSourceState;
  readonly noSeed: Candidate2DEdgeSourceState;
  readonly nonTerminatingSeed: Candidate2DEdgeSourceState;
  readonly contactOffSurface: Candidate2DEdgeSourceState;
  readonly seedInLiquid: Candidate2DEdgeSourceState;
  readonly zeroDriving: Candidate2DEdgeSourceState;
  readonly reversed: Candidate2DEdgeSourceState;
}

const GEOMETRY_EPSILON = 1e-10;

/**
 * Frozen dimensionless isolation. Steger and Price establish wire-seeded
 * downward growth from the upper melt surface, not a Bi rate. The front speed
 * therefore comes only from the declared local Stefan heat balance.
 */
export const CANDIDATE2D_EDGE_SOURCE_PROOF = Object.freeze({
  configuration: Object.freeze({
    geometry: Object.freeze({
      freeSurfaceOrigin: Object.freeze([0, 0] as const),
      freeSurfaceTangent: Object.freeze([1, 0] as const),
      liquidInteriorDirection: Object.freeze([0, -1] as const),
      contactPoint: Object.freeze([0, 0] as const),
      seedSegment: Object.freeze([
        Object.freeze([0, 1] as const),
        Object.freeze([0, 0] as const),
      ] as const),
    }),
    contactLineLength: 1.6,
    frontThickness: 0.25,
    maximumFrontTravel: 1.2,
    latentHeatPerVolume: 2,
    initialHeatRemovalRate: 0.12,
    timeStep: 0.125,
  }) satisfies Candidate2DEdgeSourceConfiguration,
  evaluationTime: 9,
  expectedSourceEvents: 1,
  maximumNormalizedLedgerResidual: 1e-12,
});

function subtract(
  left: Candidate2DEdgeVec2,
  right: Candidate2DEdgeVec2,
): Candidate2DEdgeVec2 {
  return [left[0] - right[0], left[1] - right[1]];
}

function scale(
  vector: Candidate2DEdgeVec2,
  factor: number,
): Candidate2DEdgeVec2 {
  const x = vector[0] * factor;
  const y = vector[1] * factor;
  return [Object.is(x, -0) ? 0 : x, Object.is(y, -0) ? 0 : y];
}

function dot(left: Candidate2DEdgeVec2, right: Candidate2DEdgeVec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function cross(left: Candidate2DEdgeVec2, right: Candidate2DEdgeVec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function magnitude(vector: Candidate2DEdgeVec2): number {
  return Math.hypot(vector[0], vector[1]);
}

function distance(
  left: Candidate2DEdgeVec2,
  right: Candidate2DEdgeVec2,
): number {
  return magnitude(subtract(left, right));
}

function normalize(
  name: string,
  vector: Candidate2DEdgeVec2,
): Candidate2DEdgeVec2 {
  assertPoint(name, vector);
  const length = magnitude(vector);
  if (length <= GEOMETRY_EPSILON) {
    throw new RangeError(`${name} must be nonzero.`);
  }
  return [vector[0] / length, vector[1] / length];
}

function assertPoint(name: string, point: Candidate2DEdgeVec2): void {
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function validateConfiguration(
  configuration: Candidate2DEdgeSourceConfiguration,
): void {
  const { geometry } = configuration;
  assertPoint('freeSurfaceOrigin', geometry.freeSurfaceOrigin);
  assertPoint('contactPoint', geometry.contactPoint);
  const surfaceTangent = normalize(
    'freeSurfaceTangent',
    geometry.freeSurfaceTangent,
  );
  const liquidDirection = normalize(
    'liquidInteriorDirection',
    geometry.liquidInteriorDirection,
  );
  if (Math.abs(cross(surfaceTangent, liquidDirection)) <= GEOMETRY_EPSILON) {
    throw new RangeError(
      'Candidate 2D edge source liquid direction cannot lie on the free surface.',
    );
  }
  if (geometry.seedSegment !== null) {
    assertPoint('seedSegment[0]', geometry.seedSegment[0]);
    assertPoint('seedSegment[1]', geometry.seedSegment[1]);
    if (
      distance(geometry.seedSegment[0], geometry.seedSegment[1]) <=
      GEOMETRY_EPSILON
    ) {
      throw new RangeError('Candidate 2D edge seed must be nondegenerate.');
    }
  }
  assertFinitePositive('contactLineLength', configuration.contactLineLength);
  assertFinitePositive('frontThickness', configuration.frontThickness);
  assertFinitePositive('maximumFrontTravel', configuration.maximumFrontTravel);
  assertFinitePositive(
    'latentHeatPerVolume',
    configuration.latentHeatPerVolume,
  );
  assertFinite('initialHeatRemovalRate', configuration.initialHeatRemovalRate);
  assertFinitePositive('timeStep', configuration.timeStep);
}

export function candidate2DEdgeSourceEligibility(
  configuration: Candidate2DEdgeSourceConfiguration,
): Candidate2DEdgeSourceEligibility {
  validateConfiguration(configuration);
  const { geometry } = configuration;
  const surfaceTangent = normalize(
    'freeSurfaceTangent',
    geometry.freeSurfaceTangent,
  );
  const liquidDirection = normalize(
    'liquidInteriorDirection',
    geometry.liquidInteriorDirection,
  );
  const contactOffset = subtract(
    geometry.contactPoint,
    geometry.freeSurfaceOrigin,
  );
  const contactOnFreeSurface =
    Math.abs(cross(surfaceTangent, contactOffset)) <= GEOMETRY_EPSILON;
  const seedSegment = geometry.seedSegment;
  const seedPresent = seedSegment !== null;
  let seedTerminatesAtContact = false;
  let seedApproachesFromNonLiquid = false;
  let growthDirectionIntoLiquid = false;
  let growthDirection: Candidate2DEdgeVec2 | null = null;
  if (seedSegment !== null) {
    const firstAtContact =
      distance(seedSegment[0], geometry.contactPoint) <= GEOMETRY_EPSILON;
    const secondAtContact =
      distance(seedSegment[1], geometry.contactPoint) <= GEOMETRY_EPSILON;
    seedTerminatesAtContact = firstAtContact !== secondAtContact;
    if (seedTerminatesAtContact) {
      const seedEndpoint = firstAtContact ? seedSegment[1] : seedSegment[0];
      const seedDirection = normalize(
        'seed direction',
        subtract(seedEndpoint, geometry.contactPoint),
      );
      seedApproachesFromNonLiquid =
        dot(seedDirection, liquidDirection) < -GEOMETRY_EPSILON;
      growthDirection = scale(seedDirection, -1);
      growthDirectionIntoLiquid =
        dot(growthDirection, liquidDirection) > GEOMETRY_EPSILON;
    }
  }
  const realThreePhaseContact =
    contactOnFreeSurface &&
    seedTerminatesAtContact &&
    seedApproachesFromNonLiquid &&
    growthDirectionIntoLiquid;
  return {
    seedPresent,
    contactOnFreeSurface,
    seedTerminatesAtContact,
    seedApproachesFromNonLiquid,
    growthDirectionIntoLiquid,
    realThreePhaseContact,
    sourcePoint: geometry.contactPoint,
    growthDirection,
    eligible: seedPresent && realThreePhaseContact,
  };
}

function createFront(
  state: Candidate2DEdgeSourceState,
): Candidate2DEdgeSourceState {
  const growthDirection = state.eligibility.growthDirection;
  if (
    !state.eligibility.eligible ||
    growthDirection === null ||
    state.heatRemovalRate <= 0 ||
    state.events.length > 0
  ) {
    return state;
  }
  const event: Candidate2DEdgeSourceEvent = {
    id: 'candidate2d-edge-front-0',
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

export function createCandidate2DEdgeSourceState(
  configuration: Candidate2DEdgeSourceConfiguration,
): Candidate2DEdgeSourceState {
  const initial: Candidate2DEdgeSourceState = {
    configuration,
    eligibility: candidate2DEdgeSourceEligibility(configuration),
    front: null,
    events: [],
    heatRemovalRate: configuration.initialHeatRemovalRate,
    integratedSweptArea: 0,
    integratedSolidVolume: 0,
    releasedLatentHeat: 0,
    cumulativeStefanHeatRemoved: 0,
    time: 0,
  };
  return initial.heatRemovalRate > 0 ? createFront(initial) : initial;
}

function frontArea(configuration: Candidate2DEdgeSourceConfiguration): number {
  return configuration.contactLineLength * configuration.frontThickness;
}

export function advanceCandidate2DEdgeSourceState(
  state: Candidate2DEdgeSourceState,
  duration: number,
): Candidate2DEdgeSourceState {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(
      'Candidate 2D edge source duration must be finite and nonnegative.',
    );
  }
  if (duration === 0) return state;
  const current =
    state.front === null && state.heatRemovalRate > 0
      ? createFront(state)
      : state;
  const front = current.front;
  if (front === null || front.complete || current.heatRemovalRate <= 0) {
    return { ...current, time: state.time + duration };
  }

  const configuration = state.configuration;
  const area = frontArea(configuration);
  const speed =
    current.heatRemovalRate / (configuration.latentHeatPerVolume * area);
  const remaining = configuration.maximumFrontTravel - front.distance;
  const possibleTravel = speed * duration;
  const distanceAdvanced = Math.min(remaining, possibleTravel);
  const activeDuration = distanceAdvanced / speed;
  const sweptArea = configuration.contactLineLength * distanceAdvanced;
  const sweptVolume = area * distanceAdvanced;
  const latentHeat = configuration.latentHeatPerVolume * sweptVolume;
  const completes = distanceAdvanced >= remaining - GEOMETRY_EPSILON;
  const nextFront: Candidate2DEdgeFront = {
    ...front,
    completedAt: completes ? current.time + activeDuration : null,
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
    cumulativeStefanHeatRemoved:
      current.cumulativeStefanHeatRemoved +
      current.heatRemovalRate * activeDuration,
    time: state.time + duration,
  };
}

export function setCandidate2DEdgeSourceHeatRemovalRate(
  state: Candidate2DEdgeSourceState,
  heatRemovalRate: number,
): Candidate2DEdgeSourceState {
  assertFinite('heatRemovalRate', heatRemovalRate);
  const next = { ...state, heatRemovalRate };
  return heatRemovalRate > 0 ? createFront(next) : next;
}

export function runCandidate2DEdgeSourceSteps(
  initial: Candidate2DEdgeSourceState,
  steps: number,
): Candidate2DEdgeSourceState {
  if (!Number.isSafeInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a nonnegative safe integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = advanceCandidate2DEdgeSourceState(
      state,
      state.configuration.timeStep,
    );
  }
  return state;
}

export function candidate2DEdgeSourceLedger(
  state: Candidate2DEdgeSourceState,
): Candidate2DEdgeSourceLedger {
  const distance = state.front?.distance ?? 0;
  const expectedArea = state.configuration.contactLineLength * distance;
  const areaResidual = state.integratedSweptArea - expectedArea;
  const expectedVolume =
    state.configuration.frontThickness * state.integratedSweptArea;
  const volumeResidual = state.integratedSolidVolume - expectedVolume;
  const expectedLatentHeat =
    state.configuration.latentHeatPerVolume * state.integratedSolidVolume;
  const latentResidual = state.releasedLatentHeat - expectedLatentHeat;
  const stefanResidual =
    state.cumulativeStefanHeatRemoved - state.releasedLatentHeat;
  const scaleValue = Math.max(
    1,
    Math.abs(state.integratedSweptArea),
    Math.abs(expectedArea),
    Math.abs(state.integratedSolidVolume),
    Math.abs(expectedVolume),
    Math.abs(state.releasedLatentHeat),
    Math.abs(expectedLatentHeat),
    Math.abs(state.cumulativeStefanHeatRemoved),
  );
  return {
    expectedArea,
    areaResidual,
    expectedVolume,
    volumeResidual,
    expectedLatentHeat,
    latentResidual,
    stefanResidual,
    scale: scaleValue,
    normalizedResidual:
      Math.max(
        Math.abs(areaResidual),
        Math.abs(volumeResidual),
        Math.abs(latentResidual),
        Math.abs(stefanResidual),
      ) / scaleValue,
  };
}

function runProofArm(
  configuration: Candidate2DEdgeSourceConfiguration,
): Candidate2DEdgeSourceState {
  const steps =
    CANDIDATE2D_EDGE_SOURCE_PROOF.evaluationTime / configuration.timeStep;
  if (!Number.isSafeInteger(steps)) {
    throw new RangeError(
      'Candidate 2D edge proof duration must divide into whole steps.',
    );
  }
  return runCandidate2DEdgeSourceSteps(
    createCandidate2DEdgeSourceState(configuration),
    steps,
  );
}

export function runCandidate2DEdgeSourceDiscriminator(): Candidate2DEdgeSourceDiscriminatorResult {
  const configuration = CANDIDATE2D_EDGE_SOURCE_PROOF.configuration;
  const geometry = configuration.geometry;
  const forward = runProofArm(configuration);
  const noSeed = runProofArm({
    ...configuration,
    geometry: { ...geometry, seedSegment: null },
  });
  const nonTerminatingSeed = runProofArm({
    ...configuration,
    geometry: {
      ...geometry,
      seedSegment: [
        [0, 2],
        [0, 1],
      ],
    },
  });
  const contactOffSurface = runProofArm({
    ...configuration,
    geometry: { ...geometry, contactPoint: [0, 0.2] },
  });
  const seedInLiquid = runProofArm({
    ...configuration,
    geometry: {
      ...geometry,
      seedSegment: [
        [0, -1],
        [0, 0],
      ],
    },
  });
  const zeroDriving = runProofArm({
    ...configuration,
    initialHeatRemovalRate: 0,
  });
  const reversed = runProofArm({
    ...configuration,
    initialHeatRemovalRate: -configuration.initialHeatRemovalRate,
  });
  const inactiveArms = [
    noSeed,
    nonTerminatingSeed,
    contactOffSurface,
    seedInLiquid,
    zeroDriving,
    reversed,
  ];
  const localSourceIsolationPasses =
    forward.events.length ===
      CANDIDATE2D_EDGE_SOURCE_PROOF.expectedSourceEvents &&
    forward.front?.complete === true &&
    inactiveArms.every(
      (arm) =>
        arm.events.length === 0 &&
        arm.integratedSweptArea === 0 &&
        arm.integratedSolidVolume === 0,
    ) &&
    [forward, ...inactiveArms].every(
      (arm) =>
        candidate2DEdgeSourceLedger(arm).normalizedResidual <=
        CANDIDATE2D_EDGE_SOURCE_PROOF.maximumNormalizedLedgerResidual,
    );
  return {
    classification: localSourceIsolationPasses
      ? 'passes-one-edge-front-isolation'
      : 'fails-one-edge-front-isolation',
    localSourceIsolationPasses,
    acceptedAsTargetSource: false,
    acceptedMorphology: false,
    persistentSupplyDemonstrated: false,
    routeSelectionDemonstrated: false,
    nextAction: localSourceIsolationPasses
      ? 'strategy-review'
      : 'repair-edge-isolation',
    forward,
    noSeed,
    nonTerminatingSeed,
    contactOffSurface,
    seedInLiquid,
    zeroDriving,
    reversed,
  };
}
