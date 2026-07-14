import type { GridShape } from './config';
import type { ScalarFieldSnapshot } from './scalar-field-snapshot';
import {
  candidate2DLedgeSweepPatches,
  candidate2DPolygonArea,
  candidate2DPolygonFromSupports,
  type Candidate2DFourValues,
  type Candidate2DSweepPatch,
  type Candidate2DVec2,
  type Candidate2DWindingState,
} from './candidate2d-winding-ledge';

export type Candidate2DMorphologyVec3 = readonly [number, number, number];

export interface Candidate2DMorphologyCarrierConfiguration {
  readonly shape: GridShape;
  readonly spacing: number;
  readonly physicalOrigin: Candidate2DMorphologyVec3;
  readonly observationalTransitionWidth: number;
  readonly baseBottomY: number;
  readonly baseTopY: number;
  readonly baseSupportOutsets: Candidate2DFourValues;
  readonly minimumClearanceCells: number;
  readonly maximumExtractionVertexCount: number;
}

const DEFAULT_SPACING = 1 / 12;

/**
 * Fixed extraction-only carrier for the first Candidate 2D winding proof.
 * Three samples resolve one physical step. None of these values feed back into
 * ledge motion or its swept-area and latent-energy ledgers.
 */
export const CANDIDATE2D_MORPHOLOGY_CARRIER = Object.freeze({
  shape: Object.freeze([211, 43, 211] as const),
  spacing: DEFAULT_SPACING,
  physicalOrigin: Object.freeze([-8.75, -2, -8.75] as const),
  observationalTransitionWidth: 0.125,
  baseBottomY: -1.5,
  baseTopY: 0,
  baseSupportOutsets: Object.freeze([0.65, 0.55, 0.75, 0.5] as const),
  minimumClearanceCells: 4,
  maximumExtractionVertexCount: 650_001,
}) satisfies Candidate2DMorphologyCarrierConfiguration;

interface PreparedHalfPlane {
  readonly normal: Candidate2DVec2;
  readonly support: number;
}

interface PreparedPatchPrism {
  readonly halfPlanes: readonly PreparedHalfPlane[];
  readonly lowerY: number;
  readonly upperY: number;
}

interface PreparedCarrier {
  readonly supportNormals: readonly Candidate2DVec2[];
  readonly topSupports: Candidate2DFourValues;
  readonly bottomSupports: Candidate2DFourValues;
  readonly patchPrisms: readonly PreparedPatchPrism[];
  readonly baseVolume: number;
}

const GEOMETRY_EPSILON = 1e-10;

function asFourValues(values: readonly number[]): Candidate2DFourValues {
  if (values.length !== 4) {
    throw new RangeError('Candidate 2D morphology requires four supports.');
  }
  return [
    values[0] ?? Number.NaN,
    values[1] ?? Number.NaN,
    values[2] ?? Number.NaN,
    values[3] ?? Number.NaN,
  ];
}

function dot(left: Candidate2DVec2, right: Candidate2DVec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function assertCarrierConfiguration(
  carrier: Candidate2DMorphologyCarrierConfiguration,
): void {
  if (
    carrier.shape.length !== 3 ||
    carrier.shape.some((size) => !Number.isSafeInteger(size) || size < 2)
  ) {
    throw new RangeError(
      'Candidate 2D morphology grid dimensions must be integers >= 2.',
    );
  }
  if (
    !Number.isFinite(carrier.spacing) ||
    carrier.spacing <= 0 ||
    !Number.isFinite(carrier.observationalTransitionWidth) ||
    carrier.observationalTransitionWidth <= 0 ||
    !Number.isFinite(carrier.baseBottomY) ||
    !Number.isFinite(carrier.baseTopY) ||
    carrier.baseBottomY >= carrier.baseTopY ||
    carrier.physicalOrigin.some((coordinate) => !Number.isFinite(coordinate))
  ) {
    throw new RangeError(
      'Candidate 2D morphology dimensions must be finite and positive.',
    );
  }
  if (
    carrier.baseSupportOutsets.some(
      (outset) => !Number.isFinite(outset) || outset <= 0,
    )
  ) {
    throw new RangeError(
      'Candidate 2D base support outsets must be finite and positive.',
    );
  }
  if (
    !Number.isSafeInteger(carrier.minimumClearanceCells) ||
    carrier.minimumClearanceCells < 1 ||
    !Number.isSafeInteger(carrier.maximumExtractionVertexCount) ||
    carrier.maximumExtractionVertexCount < 3 ||
    carrier.maximumExtractionVertexCount % 3 !== 0
  ) {
    throw new RangeError(
      'Candidate 2D extraction capacities must be positive integer cells and triangles.',
    );
  }
}

function assertStateHeader(state: Candidate2DWindingState): void {
  if (
    !Number.isSafeInteger(state.step) ||
    state.step < 0 ||
    !Number.isFinite(state.time) ||
    state.time < 0 ||
    !Number.isFinite(state.integratedSweptArea) ||
    state.integratedSweptArea < 0 ||
    !Number.isFinite(state.integratedSolidVolume) ||
    state.integratedSolidVolume < 0 ||
    !Number.isFinite(state.releasedLatentHeat) ||
    state.releasedLatentHeat < 0
  ) {
    throw new RangeError(
      'Candidate 2D morphology state and ledgers must be finite and nonnegative.',
    );
  }
  for (const normal of state.configuration.supportNormals) {
    const length = Math.hypot(normal[0], normal[1]);
    if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-10) {
      throw new RangeError(
        'Candidate 2D morphology support normals must be unit vectors.',
      );
    }
  }
}

