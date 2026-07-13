import {
  advanceCandidate2ATemperature,
  candidate2ADiffuseSolidFraction,
  candidate2AFreeSurfaceHeatFlux,
  candidate2AFreeSurfaceHeatRate,
  createInitialCandidate2AThermalState,
  preRelaxCandidate2ASurfaceSeed,
  type Candidate2AFreeSurfaceBoundary,
  type Candidate2AThermalState,
} from './candidate2a';
import { createCandidate2AMorphologyScreenConfiguration } from './candidate2a-morphology';

const PULSE_STEPS = 100;
const PULSE_CHECKPOINT_STEPS = Object.freeze([20, 50, 100] as const);
const EQUAL_BIOT_NUMBER = (0.25 + 2) / 2;
const AMBIENT_TEMPERATURE = -1.5;
const MAXIMUM_NORMALIZED_ENERGY_RESIDUAL = 5e-5;
const MAXIMUM_EQUAL_CONTRAST = 1e-6;
const MINIMUM_THETA_CONTRAST = 0.01;
const MINIMUM_LOCALIZATION_CONTRAST = 0.005;
const MAXIMUM_EVEN_TO_ODD_RATIO = 0.25;

type PulseArmName = 'equal' | 'forward' | 'reverse';
type PulseRegionName = 'contact' | 'rim' | 'exterior' | 'core';

export type Candidate2AThermalPulseClassification =
  | 'invalid'
  | 'surface-flux-sign-failure'
  | 'contrast-not-rim-localized'
  | 'passes-pulse-only';

export interface Candidate2AThermalPulseSurfaceMasks {
  /** Positive on the h(psi) >= 0.5 solid side of the surface contour. */
  readonly signedDistance: Float64Array;
  readonly contact: Uint8Array;
  readonly rim: Uint8Array;
  readonly exterior: Uint8Array;
  readonly core: Uint8Array;
  readonly counts: Readonly<Record<PulseRegionName, number>>;
}

export interface Candidate2AThermalPulseRegionMeans {
  readonly sampleCount: number;
  readonly temperature: number;
  readonly undercooling: number;
  readonly outwardHeatFlux: number;
}

export interface Candidate2AThermalPulseHeatLedger {
  readonly initialTemperatureSum: number;
  readonly finalTemperatureSum: number;
  readonly actualTemperatureSumChange: number;
  readonly integratedSurfaceHeat: number;
  readonly residual: number;
  readonly scale: number;
  readonly normalizedResidual: number;
}

export interface Candidate2AThermalPulseCheckpoint {
  readonly step: number;
  readonly simulatedTime: number;
  readonly regions: Readonly<
    Record<PulseRegionName, Candidate2AThermalPulseRegionMeans>
  >;
  /** Mean outward surface flux on the solid rim minus the liquid exterior. */
  readonly outwardFluxJump: number;
  /** U_exterior - U_rim; positive means that the solid rim is colder. */
  readonly theta: number;
  /** U_core - U_rim; positive means cooling is localized at the rim. */
  readonly rimLocalization: number;
  readonly heatLedger: Candidate2AThermalPulseHeatLedger;
}

export interface Candidate2AThermalPulseArmResult {
  readonly finalState: Candidate2AThermalState;
  readonly checkpoints: readonly Candidate2AThermalPulseCheckpoint[];
  readonly heatLedger: Candidate2AThermalPulseHeatLedger;
  readonly orderParameterIdentity: boolean;
}

export interface Candidate2AThermalPulseOddEven {
  readonly equal: number;
  readonly forward: number;
  readonly reverse: number;
  readonly odd: number;
  readonly even: number;
}

export interface Candidate2AThermalPulseComparison {
  readonly step: number;
  readonly simulatedTime: number;
  readonly outwardFluxJump: Candidate2AThermalPulseOddEven;
  readonly theta: Candidate2AThermalPulseOddEven;
  readonly rimLocalization: Candidate2AThermalPulseOddEven;
}

export interface Candidate2AThermalPulseGates {
  readonly preRelaxationConverged: boolean;
  readonly masksResolved: boolean;
  readonly finite: boolean;
  readonly frozenOrderParameter: boolean;
  readonly heatLedgersClose: boolean;
  readonly equalCaseNull: boolean;
  readonly signPass: boolean;
  readonly localizationPass: boolean;
}

