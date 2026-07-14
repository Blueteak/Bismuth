export type Candidate2DVec2 = readonly [number, number];

export type Candidate2DFourValues = readonly [number, number, number, number];

export type Candidate2DFourVectors = readonly [
  Candidate2DVec2,
  Candidate2DVec2,
  Candidate2DVec2,
  Candidate2DVec2,
];

export interface Candidate2DWindingConfiguration {
  readonly supportNormals: Candidate2DFourVectors;
  readonly initialSupportOffsets: Candidate2DFourValues;
  readonly terraceWidths: readonly number[];
  readonly headSpeeds: Candidate2DFourValues;
  readonly stepHeight: number;
  readonly latentHeatPerVolume: number;
  readonly timeStep: number;
  readonly ledgeBirthInterval: number;
  readonly maximumLedgeCount: number;
}

export interface Candidate2DSweepPatch {
  readonly vertices: readonly Candidate2DVec2[];
  readonly area: number;
  readonly supportIndex: number;
  readonly turnOrdinal: number;
  readonly elevationIndex: number;
  readonly partial: boolean;
}

export interface Candidate2DPathSegment {
  readonly start: Candidate2DVec2;
  readonly end: Candidate2DVec2;
  readonly supportIndex: number;
  readonly turnOrdinal: number;
  readonly elevationIndex: number;
  readonly kind: 'sweep' | 'connector';
}

export interface Candidate2DStepHead {
  readonly position: Candidate2DVec2;
  readonly direction: Candidate2DVec2;
  readonly supportIndex: number;
  readonly turnOrdinal: number;
  readonly elevationIndex: number;
  readonly birthSource: 'unresolved-target-carrier';
}

export interface Candidate2DLedgeState {
  readonly elevationIndex: number;
  readonly birthTime: number;
  readonly currentSupportOffsets: Candidate2DFourValues;
  readonly activeSupportIndex: number;
  readonly turnOrdinal: number;
  readonly progress: number;
  readonly completedPatches: readonly Candidate2DSweepPatch[];
  readonly completedPathSegments: readonly Candidate2DPathSegment[];
  readonly integratedSweptArea: number;
  readonly integratedSolidVolume: number;
  readonly releasedLatentHeat: number;
  readonly complete: boolean;
}

export interface Candidate2DWindingState {
  readonly configuration: Candidate2DWindingConfiguration;
  readonly ledges: readonly Candidate2DLedgeState[];
  readonly integratedSweptArea: number;
  readonly integratedSolidVolume: number;
  readonly releasedLatentHeat: number;
  readonly time: number;
  readonly step: number;
}

export interface Candidate2DActiveSweepGeometry {
  readonly outerPolygon: readonly Candidate2DVec2[];
  readonly innerPolygon: readonly Candidate2DVec2[];
  readonly fullPatch: Candidate2DSweepPatch;
  readonly partialPatch: Candidate2DSweepPatch;
  readonly tangentMinimum: number;
  readonly tangentMaximum: number;
  readonly travelLength: number;
  readonly progressFraction: number;
  readonly startFrontInnerPosition: Candidate2DVec2;
  readonly currentFrontInnerPosition: Candidate2DVec2;
  readonly endFrontInnerPosition: Candidate2DVec2;
  readonly startHead: Candidate2DStepHead;
  readonly currentHead: Candidate2DStepHead;
  readonly endHead: Candidate2DStepHead;
}

export interface Candidate2DTopologyDescriptor {
  readonly outerEdgeCount: number;
  readonly principalAxisCount: number;
  readonly turnAnglesDegrees: readonly number[];
  readonly signedTurnRadians: readonly number[];
  readonly openingDepthSteps: number;
  readonly openingDepthRatio: number;
  readonly terraceWidths: readonly number[];
  readonly openingCenterOffsetRatio: number;
  readonly activePartialFrontCount: number;
  readonly pathClosed: boolean;
  readonly pathSelfIntersectionCount: number;
}

export type Candidate2DTopologyRejectionReason =
  | 'requires-four-edge-frame'
  | 'requires-two-dominant-axes'
  | 'insufficient-rectilinear-turns'
  | 'inconsistent-winding'
  | 'opening-too-shallow'
  | 'requires-partial-front'
  | 'path-closes-into-rings'
  | 'path-self-intersects'
  | 'symmetry-too-perfect';

export interface Candidate2DTopologyAssessment {
  readonly classification: 'target-topology-carrier' | 'rejected';
  readonly acceptedMorphology: false;
  readonly mechanismResolved: false;
  readonly reasons: readonly Candidate2DTopologyRejectionReason[];
  readonly descriptor: Candidate2DTopologyDescriptor;
}

const GEOMETRY_EPSILON = 1e-10;
const EVENT_EPSILON = 1e-12;