function signedDoubledArea(vertices: readonly Candidate2DVec2[]): number {
  let doubledArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    doubledArea += current[0] * next[1] - current[1] * next[0];
  }
  return doubledArea;
}

function preparePolygonHalfPlanes(
  vertices: readonly Candidate2DVec2[],
): readonly PreparedHalfPlane[] {
  const doubledArea = signedDoubledArea(vertices);
  if (
    vertices.length < 3 ||
    !Number.isFinite(doubledArea) ||
    Math.abs(doubledArea) <= GEOMETRY_EPSILON
  ) {
    throw new RangeError(
      'Candidate 2D swept patches must have finite positive area.',
    );
  }
  const orientation = Math.sign(doubledArea);
  return vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length]!;
    const edgeX = end[0] - start[0];
    const edgeZ = end[1] - start[1];
    const edgeLength = Math.hypot(edgeX, edgeZ);
    if (!Number.isFinite(edgeLength) || edgeLength <= GEOMETRY_EPSILON) {
      throw new RangeError(
        'Candidate 2D swept patches cannot contain zero-length edges.',
      );
    }
    const normal = [
      (orientation * edgeZ) / edgeLength,
      (-orientation * edgeX) / edgeLength,
    ] as const;
    return { normal, support: dot(normal, start) };
  });
}

function assertPatchInsideTop(
  patch: Candidate2DSweepPatch,
  supportNormals: readonly Candidate2DVec2[],
  topSupports: Candidate2DFourValues,
): void {
  const area = candidate2DPolygonArea(patch.vertices);
  const areaScale = Math.max(1, area, patch.area);
  if (
    patch.vertices.length < 3 ||
    !Number.isFinite(patch.area) ||
    patch.area <= GEOMETRY_EPSILON ||
    Math.abs(area - patch.area) > 1e-10 * areaScale
  ) {
    throw new RangeError(
      'Candidate 2D morphology patch area must match its polygon.',
    );
  }
  for (const vertex of patch.vertices) {
    if (
      !vertex.every(Number.isFinite) ||
      supportNormals.some(
        (normal, index) =>
          dot(normal, vertex) - (topSupports[index] ?? Number.NaN) >
          GEOMETRY_EPSILON,
      )
    ) {
      throw new RangeError(
        'Candidate 2D morphology patches must remain inside the top footprint.',
      );
    }
  }
}

function supportsAtFraction(
  topSupports: Candidate2DFourValues,
  baseOutsets: Candidate2DFourValues,
  bottomFraction: number,
): Candidate2DFourValues {
  return asFourValues(
    topSupports.map(
      (support, index) =>
        support + bottomFraction * (baseOutsets[index] ?? Number.NaN),
    ),
  );
}

function analyticBaseVolume(
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration,
): number {
  const topSupports = asFourValues(state.configuration.initialSupportOffsets);
  const bottomSupports = supportsAtFraction(
    topSupports,
    carrier.baseSupportOutsets,
    1,
  );
  const middleSupports = supportsAtFraction(
    topSupports,
    carrier.baseSupportOutsets,
    0.5,
  );
  const normals = state.configuration.supportNormals;
  const bottomArea = candidate2DPolygonArea(
    candidate2DPolygonFromSupports(normals, bottomSupports),
  );
  const middleArea = candidate2DPolygonArea(
    candidate2DPolygonFromSupports(normals, middleSupports),
  );
  const topArea = candidate2DPolygonArea(
    candidate2DPolygonFromSupports(normals, topSupports),
  );
  const height = carrier.baseTopY - carrier.baseBottomY;

  // Fixed normals and linearly varying supports make area quadratic in y, so
  // Simpson integration is exact for this four-plane frustum.
  return (height * (bottomArea + 4 * middleArea + topArea)) / 6;
}