export interface Candidate2AThermalPulseResult {
  readonly classification: Candidate2AThermalPulseClassification;
  readonly seed: Candidate2AThermalState;
  readonly preRelaxation: {
    readonly iterations: number;
    readonly converged: boolean;
    readonly maximumRate: number;
    readonly energyDecrease: number;
    readonly relativeVolumeDrift: number;
  };
  readonly masks: Candidate2AThermalPulseSurfaceMasks;
  readonly arms: Readonly<
    Record<PulseArmName, Candidate2AThermalPulseArmResult>
  >;
  readonly comparisons: readonly Candidate2AThermalPulseComparison[];
  readonly gates: Candidate2AThermalPulseGates;
}

interface Point2 {
  readonly x: number;
  readonly z: number;
}

interface Segment2 {
  readonly start: Point2;
  readonly end: Point2;
}

function surfaceIndex(x: number, z: number, width: number): number {
  return x + width * z;
}

function volumeIndex(
  x: number,
  y: number,
  z: number,
  shape: readonly [number, number, number],
): number {
  return x + shape[0] * (y + shape[1] * z);
}

function clampedSolidFraction(orderParameter: number): number {
  return Math.max(
    0,
    Math.min(1, candidate2ADiffuseSolidFraction(orderParameter)),
  );
}

function contourIntersection(
  start: Point2,
  startValue: number,
  end: Point2,
  endValue: number,
): Point2 | null {
  const startOffset = startValue - 0.5;
  const endOffset = endValue - 0.5;
  if (
    (startOffset < 0 && endOffset < 0) ||
    (startOffset > 0 && endOffset > 0) ||
    startOffset === endOffset
  ) {
    return null;
  }
  const fraction = startOffset / (startOffset - endOffset);
  return {
    x: start.x + fraction * (end.x - start.x),
    z: start.z + fraction * (end.z - start.z),
  };
}

function uniquePoints(points: readonly Point2[]): Point2[] {
  const unique: Point2[] = [];
  for (const point of points) {
    if (
      unique.some(
        (candidate) =>
          Math.abs(candidate.x - point.x) < 1e-12 &&
          Math.abs(candidate.z - point.z) < 1e-12,
      )
    ) {
      continue;
    }
    unique.push(point);
  }
  return unique;
}

function surfaceContourSegments(
  surfaceSolidFraction: Float64Array,
  width: number,
  depth: number,
  spacing: number,
): Segment2[] {
  const segments: Segment2[] = [];
  for (let z = 0; z < depth - 1; z += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const lowerLeft = { x: x * spacing, z: z * spacing };
      const lowerRight = { x: (x + 1) * spacing, z: z * spacing };
      const upperRight = {
        x: (x + 1) * spacing,
        z: (z + 1) * spacing,
      };
      const upperLeft = { x: x * spacing, z: (z + 1) * spacing };
      const lowerLeftValue =
        surfaceSolidFraction[surfaceIndex(x, z, width)] ?? Number.NaN;
      const lowerRightValue =
        surfaceSolidFraction[surfaceIndex(x + 1, z, width)] ?? Number.NaN;
      const upperRightValue =
        surfaceSolidFraction[surfaceIndex(x + 1, z + 1, width)] ?? Number.NaN;
      const upperLeftValue =
        surfaceSolidFraction[surfaceIndex(x, z + 1, width)] ?? Number.NaN;
      const intersections = uniquePoints(
        [
          contourIntersection(
            lowerLeft,
            lowerLeftValue,
            lowerRight,
            lowerRightValue,
          ),
          contourIntersection(
            lowerRight,
            lowerRightValue,
            upperRight,
            upperRightValue,
          ),
          contourIntersection(
            upperRight,
            upperRightValue,
            upperLeft,
            upperLeftValue,
          ),
          contourIntersection(
            upperLeft,
            upperLeftValue,
            lowerLeft,
            lowerLeftValue,
          ),
        ].filter((point): point is Point2 => point !== null),
      );
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        segments.push({
          start: intersections[index]!,
          end: intersections[index + 1]!,
        });
      }
    }
  }
  return segments;
}

function distanceToSegment(point: Point2, segment: Segment2): number {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const squaredLength = dx * dx + dz * dz;
  if (squaredLength === 0) {
    return Math.hypot(point.x - segment.start.x, point.z - segment.start.z);
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segment.start.x) * dx + (point.z - segment.start.z) * dz) /
        squaredLength,
    ),
  );
  return Math.hypot(
    point.x - (segment.start.x + projection * dx),
    point.z - (segment.start.z + projection * dz),
  );
}