function dot(left: Candidate2DVec2, right: Candidate2DVec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function cross(left: Candidate2DVec2, right: Candidate2DVec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function subtract(
  left: Candidate2DVec2,
  right: Candidate2DVec2,
): Candidate2DVec2 {
  return [left[0] - right[0], left[1] - right[1]];
}

function distance(left: Candidate2DVec2, right: Candidate2DVec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function interpolate(
  start: Candidate2DVec2,
  end: Candidate2DVec2,
  fraction: number,
): Candidate2DVec2 {
  return [
    start[0] + fraction * (end[0] - start[0]),
    start[1] + fraction * (end[1] - start[1]),
  ];
}

function normalize(vector: Candidate2DVec2): Candidate2DVec2 {
  const length = Math.hypot(vector[0], vector[1]);
  if (!Number.isFinite(length) || length <= GEOMETRY_EPSILON) {
    throw new RangeError('Candidate 2D support normals must be finite.');
  }
  return [vector[0] / length, vector[1] / length];
}

function rotateCounterclockwise(vector: Candidate2DVec2): Candidate2DVec2 {
  return [-vector[1], vector[0]];
}

function supportLineIntersection(
  firstNormal: Candidate2DVec2,
  firstOffset: number,
  secondNormal: Candidate2DVec2,
  secondOffset: number,
): Candidate2DVec2 {
  const determinant = cross(firstNormal, secondNormal);
  if (Math.abs(determinant) <= GEOMETRY_EPSILON) {
    throw new RangeError(
      'Candidate 2D adjacent supports must have distinct cyclic normals.',
    );
  }
  return [
    (firstOffset * secondNormal[1] - firstNormal[1] * secondOffset) /
      determinant,
    (firstNormal[0] * secondOffset - firstOffset * secondNormal[0]) /
      determinant,
  ];
}

function asFourValues(values: readonly number[]): Candidate2DFourValues {
  if (values.length !== 4) {
    throw new RangeError('Candidate 2D requires exactly four supports.');
  }
  return [
    values[0] ?? Number.NaN,
    values[1] ?? Number.NaN,
    values[2] ?? Number.NaN,
    values[3] ?? Number.NaN,
  ];
}

function normalizedSupportNormals(
  normals: Candidate2DFourVectors,
): Candidate2DFourVectors {
  return [
    normalize(normals[0]),
    normalize(normals[1]),
    normalize(normals[2]),
    normalize(normals[3]),
  ];
}

function sanitizePolygon(
  vertices: readonly Candidate2DVec2[],
): Candidate2DVec2[] {
  const sanitized: Candidate2DVec2[] = [];
  for (const vertex of vertices) {
    if (
      sanitized.length === 0 ||
      distance(sanitized[sanitized.length - 1]!, vertex) > GEOMETRY_EPSILON
    ) {
      sanitized.push(vertex);
    }
  }
  if (
    sanitized.length > 1 &&
    distance(sanitized[0]!, sanitized[sanitized.length - 1]!) <=
      GEOMETRY_EPSILON
  ) {
    sanitized.pop();
  }
  return sanitized;
}

function clipPolygonAtMost(
  vertices: readonly Candidate2DVec2[],
  normal: Candidate2DVec2,
  offset: number,
): Candidate2DVec2[] {
  if (vertices.length === 0) return [];
  const output: Candidate2DVec2[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const currentValue = dot(normal, current) - offset;
    const nextValue = dot(normal, next) - offset;
    const currentInside = currentValue <= GEOMETRY_EPSILON;
    const nextInside = nextValue <= GEOMETRY_EPSILON;

    if (currentInside) output.push(current);
    if (currentInside === nextInside) continue;

    const denominator = currentValue - nextValue;
    if (Math.abs(denominator) <= GEOMETRY_EPSILON) continue;
    const interpolation = currentValue / denominator;
    output.push([
      current[0] + interpolation * (next[0] - current[0]),
      current[1] + interpolation * (next[1] - current[1]),
    ]);
  }
  return sanitizePolygon(output);
}

export function candidate2DPolygonArea(
  vertices: readonly Candidate2DVec2[],
): number {
  if (vertices.length < 3) return 0;
  let doubledArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    doubledArea += cross(current, next);
  }
  return Math.abs(doubledArea) / 2;
}

export function candidate2DPolygonCentroid(
  vertices: readonly Candidate2DVec2[],
): Candidate2DVec2 {
  if (vertices.length < 3) {
    throw new RangeError('Candidate 2D polygon centroid needs three vertices.');
  }
  let crossSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const edgeCross = cross(current, next);
    crossSum += edgeCross;
    weightedX += (current[0] + next[0]) * edgeCross;
    weightedY += (current[1] + next[1]) * edgeCross;
  }
  if (Math.abs(crossSum) <= GEOMETRY_EPSILON) {
    throw new RangeError('Candidate 2D polygon must have positive area.');
  }
  return [weightedX / (3 * crossSum), weightedY / (3 * crossSum)];
}

export function candidate2DPolygonFromSupports(
  supportNormals: Candidate2DFourVectors,
  supportOffsets: Candidate2DFourValues,
): readonly Candidate2DVec2[] {
  const normals = normalizedSupportNormals(supportNormals);
  const polygon = normals.map((normal, index) =>
    supportLineIntersection(
      normal,
      supportOffsets[index]!,
      normals[(index + 1) % 4]!,
      supportOffsets[(index + 1) % 4]!,
    ),
  );
  const scale = Math.max(1, ...supportOffsets.map(Math.abs));
  for (const vertex of polygon) {
    for (let supportIndex = 0; supportIndex < 4; supportIndex += 1) {
      if (
        dot(normals[supportIndex]!, vertex) - supportOffsets[supportIndex]! >
        1e-9 * scale
      ) {
        throw new RangeError(
          'Candidate 2D supports do not enclose one convex quadrilateral.',
        );
      }
    }
  }
  if (
    sanitizePolygon(polygon).length !== 4 ||
    candidate2DPolygonArea(polygon) <= GEOMETRY_EPSILON
  ) {
    throw new RangeError(
      'Candidate 2D supports must enclose one positive-area quadrilateral.',
    );
  }
  return polygon;
}

function validateConfiguration(
  configuration: Candidate2DWindingConfiguration,
): void {
  const normals = normalizedSupportNormals(configuration.supportNormals);
  for (let index = 0; index < 4; index += 1) {
    const nextIndex = (index + 1) % 4;
    if (cross(normals[index]!, normals[nextIndex]!) <= 0.05) {
      throw new RangeError(
        'Candidate 2D support normals must be cyclic with gaps below pi.',
      );
    }
  }
  if (
    configuration.initialSupportOffsets.some(
      (offset) => !Number.isFinite(offset) || offset <= 0,
    )
  ) {
    throw new RangeError('Candidate 2D support offsets must be positive.');
  }
  if (
    configuration.terraceWidths.length < 8 ||
    configuration.terraceWidths.some(
      (width) => !Number.isFinite(width) || width <= 0,
    )
  ) {
    throw new RangeError(
      'Candidate 2D needs at least eight positive irregular terrace widths.',
    );
  }
  if (
    configuration.headSpeeds.some(
      (speed) => !Number.isFinite(speed) || speed <= 0,
    ) ||
    !Number.isFinite(configuration.stepHeight) ||
    configuration.stepHeight <= 0 ||
    !Number.isFinite(configuration.latentHeatPerVolume) ||
    configuration.latentHeatPerVolume <= 0 ||
    !Number.isFinite(configuration.timeStep) ||
    configuration.timeStep <= 0 ||
    !Number.isFinite(configuration.ledgeBirthInterval) ||
    configuration.ledgeBirthInterval <= 0 ||
    !Number.isSafeInteger(configuration.maximumLedgeCount) ||
    configuration.maximumLedgeCount < 1
  ) {
    throw new RangeError(
      'Candidate 2D kinetics, ledger, and birth schedule must be positive.',
    );
  }
  let offsets = asFourValues(configuration.initialSupportOffsets);
  let previousArea = candidate2DPolygonArea(
    candidate2DPolygonFromSupports(normals, offsets),
  );
  for (
    let turnOrdinal = 0;
    turnOrdinal < configuration.terraceWidths.length;
    turnOrdinal += 1
  ) {
    const nextOffsets = [...offsets];
    const supportIndex = turnOrdinal % 4;
    nextOffsets[supportIndex] =
      nextOffsets[supportIndex]! - configuration.terraceWidths[turnOrdinal]!;
    offsets = asFourValues(nextOffsets);
    const nextArea = candidate2DPolygonArea(
      candidate2DPolygonFromSupports(normals, offsets),
    );
    if (nextArea >= previousArea - GEOMETRY_EPSILON) {
      throw new RangeError(
        'Candidate 2D terrace widths must leave a strictly smaller opening.',
      );
    }
    previousArea = nextArea;
  }
}

function canonicalConfiguration(
  configuration: Candidate2DWindingConfiguration,
): Candidate2DWindingConfiguration {
  return {
    ...configuration,
    supportNormals: normalizedSupportNormals(configuration.supportNormals),
    initialSupportOffsets: asFourValues(configuration.initialSupportOffsets),
    terraceWidths: [...configuration.terraceWidths],
    headSpeeds: asFourValues(configuration.headSpeeds),
  };
}

function proofNormals(): Candidate2DFourVectors {
  return normalizedSupportNormals([
    [1, 0],
    [1, 9],
    [-10, 1],
    [-1, -8],
  ]);
}

export const CANDIDATE2D_WINDING_PROOF = Object.freeze({
  evaluationTime: 43,
  totalSteps: 860,
  checkpointInterval: 215,
  checkpointSteps: Object.freeze([0, 215, 430, 645, 860] as const),
  minimumChangedMeshPromotions: 3,
  configuration: Object.freeze({
    supportNormals: proofNormals(),
    initialSupportOffsets: Object.freeze([6.4, 5.7, 6.9, 5.4] as const),
    terraceWidths: Object.freeze([
      0.62, 0.43, 0.79, 0.51, 0.68, 0.38, 0.57, 0.47, 0.73,
    ]),
    headSpeeds: Object.freeze([2.4, 1.7, 2.1, 1.5] as const),
    stepHeight: 0.25,
    latentHeatPerVolume: 2.75,
    timeStep: 0.05,
    ledgeBirthInterval: 10,
    maximumLedgeCount: 4,
  } satisfies Candidate2DWindingConfiguration),
});

function createLedge(
  configuration: Candidate2DWindingConfiguration,
  elevationIndex: number,
  birthTime: number,
): Candidate2DLedgeState {
  return {
    elevationIndex,
    birthTime,
    currentSupportOffsets: asFourValues(configuration.initialSupportOffsets),
    activeSupportIndex: 0,
    turnOrdinal: 0,
    progress: 0,
    completedPatches: [],
    completedPathSegments: [],
    integratedSweptArea: 0,
    integratedSolidVolume: 0,
    releasedLatentHeat: 0,
    complete: false,
  };
}

function stepHead(
  normal: Candidate2DVec2,
  tangent: Candidate2DVec2,
  inwardOffset: number,
  tangentCoordinate: number,
  ledge: Candidate2DLedgeState,
): Candidate2DStepHead {
  return {
    position: [
      normal[0] * inwardOffset + tangent[0] * tangentCoordinate,
      normal[1] * inwardOffset + tangent[1] * tangentCoordinate,
    ],
    direction: tangent,
    supportIndex: ledge.activeSupportIndex,
    turnOrdinal: ledge.turnOrdinal,
    elevationIndex: ledge.elevationIndex,
    birthSource: 'unresolved-target-carrier',
  };
}

export function candidate2DActiveSweepGeometry(
  ledge: Candidate2DLedgeState,
  configuration: Candidate2DWindingConfiguration,
): Candidate2DActiveSweepGeometry | null {
  if (ledge.complete) return null;
  const normals = normalizedSupportNormals(configuration.supportNormals);
  const activeNormal = normals[ledge.activeSupportIndex]!;
  const tangent = rotateCounterclockwise(activeNormal);
  const activeWidth =
    configuration.terraceWidths[ledge.turnOrdinal] ?? Number.NaN;
  if (!Number.isFinite(activeWidth) || activeWidth <= 0) {
    throw new RangeError('Candidate 2D active width is unavailable.');
  }
  const inwardOffset =
    ledge.currentSupportOffsets[ledge.activeSupportIndex]! - activeWidth;
  const innerOffsets = [...ledge.currentSupportOffsets];
  innerOffsets[ledge.activeSupportIndex] = inwardOffset;
  const outerPolygon = candidate2DPolygonFromSupports(
    normals,
    ledge.currentSupportOffsets,
  );
  const innerPolygon = candidate2DPolygonFromSupports(
    normals,
    asFourValues(innerOffsets),
  );
  const fullPatchVertices = clipPolygonAtMost(
    outerPolygon,
    [-activeNormal[0], -activeNormal[1]],
    -inwardOffset,
  );
  const fullArea = candidate2DPolygonArea(fullPatchVertices);
  const areaDifference =
    candidate2DPolygonArea(outerPolygon) - candidate2DPolygonArea(innerPolygon);
  const areaScale = Math.max(1, fullArea, areaDifference);
  if (
    fullArea <= GEOMETRY_EPSILON ||
    Math.abs(fullArea - areaDifference) > 1e-10 * areaScale
  ) {
    throw new RangeError(
      'Candidate 2D clipped strip disagrees with the support-area change.',
    );
  }
  const previousSupportIndex = (ledge.activeSupportIndex + 3) % 4;
  const nextSupportIndex = (ledge.activeSupportIndex + 1) % 4;
  const outerOffset = ledge.currentSupportOffsets[ledge.activeSupportIndex]!;
  const outerStart = supportLineIntersection(
    activeNormal,
    outerOffset,
    normals[previousSupportIndex]!,
    ledge.currentSupportOffsets[previousSupportIndex]!,
  );
  const outerEnd = supportLineIntersection(
    activeNormal,
    outerOffset,
    normals[nextSupportIndex]!,
    ledge.currentSupportOffsets[nextSupportIndex]!,
  );
  const innerStart = supportLineIntersection(
    activeNormal,
    inwardOffset,
    normals[previousSupportIndex]!,
    ledge.currentSupportOffsets[previousSupportIndex]!,
  );
  const innerEnd = supportLineIntersection(
    activeNormal,
    inwardOffset,
    normals[nextSupportIndex]!,
    ledge.currentSupportOffsets[nextSupportIndex]!,
  );
  const tangentMinimum = dot(tangent, outerStart);
  const tangentMaximum = dot(tangent, outerEnd);
  const travelLength = tangentMaximum - tangentMinimum;
  if (!Number.isFinite(travelLength) || travelLength <= GEOMETRY_EPSILON) {
    throw new RangeError('Candidate 2D active ledge has no travel length.');
  }
  const clampedProgress = Math.max(0, Math.min(ledge.progress, travelLength));
  const progressFraction = clampedProgress / travelLength;
  const tangentCoordinate =
    tangentMinimum + progressFraction * (tangentMaximum - tangentMinimum);
  const currentOuter = interpolate(outerStart, outerEnd, progressFraction);
  const currentInner = interpolate(innerStart, innerEnd, progressFraction);
  const partialPatchVertices =
    clampedProgress <= GEOMETRY_EPSILON
      ? []
      : sanitizePolygon([outerStart, currentOuter, currentInner, innerStart]);
  const patchBase = {
    supportIndex: ledge.activeSupportIndex,
    turnOrdinal: ledge.turnOrdinal,
    elevationIndex: ledge.elevationIndex,
  } as const;
  return {
    outerPolygon,
    innerPolygon,
    fullPatch: {
      ...patchBase,
      vertices: fullPatchVertices,
      area: fullArea,
      partial: false,
    },
    partialPatch: {
      ...patchBase,
      vertices: partialPatchVertices,
      area: candidate2DPolygonArea(partialPatchVertices),
      partial: true,
    },
    tangentMinimum,
    tangentMaximum,
    travelLength,
    progressFraction,
    startFrontInnerPosition: innerStart,
    currentFrontInnerPosition: currentInner,
    endFrontInnerPosition: innerEnd,
    startHead: stepHead(
      activeNormal,
      tangent,
      outerOffset,
      tangentMinimum,
      ledge,
    ),
    currentHead: stepHead(
      activeNormal,
      tangent,
      outerOffset,
      tangentCoordinate,
      ledge,
    ),
    endHead: stepHead(
      activeNormal,
      tangent,
      outerOffset,
      tangentMaximum,
      ledge,
    ),
  };
}

function advanceLedge(
  initial: Candidate2DLedgeState,
  configuration: Candidate2DWindingConfiguration,
  duration: number,
): Candidate2DLedgeState {
  const normals = normalizedSupportNormals(configuration.supportNormals);
  let ledge = initial;
  let remaining = duration;
  while (remaining > EVENT_EPSILON && !ledge.complete) {
    const geometry = candidate2DActiveSweepGeometry(ledge, configuration)!;
    const speed = configuration.headSpeeds[ledge.activeSupportIndex]!;
    const remainingDistance = geometry.travelLength - ledge.progress;
    const eventDuration = remainingDistance / speed;
    if (remaining < eventDuration - EVENT_EPSILON) {
      const nextProgress = ledge.progress + speed * remaining;
      const nextGeometry = candidate2DActiveSweepGeometry(
        { ...ledge, progress: nextProgress },
        configuration,
      )!;
      const areaIncrement =
        nextGeometry.partialPatch.area - geometry.partialPatch.area;
      if (areaIncrement < -GEOMETRY_EPSILON) {
        throw new RangeError('Candidate 2D swept area must be monotonic.');
      }
      const sweptAreaIncrement = Math.max(0, areaIncrement);
      const solidVolumeIncrement =
        configuration.stepHeight * sweptAreaIncrement;
      ledge = {
        ...ledge,
        progress: nextProgress,
        integratedSweptArea: ledge.integratedSweptArea + sweptAreaIncrement,
        integratedSolidVolume:
          ledge.integratedSolidVolume + solidVolumeIncrement,
        releasedLatentHeat:
          ledge.releasedLatentHeat +
          configuration.latentHeatPerVolume * solidVolumeIncrement,
      };
      remaining = 0;
      continue;
    }

    const completedAreaIncrement =
      geometry.fullPatch.area - geometry.partialPatch.area;
    const sweptAreaIncrement = Math.max(0, completedAreaIncrement);
    const solidVolumeIncrement = configuration.stepHeight * sweptAreaIncrement;
    const nextOffsets = [...ledge.currentSupportOffsets];
    nextOffsets[ledge.activeSupportIndex] = geometry.innerPolygon.reduce(
      (maximum, vertex) =>
        Math.max(maximum, dot(normals[ledge.activeSupportIndex]!, vertex)),
      Number.NEGATIVE_INFINITY,
    );
    const completedSweep: Candidate2DPathSegment = {
      start: geometry.startHead.position,
      end: geometry.endHead.position,
      supportIndex: ledge.activeSupportIndex,
      turnOrdinal: ledge.turnOrdinal,
      elevationIndex: ledge.elevationIndex,
      kind: 'sweep',
    };
    const completedConnector: Candidate2DPathSegment = {
      start: geometry.endHead.position,
      end: geometry.endFrontInnerPosition,
      supportIndex: ledge.activeSupportIndex,
      turnOrdinal: ledge.turnOrdinal,
      elevationIndex: ledge.elevationIndex,
      kind: 'connector',
    };
    const nextTurnOrdinal = ledge.turnOrdinal + 1;
    const complete = nextTurnOrdinal >= configuration.terraceWidths.length;
    const completedPathSegments = [
      ...ledge.completedPathSegments,
      completedSweep,
      completedConnector,
    ];
    const committed: Candidate2DLedgeState = {
      ...ledge,
      currentSupportOffsets: asFourValues(nextOffsets),
      activeSupportIndex: (ledge.activeSupportIndex + 1) % 4,
      turnOrdinal: nextTurnOrdinal,
      progress: 0,
      completedPatches: [...ledge.completedPatches, geometry.fullPatch],
      completedPathSegments,
      integratedSweptArea: ledge.integratedSweptArea + sweptAreaIncrement,
      integratedSolidVolume: ledge.integratedSolidVolume + solidVolumeIncrement,
      releasedLatentHeat:
        ledge.releasedLatentHeat +
        configuration.latentHeatPerVolume * solidVolumeIncrement,
      complete,
    };
    if (!complete) {
      const nextGeometry = candidate2DActiveSweepGeometry(
        committed,
        configuration,
      )!;
      if (
        distance(
          geometry.endFrontInnerPosition,
          nextGeometry.startHead.position,
        ) > 1e-9
      ) {
        throw new RangeError(
          'Candidate 2D consecutive ledge turns must share one head position.',
        );
      }
    }
    ledge = { ...committed, completedPathSegments };
    remaining = Math.max(0, remaining - eventDuration);
  }
  return ledge;
}

function ledgerState(
  configuration: Candidate2DWindingConfiguration,
  ledges: readonly Candidate2DLedgeState[],
  time: number,
  step: number,
): Candidate2DWindingState {
  const integratedSweptArea = ledges.reduce(
    (sum, ledge) => sum + ledge.integratedSweptArea,
    0,
  );
  const integratedSolidVolume = ledges.reduce(
    (sum, ledge) => sum + ledge.integratedSolidVolume,
    0,
  );
  const releasedLatentHeat = ledges.reduce(
    (sum, ledge) => sum + ledge.releasedLatentHeat,
    0,
  );
  return {
    configuration,
    ledges,
    integratedSweptArea,
    integratedSolidVolume,
    releasedLatentHeat,
    time,
    step,
  };
}

export function createCandidate2DWindingState(
  configuration: Candidate2DWindingConfiguration = CANDIDATE2D_WINDING_PROOF.configuration,
): Candidate2DWindingState {
  const canonical = canonicalConfiguration(configuration);
  validateConfiguration(canonical);
  return ledgerState(canonical, [createLedge(canonical, 0, 0)], 0, 0);
}

export function advanceCandidate2DWindingState(
  state: Candidate2DWindingState,
  duration: number,
): Candidate2DWindingState {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError('Candidate 2D advance duration must be nonnegative.');
  }
  if (duration === 0) return state;
  const targetTime = state.time + duration;
  let cursor = state.time;
  let ledges = [...state.ledges];

  while (cursor < targetTime - EVENT_EPSILON) {
    const nextBirthTime =
      ledges.length < state.configuration.maximumLedgeCount
        ? ledges.length * state.configuration.ledgeBirthInterval
        : Number.POSITIVE_INFINITY;
    const intervalEnd = Math.min(targetTime, nextBirthTime);
    const intervalDuration = Math.max(0, intervalEnd - cursor);
    if (intervalDuration > EVENT_EPSILON) {
      ledges = ledges.map((ledge) =>
        advanceLedge(ledge, state.configuration, intervalDuration),
      );
      cursor = intervalEnd;
    }
    if (
      nextBirthTime <= targetTime + EVENT_EPSILON &&
      Math.abs(cursor - nextBirthTime) <= EVENT_EPSILON &&
      ledges.length < state.configuration.maximumLedgeCount
    ) {
      ledges.push(
        createLedge(state.configuration, ledges.length, nextBirthTime),
      );
      continue;
    }
    if (intervalDuration <= EVENT_EPSILON) cursor = targetTime;
  }

  return ledgerState(state.configuration, ledges, targetTime, state.step + 1);
}