function assertDomainClearance(
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration,
  bottomSupports: Candidate2DFourValues,
  patchPrisms: readonly PreparedPatchPrism[],
): void {
  const bottomPolygon = candidate2DPolygonFromSupports(
    state.configuration.supportNormals,
    bottomSupports,
  );
  const minimumX = Math.min(...bottomPolygon.map((vertex) => vertex[0]));
  const maximumX = Math.max(...bottomPolygon.map((vertex) => vertex[0]));
  const minimumZ = Math.min(...bottomPolygon.map((vertex) => vertex[1]));
  const maximumZ = Math.max(...bottomPolygon.map((vertex) => vertex[1]));
  const domainMaximum: Candidate2DMorphologyVec3 = [
    carrier.physicalOrigin[0] + (carrier.shape[0] - 1) * carrier.spacing,
    carrier.physicalOrigin[1] + (carrier.shape[1] - 1) * carrier.spacing,
    carrier.physicalOrigin[2] + (carrier.shape[2] - 1) * carrier.spacing,
  ];
  const maximumY = patchPrisms.reduce(
    (maximum, patch) => Math.max(maximum, patch.upperY),
    carrier.baseTopY,
  );
  const clearance = carrier.minimumClearanceCells * carrier.spacing;
  if (
    minimumX - carrier.physicalOrigin[0] < clearance ||
    domainMaximum[0] - maximumX < clearance ||
    carrier.baseBottomY - carrier.physicalOrigin[1] < clearance ||
    domainMaximum[1] - maximumY < clearance ||
    minimumZ - carrier.physicalOrigin[2] < clearance ||
    domainMaximum[2] - maximumZ < clearance
  ) {
    throw new RangeError(
      'Candidate 2D morphology violates the fixed extraction clearance.',
    );
  }
}

function prepareCarrier(
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration,
): PreparedCarrier {
  assertCarrierConfiguration(carrier);
  assertStateHeader(state);
  const supportNormals = state.configuration.supportNormals;
  const topSupports = asFourValues(state.configuration.initialSupportOffsets);
  const bottomSupports = supportsAtFraction(
    topSupports,
    carrier.baseSupportOutsets,
    1,
  );
  const patchPrisms: PreparedPatchPrism[] = [];
  let patchArea = 0;

  state.ledges.forEach((ledge, ledgeIndex) => {
    if (ledge.elevationIndex !== ledgeIndex) {
      throw new RangeError(
        'Candidate 2D ledge elevations must be contiguous and zero-based.',
      );
    }
    const patches = candidate2DLedgeSweepPatches(ledge, state.configuration);
    let ledgePatchArea = 0;
    for (const patch of patches) {
      if (patch.elevationIndex !== ledge.elevationIndex) {
        throw new RangeError(
          'Candidate 2D patch elevation must match its ledge.',
        );
      }
      assertPatchInsideTop(patch, supportNormals, topSupports);
      patchArea += patch.area;
      ledgePatchArea += patch.area;
      const lowerY =
        carrier.baseTopY +
        patch.elevationIndex * state.configuration.stepHeight;
      patchPrisms.push({
        halfPlanes: preparePolygonHalfPlanes(patch.vertices),
        lowerY,
        upperY: lowerY + state.configuration.stepHeight,
      });
    }
    const ledgeAreaScale = Math.max(
      1,
      ledgePatchArea,
      ledge.integratedSweptArea,
    );
    const ledgeVolume = ledgePatchArea * state.configuration.stepHeight;
    const ledgeLatent = ledgeVolume * state.configuration.latentHeatPerVolume;
    if (
      Math.abs(ledgePatchArea - ledge.integratedSweptArea) >
        1e-10 * ledgeAreaScale ||
      Math.abs(ledgeVolume - ledge.integratedSolidVolume) >
        1e-12 * Math.max(1, ledgeVolume, ledge.integratedSolidVolume) ||
      Math.abs(ledgeLatent - ledge.releasedLatentHeat) >
        1e-12 * Math.max(1, ledgeLatent, ledge.releasedLatentHeat)
    ) {
      throw new RangeError(
        'Candidate 2D ledge patches disagree with the area, volume, or latent ledger.',
      );
    }
  });

  const areaScale = Math.max(1, patchArea, state.integratedSweptArea);
  const volumeFromPatches = patchArea * state.configuration.stepHeight;
  const volumeScale = Math.max(
    1,
    volumeFromPatches,
    state.integratedSolidVolume,
  );
  const latentFromPatches =
    state.configuration.latentHeatPerVolume * volumeFromPatches;
  const latentScale = Math.max(1, latentFromPatches, state.releasedLatentHeat);
  if (
    Math.abs(patchArea - state.integratedSweptArea) > 1e-10 * areaScale ||
    Math.abs(volumeFromPatches - state.integratedSolidVolume) >
      1e-12 * volumeScale ||
    Math.abs(latentFromPatches - state.releasedLatentHeat) > 1e-12 * latentScale
  ) {
    throw new RangeError(
      'Candidate 2D morphology patches, volume, and latent ledgers disagree.',
    );
  }

  assertDomainClearance(state, carrier, bottomSupports, patchPrisms);
  return {
    supportNormals,
    topSupports,
    bottomSupports,
    patchPrisms,
    baseVolume: analyticBaseVolume(state, carrier),
  };
}