function createSurfaceMasks(
  seed: Candidate2AThermalState,
): Candidate2AThermalPulseSurfaceMasks {
  const [width, , depth] = seed.config.shape;
  const surfaceSolidFraction = new Float64Array(width * depth);
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      surfaceSolidFraction[surfaceIndex(x, z, width)] = clampedSolidFraction(
        seed.orderParameter[volumeIndex(x, 0, z, seed.config.shape)] ??
          Number.NaN,
      );
    }
  }
  const segments = surfaceContourSegments(
    surfaceSolidFraction,
    width,
    depth,
    seed.config.spacing,
  );
  if (segments.length === 0) {
    throw new RangeError(
      'The relaxed seed has no resolved h(psi) = 0.5 contour.',
    );
  }

  const signedDistance = new Float64Array(width * depth);
  const contact = new Uint8Array(width * depth);
  const rim = new Uint8Array(width * depth);
  const exterior = new Uint8Array(width * depth);
  const core = new Uint8Array(width * depth);
  const halfWidth = seed.config.interfaceWidth / 2;
  const oneAndHalfWidths = 1.5 * seed.config.interfaceWidth;
  const threeWidths = 3 * seed.config.interfaceWidth;
  let contactCount = 0;
  let rimCount = 0;
  let exteriorCount = 0;
  let coreCount = 0;

  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = surfaceIndex(x, z, width);
      const point = { x: x * seed.config.spacing, z: z * seed.config.spacing };
      let distance = Number.POSITIVE_INFINITY;
      for (const segment of segments) {
        distance = Math.min(distance, distanceToSegment(point, segment));
      }
      const solidSide = (surfaceSolidFraction[index] ?? Number.NaN) >= 0.5;
      const signed = solidSide ? distance : -distance;
      signedDistance[index] = signed;
      if (Math.abs(signed) <= halfWidth) {
        contact[index] = 1;
        contactCount += 1;
      } else if (signed > halfWidth && signed <= oneAndHalfWidths) {
        rim[index] = 1;
        rimCount += 1;
      } else if (signed >= -oneAndHalfWidths && signed < -halfWidth) {
        exterior[index] = 1;
        exteriorCount += 1;
      }
      if (signed >= threeWidths) {
        core[index] = 1;
        coreCount += 1;
      }
    }
  }

  return {
    signedDistance,
    contact,
    rim,
    exterior,
    core,
    counts: {
      contact: contactCount,
      rim: rimCount,
      exterior: exteriorCount,
      core: coreCount,
    },
  };
}

function sumTemperature(state: Candidate2AThermalState): number {
  let sum = 0;
  for (const temperature of state.temperature) sum += temperature;
  return sum;
}

function heatLedger(
  initialTemperatureSum: number,
  state: Candidate2AThermalState,
  integratedSurfaceHeat: number,
): Candidate2AThermalPulseHeatLedger {
  const finalTemperatureSum = sumTemperature(state);
  const actualTemperatureSumChange =
    finalTemperatureSum - initialTemperatureSum;
  const residual = actualTemperatureSumChange - integratedSurfaceHeat;
  const scale = Math.max(
    1,
    Math.abs(actualTemperatureSumChange),
    Math.abs(integratedSurfaceHeat),
  );
  return {
    initialTemperatureSum,
    finalTemperatureSum,
    actualTemperatureSumChange,
    integratedSurfaceHeat,
    residual,
    scale,
    normalizedResidual: residual / scale,
  };
}

function regionMeans(
  state: Candidate2AThermalState,
  mask: Uint8Array,
): Candidate2AThermalPulseRegionMeans {
  const [width, , depth] = state.config.shape;
  let temperatureSum = 0;
  let outwardHeatFluxSum = 0;
  let sampleCount = 0;
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = surfaceIndex(x, z, width);
      if (mask[index] === 0) continue;
      const volumeOffset = volumeIndex(x, 0, z, state.config.shape);
      const temperature = state.temperature[volumeOffset] ?? Number.NaN;
      const orderParameter = state.orderParameter[volumeOffset] ?? Number.NaN;
      temperatureSum += temperature;
      outwardHeatFluxSum += candidate2AFreeSurfaceHeatFlux(
        orderParameter,
        temperature,
        state.config.freeSurface,
      );
      sampleCount += 1;
    }
  }
  const temperature = temperatureSum / sampleCount;
  return {
    sampleCount,
    temperature,
    undercooling: -temperature,
    outwardHeatFlux: outwardHeatFluxSum / sampleCount,
  };
}