export function runCandidate2DWindingSteps(
  initial: Candidate2DWindingState,
  stepCount: number,
): Candidate2DWindingState {
  if (!Number.isSafeInteger(stepCount) || stepCount < 0) {
    throw new RangeError('Candidate 2D step count must be nonnegative.');
  }
  let state = initial;
  for (let index = 0; index < stepCount; index += 1) {
    state = advanceCandidate2DWindingState(state, state.configuration.timeStep);
  }
  return state;
}

export function candidate2DLedgeSweepPatches(
  ledge: Candidate2DLedgeState,
  configuration: Candidate2DWindingConfiguration,
): readonly Candidate2DSweepPatch[] {
  const active = candidate2DActiveSweepGeometry(ledge, configuration);
  return active && active.partialPatch.area > GEOMETRY_EPSILON
    ? [...ledge.completedPatches, active.partialPatch]
    : ledge.completedPatches;
}

export function candidate2DLedgePathSegments(
  ledge: Candidate2DLedgeState,
  configuration: Candidate2DWindingConfiguration,
): readonly Candidate2DPathSegment[] {
  const active = candidate2DActiveSweepGeometry(ledge, configuration);
  if (!active || ledge.progress <= GEOMETRY_EPSILON) {
    return ledge.completedPathSegments;
  }
  return [
    ...ledge.completedPathSegments,
    {
      start: active.startHead.position,
      end: active.currentHead.position,
      supportIndex: ledge.activeSupportIndex,
      turnOrdinal: ledge.turnOrdinal,
      elevationIndex: ledge.elevationIndex,
      kind: 'sweep',
    },
  ];
}