function polygonLevel(
  halfPlanes: readonly PreparedHalfPlane[],
  point: Candidate2DVec2,
): number {
  return halfPlanes.reduce(
    (level, plane) => Math.max(level, dot(plane.normal, point) - plane.support),
    Number.NEGATIVE_INFINITY,
  );
}

function morphologyLevelPrepared(
  carrier: Candidate2DMorphologyCarrierConfiguration,
  prepared: PreparedCarrier,
  position: Candidate2DMorphologyVec3,
): number {
  const point = [position[0], position[2]] as const;
  const baseFraction = clamp(
    (carrier.baseTopY - position[1]) / (carrier.baseTopY - carrier.baseBottomY),
    0,
    1,
  );
  const baseSupports = supportsAtFraction(
    prepared.topSupports,
    carrier.baseSupportOutsets,
    baseFraction,
  );
  const sideLevel = prepared.supportNormals.reduce(
    (level, normal, index) =>
      Math.max(level, dot(normal, point) - (baseSupports[index] ?? Number.NaN)),
    Number.NEGATIVE_INFINITY,
  );
  let level = Math.max(
    sideLevel,
    carrier.baseBottomY - position[1],
    position[1] - carrier.baseTopY,
  );

  for (const patch of prepared.patchPrisms) {
    const patchLevel = Math.max(
      polygonLevel(patch.halfPlanes, point),
      patch.lowerY - position[1],
      position[1] - patch.upperY,
    );
    level = Math.min(level, patchLevel);
  }
  return level;
}

/** Negative is solid and positive is liquid. */
export function candidate2DMorphologyLevel(
  state: Candidate2DWindingState,
  position: Candidate2DMorphologyVec3,
  carrier: Candidate2DMorphologyCarrierConfiguration = CANDIDATE2D_MORPHOLOGY_CARRIER,
): number {
  if (!position.every(Number.isFinite)) {
    throw new RangeError(
      'Candidate 2D morphology sample position must be finite.',
    );
  }
  const prepared = prepareCarrier(state, carrier);
  return morphologyLevelPrepared(carrier, prepared, position);
}

function observationalValueFromLevel(
  level: number,
  carrier: Candidate2DMorphologyCarrierConfiguration,
): number {
  return clamp((-2 * level) / carrier.observationalTransitionWidth, -1, 1);
}

export function sampleCandidate2DMorphology(
  state: Candidate2DWindingState,
  position: Candidate2DMorphologyVec3,
  carrier: Candidate2DMorphologyCarrierConfiguration = CANDIDATE2D_MORPHOLOGY_CARRIER,
): number {
  return observationalValueFromLevel(
    candidate2DMorphologyLevel(state, position, carrier),
    carrier,
  );
}

export function candidate2DMorphologyAnalyticBaseVolume(
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration = CANDIDATE2D_MORPHOLOGY_CARRIER,
): number {
  assertCarrierConfiguration(carrier);
  assertStateHeader(state);
  return analyticBaseVolume(state, carrier);
}

export function candidate2DMorphologyAnalyticTotalVolume(
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration = CANDIDATE2D_MORPHOLOGY_CARRIER,
): number {
  const prepared = prepareCarrier(state, carrier);
  return prepared.baseVolume + state.integratedSolidVolume;
}

export function createCandidate2DMorphologySnapshot(
  state: Candidate2DWindingState,
  carrier: Candidate2DMorphologyCarrierConfiguration = CANDIDATE2D_MORPHOLOGY_CARRIER,
): ScalarFieldSnapshot {
  const prepared = prepareCarrier(state, carrier);
  const shape = carrier.shape;
  const voxelCount = shape[0] * shape[1] * shape[2];
  const orderParameter = new Float32Array(voxelCount);

  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        const index = x + shape[0] * (y + shape[1] * z);
        const position: Candidate2DMorphologyVec3 = [
          carrier.physicalOrigin[0] + x * carrier.spacing,
          carrier.physicalOrigin[1] + y * carrier.spacing,
          carrier.physicalOrigin[2] + z * carrier.spacing,
        ];
        orderParameter[index] = observationalValueFromLevel(
          morphologyLevelPrepared(carrier, prepared, position),
          carrier,
        );
      }
    }
  }

  return {
    shape,
    voxelCount,
    orderParameter,
    step: state.step,
    simulatedTime: state.time,
  };
}