function measureCheckpoint(
  state: Candidate2AThermalState,
  masks: Candidate2AThermalPulseSurfaceMasks,
  initialTemperatureSum: number,
  integratedSurfaceHeat: number,
): Candidate2AThermalPulseCheckpoint {
  const regions = {
    contact: regionMeans(state, masks.contact),
    rim: regionMeans(state, masks.rim),
    exterior: regionMeans(state, masks.exterior),
    core: regionMeans(state, masks.core),
  };
  return {
    step: state.step,
    simulatedTime: state.simulatedTime,
    regions,
    outwardFluxJump:
      regions.rim.outwardHeatFlux - regions.exterior.outwardHeatFlux,
    theta: regions.exterior.temperature - regions.rim.temperature,
    rimLocalization: regions.core.temperature - regions.rim.temperature,
    heatLedger: heatLedger(initialTemperatureSum, state, integratedSurfaceHeat),
  };
}

function boundaryForArm(name: PulseArmName): Candidate2AFreeSurfaceBoundary {
  if (name === 'equal') {
    return {
      enabled: true,
      biotNumber: EQUAL_BIOT_NUMBER,
      solidBiotNumber: EQUAL_BIOT_NUMBER,
      ambientTemperature: AMBIENT_TEMPERATURE,
    };
  }
  const forward = name === 'forward';
  return {
    enabled: true,
    biotNumber: forward ? 0.25 : 2,
    solidBiotNumber: forward ? 2 : 0.25,
    ambientTemperature: AMBIENT_TEMPERATURE,
  };
}

function runArm(
  name: PulseArmName,
  seed: Candidate2AThermalState,
  masks: Candidate2AThermalPulseSurfaceMasks,
): Candidate2AThermalPulseArmResult {
  const configuration = createCandidate2AMorphologyScreenConfiguration();
  const configured = createInitialCandidate2AThermalState({
    ...configuration,
    freeSurface: boundaryForArm(name),
  });
  let state: Candidate2AThermalState = {
    ...configured,
    orderParameter: seed.orderParameter,
    temperature: new Float32Array(configured.config.voxelCount),
    step: 0,
    simulatedTime: 0,
  };
  const initialTemperatureSum = sumTemperature(state);
  let integratedSurfaceHeat = 0;
  const checkpoints: Candidate2AThermalPulseCheckpoint[] = [];

  for (let step = 1; step <= PULSE_STEPS; step += 1) {
    integratedSurfaceHeat +=
      state.config.timeStep * candidate2AFreeSurfaceHeatRate(state);
    state = {
      ...state,
      temperature: advanceCandidate2ATemperature(state, state.orderParameter),
      step,
      simulatedTime: step * state.config.timeStep,
    };
    if ((PULSE_CHECKPOINT_STEPS as readonly number[]).includes(step)) {
      checkpoints.push(
        measureCheckpoint(
          state,
          masks,
          initialTemperatureSum,
          integratedSurfaceHeat,
        ),
      );
    }
  }
  const finalLedger = heatLedger(
    initialTemperatureSum,
    state,
    integratedSurfaceHeat,
  );
  return {
    finalState: state,
    checkpoints,
    heatLedger: finalLedger,
    orderParameterIdentity: state.orderParameter === seed.orderParameter,
  };
}

function oddEven(
  equal: number,
  forward: number,
  reverse: number,
): Candidate2AThermalPulseOddEven {
  return {
    equal,
    forward,
    reverse,
    odd: (forward - reverse) / 2,
    even: (forward + reverse) / 2 - equal,
  };
}

function compareCheckpoints(
  arms: Readonly<Record<PulseArmName, Candidate2AThermalPulseArmResult>>,
): Candidate2AThermalPulseComparison[] {
  return PULSE_CHECKPOINT_STEPS.map((step, checkpointIndex) => {
    const equal = arms.equal.checkpoints[checkpointIndex]!;
    const forward = arms.forward.checkpoints[checkpointIndex]!;
    const reverse = arms.reverse.checkpoints[checkpointIndex]!;
    return {
      step,
      simulatedTime: equal.simulatedTime,
      outwardFluxJump: oddEven(
        equal.outwardFluxJump,
        forward.outwardFluxJump,
        reverse.outwardFluxJump,
      ),
      theta: oddEven(equal.theta, forward.theta, reverse.theta),
      rimLocalization: oddEven(
        equal.rimLocalization,
        forward.rimLocalization,
        reverse.rimLocalization,
      ),
    };
  });
}

function allFinite(values: readonly number[]): boolean {
  return values.every(Number.isFinite);
}