export function candidate2DStepHeads(
  state: Candidate2DWindingState,
): readonly Candidate2DStepHead[] {
  return state.ledges.flatMap((ledge) => {
    const geometry = candidate2DActiveSweepGeometry(ledge, state.configuration);
    return geometry ? [geometry.currentHead] : [];
  });
}

function pointOnSegment(
  point: Candidate2DVec2,
  start: Candidate2DVec2,
  end: Candidate2DVec2,
): boolean {
  if (Math.abs(cross(subtract(end, start), subtract(point, start))) > 1e-9) {
    return false;
  }
  return (
    point[0] >= Math.min(start[0], end[0]) - GEOMETRY_EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + GEOMETRY_EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - GEOMETRY_EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + GEOMETRY_EPSILON
  );
}

function segmentIntersection(
  first: Candidate2DPathSegment,
  second: Candidate2DPathSegment,
): boolean {
  const a = subtract(first.end, first.start);
  const b = subtract(second.end, second.start);
  const denominator = cross(a, b);
  if (Math.abs(denominator) <= GEOMETRY_EPSILON) {
    return (
      pointOnSegment(first.start, second.start, second.end) ||
      pointOnSegment(first.end, second.start, second.end) ||
      pointOnSegment(second.start, first.start, first.end) ||
      pointOnSegment(second.end, first.start, first.end)
    );
  }
  const separation = subtract(second.start, first.start);
  const firstParameter = cross(separation, b) / denominator;
  const secondParameter = cross(separation, a) / denominator;
  return (
    firstParameter >= -GEOMETRY_EPSILON &&
    firstParameter <= 1 + GEOMETRY_EPSILON &&
    secondParameter >= -GEOMETRY_EPSILON &&
    secondParameter <= 1 + GEOMETRY_EPSILON
  );
}

function selfIntersectionCount(
  segments: readonly Candidate2DPathSegment[],
): number {
  let intersections = 0;
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 2; right < segments.length; right += 1) {
      if (segmentIntersection(segments[left]!, segments[right]!)) {
        intersections += 1;
      }
    }
  }
  return intersections;
}

function polygonSpan(vertices: readonly Candidate2DVec2[]): number {
  const xs = vertices.map((vertex) => vertex[0]);
  const ys = vertices.map((vertex) => vertex[1]);
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
}

export function candidate2DTopologyDescriptor(
  state: Candidate2DWindingState,
): Candidate2DTopologyDescriptor {
  const configuration = state.configuration;
  const normals = normalizedSupportNormals(configuration.supportNormals);
  const oldest = state.ledges[0]!;
  const path = candidate2DLedgePathSegments(oldest, configuration);
  const sweeps = path.filter((segment) => segment.kind === 'sweep');
  const signedTurnRadians: number[] = [];
  const turnAnglesDegrees: number[] = [];
  for (let index = 1; index < sweeps.length; index += 1) {
    const previous = normalize(
      subtract(sweeps[index - 1]!.end, sweeps[index - 1]!.start),
    );
    const current = normalize(
      subtract(sweeps[index]!.end, sweeps[index]!.start),
    );
    const signedTurn = Math.atan2(
      cross(previous, current),
      dot(previous, current),
    );
    signedTurnRadians.push(signedTurn);
    turnAnglesDegrees.push((Math.abs(signedTurn) * 180) / Math.PI);
  }
  const outerPolygon = candidate2DPolygonFromSupports(
    configuration.supportNormals,
    configuration.initialSupportOffsets,
  );
  const openingPolygon = candidate2DPolygonFromSupports(
    configuration.supportNormals,
    oldest.currentSupportOffsets,
  );
  const outerCentroid = candidate2DPolygonCentroid(outerPolygon);
  const openingCentroid = candidate2DPolygonCentroid(openingPolygon);
  const completedWidths = configuration.terraceWidths.slice(
    0,
    oldest.turnOrdinal,
  );
  const principalAxisCount =
    dot(normals[0], normals[2]) < -0.94 && dot(normals[1], normals[3]) < -0.94
      ? 2
      : 4;
  const heads = candidate2DStepHeads(state);
  const openingDepthSteps = state.ledges.filter(
    (ledge) => ledge.integratedSweptArea > GEOMETRY_EPSILON,
  ).length;
  const baseSteps = 1;
  return {
    outerEdgeCount: outerPolygon.length,
    principalAxisCount,
    turnAnglesDegrees,
    signedTurnRadians,
    openingDepthSteps,
    openingDepthRatio: openingDepthSteps / (baseSteps + openingDepthSteps),
    terraceWidths: completedWidths,
    openingCenterOffsetRatio:
      distance(outerCentroid, openingCentroid) / polygonSpan(outerPolygon),
    activePartialFrontCount: heads.filter((head) => {
      const ledge = state.ledges[head.elevationIndex]!;
      const geometry = candidate2DActiveSweepGeometry(ledge, configuration);
      return (
        geometry !== null &&
        geometry.progressFraction > GEOMETRY_EPSILON &&
        geometry.progressFraction < 1 - GEOMETRY_EPSILON
      );
    }).length,
    pathClosed:
      path.length > 0 &&
      distance(path[0]!.start, path[path.length - 1]!.end) <= GEOMETRY_EPSILON,
    pathSelfIntersectionCount: selfIntersectionCount(path),
  };
}