function oddEvenValues(
  decomposition: Candidate2AThermalPulseOddEven,
): readonly number[] {
  return [
    decomposition.equal,
    decomposition.forward,
    decomposition.reverse,
    decomposition.odd,
    decomposition.even,
  ];
}

function evaluateGates(
  preRelaxationConverged: boolean,
  masks: Candidate2AThermalPulseSurfaceMasks,
  arms: Readonly<Record<PulseArmName, Candidate2AThermalPulseArmResult>>,
  comparisons: readonly Candidate2AThermalPulseComparison[],
): Candidate2AThermalPulseGates {
  const final = comparisons.at(-1)!;
  const values = comparisons.flatMap((comparison) => [
    ...oddEvenValues(comparison.outwardFluxJump),
    ...oddEvenValues(comparison.theta),
    ...oddEvenValues(comparison.rimLocalization),
  ]);
  const frozenOrderParameter = Object.values(arms).every(
    (arm) => arm.orderParameterIdentity,
  );
  const heatLedgersClose = Object.values(arms).every(
    (arm) =>
      Math.abs(arm.heatLedger.normalizedResidual) <=
      MAXIMUM_NORMALIZED_ENERGY_RESIDUAL,
  );
  const equalCaseNull =
    Math.abs(final.theta.equal) <= MAXIMUM_EQUAL_CONTRAST &&
    Math.abs(final.rimLocalization.equal) <= MAXIMUM_EQUAL_CONTRAST;
  const signPass =
    equalCaseNull &&
    final.outwardFluxJump.forward > 0 &&
    final.outwardFluxJump.reverse < 0 &&
    final.theta.forward >= MINIMUM_THETA_CONTRAST &&
    final.theta.reverse <= -MINIMUM_THETA_CONTRAST &&
    Math.abs(final.theta.even) <=
      MAXIMUM_EVEN_TO_ODD_RATIO * Math.abs(final.theta.odd);
  const localizationPass =
    final.rimLocalization.forward >= MINIMUM_LOCALIZATION_CONTRAST &&
    final.rimLocalization.reverse <= -MINIMUM_LOCALIZATION_CONTRAST &&
    Math.abs(final.rimLocalization.even) <=
      MAXIMUM_EVEN_TO_ODD_RATIO * Math.abs(final.rimLocalization.odd);
  return {
    preRelaxationConverged,
    masksResolved: Object.values(masks.counts).every((count) => count > 0),
    finite: allFinite(values),
    frozenOrderParameter,
    heatLedgersClose,
    equalCaseNull,
    signPass,
    localizationPass,
  };
}

function classify(
  gates: Candidate2AThermalPulseGates,
): Candidate2AThermalPulseClassification {
  if (
    !gates.preRelaxationConverged ||
    !gates.masksResolved ||
    !gates.finite ||
    !gates.frozenOrderParameter ||
    !gates.heatLedgersClose
  ) {
    return 'invalid';
  }
  if (!gates.signPass) return 'surface-flux-sign-failure';
  if (!gates.localizationPass) return 'contrast-not-rim-localized';
  return 'passes-pulse-only';
}

/**
 * Runs the fixed, frozen-phase Candidate 2A thermal pulse. This discriminator
 * diagnoses the boundary mechanism; passing it does not promote a morphology.
 */
export function runCandidate2AThermalPulseDiagnostic(): Candidate2AThermalPulseResult {
  const configuration = createCandidate2AMorphologyScreenConfiguration();
  const unrelaxed = createInitialCandidate2AThermalState(configuration);
  const relaxation = preRelaxCandidate2ASurfaceSeed(unrelaxed, {
    maximumIterations: 2000,
    rateTolerance: 0.005,
  });
  const seed = relaxation.state;
  const masks = createSurfaceMasks(seed);
  const arms = {
    equal: runArm('equal', seed, masks),
    forward: runArm('forward', seed, masks),
    reverse: runArm('reverse', seed, masks),
  };
  const comparisons = compareCheckpoints(arms);
  const gates = evaluateGates(relaxation.converged, masks, arms, comparisons);
  return {
    classification: classify(gates),
    seed,
    preRelaxation: {
      iterations: relaxation.iterations,
      converged: relaxation.converged,
      maximumRate: relaxation.maximumRate,
      energyDecrease: relaxation.initialEnergy - relaxation.finalEnergy,
      relativeVolumeDrift: relaxation.relativeVolumeDrift,
    },
    masks,
    arms,
    comparisons,
    gates,
  };
}