function normalizedRange(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return (Math.max(...values) - Math.min(...values)) / Math.max(mean, 1e-12);
}

export function assessCandidate2DTopology(
  descriptor: Candidate2DTopologyDescriptor,
): Candidate2DTopologyAssessment {
  const reasons: Candidate2DTopologyRejectionReason[] = [];
  if (descriptor.outerEdgeCount !== 4) reasons.push('requires-four-edge-frame');
  if (descriptor.principalAxisCount !== 2) {
    reasons.push('requires-two-dominant-axes');
  }
  const rectilinearTurnFraction =
    descriptor.turnAnglesDegrees.length === 0
      ? 0
      : descriptor.turnAnglesDegrees.filter(
          (angle) => angle >= 70 && angle <= 110,
        ).length / descriptor.turnAnglesDegrees.length;
  if (
    descriptor.turnAnglesDegrees.length < 6 ||
    rectilinearTurnFraction < 0.8
  ) {
    reasons.push('insufficient-rectilinear-turns');
  }
  const signedTurnSum = descriptor.signedTurnRadians.reduce(
    (sum, turn) => sum + turn,
    0,
  );
  const nonzeroTurns = descriptor.signedTurnRadians.filter(
    (turn) => Math.abs(turn) > 1e-6,
  );
  const dominantSign = Math.sign(signedTurnSum);
  const sameSignFraction =
    nonzeroTurns.length === 0
      ? 0
      : nonzeroTurns.filter((turn) => Math.sign(turn) === dominantSign).length /
        nonzeroTurns.length;
  if (Math.abs(signedTurnSum) < 3 * Math.PI || sameSignFraction < 0.8) {
    reasons.push('inconsistent-winding');
  }
  if (descriptor.openingDepthSteps < 4 || descriptor.openingDepthRatio < 0.35) {
    reasons.push('opening-too-shallow');
  }
  if (descriptor.activePartialFrontCount < 1) {
    reasons.push('requires-partial-front');
  }
  if (descriptor.pathClosed) reasons.push('path-closes-into-rings');
  if (descriptor.pathSelfIntersectionCount > 0) {
    reasons.push('path-self-intersects');
  }
  if (
    normalizedRange(descriptor.terraceWidths) < 0.15 &&
    descriptor.openingCenterOffsetRatio < 0.05
  ) {
    reasons.push('symmetry-too-perfect');
  }
  return {
    classification:
      reasons.length === 0 ? 'target-topology-carrier' : 'rejected',
    acceptedMorphology: false,
    mechanismResolved: false,
    reasons,
    descriptor,
  };
}

export function assessCandidate2DWindingState(
  state: Candidate2DWindingState,
): Candidate2DTopologyAssessment {
  const areaFromPatches = state.ledges.reduce(
    (ledgeSum, ledge) =>
      ledgeSum +
      candidate2DLedgeSweepPatches(ledge, state.configuration).reduce(
        (patchSum, patch) => patchSum + patch.area,
        0,
      ),
    0,
  );
  const areaScale = Math.max(1, areaFromPatches, state.integratedSweptArea);
  if (
    Math.abs(areaFromPatches - state.integratedSweptArea) > 1e-10 * areaScale ||
    Math.abs(
      state.integratedSolidVolume -
        state.configuration.stepHeight * state.integratedSweptArea,
    ) >
      1e-12 * Math.max(1, state.integratedSolidVolume) ||
    Math.abs(
      state.releasedLatentHeat -
        state.configuration.latentHeatPerVolume * state.integratedSolidVolume,
    ) >
      1e-12 * Math.max(1, state.releasedLatentHeat)
  ) {
    throw new RangeError(
      'Candidate 2D swept area, volume, and latent ledgers must agree.',
    );
  }
  return assessCandidate2DTopology(candidate2DTopologyDescriptor(state));
}
