import {
  CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION,
  candidate2AFreeSurfaceBiotNumber,
  type Candidate2AFreeSurfaceBoundary,
} from './candidate2a';
import {
  CANDIDATE2C_FACETED_ISOLATION,
  candidate2CFacetedLoopPolygon,
  createCandidate2CFacetedFrame,
  type Candidate2CFacetedConfiguration,
  type Candidate2CFacetedFrame,
  type Candidate2CFacetedVec2,
} from './candidate2c-faceted';
import { candidate2CNucleationVelocity } from './candidate2c';
import type { GridShape } from './config';

export type Candidate2CFacetedThermalArmName = 'equal' | 'forward' | 'reverse';

export type Candidate2CFacetedThermalClassification =
  | 'invalid'
  | 'equal-source-not-null'
  | 'contrast-reversal-failure'
  | 'ledger-failure'
  | 'topology-failure'
  | 'refinement-failure'
  | 'passes-reduced-coupling';

export interface Candidate2CFacetedThermalConfiguration extends Candidate2CFacetedConfiguration {
  readonly shape: GridShape;
  readonly spacing: number;
  readonly thermalDiffusivity: number;
  readonly initialTemperature: number;
  readonly edgeBandWidth: number;
  readonly centerXZ: readonly [number, number];
  readonly freeSurface: Candidate2AFreeSurfaceBoundary;
}

interface Candidate2CFacetedThermalSurfaceGeometry {
  readonly solidAreaByCell: Float64Array;
  readonly solidBandAreaByCell: Float64Array;
  readonly liquidBandAreaByCell: Float64Array;
  readonly solidArea: number;
  readonly solidBandArea: number;
  readonly liquidBandArea: number;
  readonly maximumCoverageRelativeError: number;
}

export interface DerivedCandidate2CFacetedThermalConfiguration extends Candidate2CFacetedThermalConfiguration {
  readonly frame: Candidate2CFacetedFrame;
  readonly voxelCount: number;
  readonly surfaceCellCount: number;
  readonly cellVolume: number;
  readonly faceArea: number;
  readonly domainSize: readonly [number, number, number];
  /** Fixed depth of the closed thermal control volume, not a fitted depth. */
  readonly thermalDomainDepth: number;
  readonly maximumStableTimeStep: number;
  readonly maximumStepCourant: number;
  readonly edgeBandCells: number;
  readonly facetInradiusCells: number;
  readonly promotableResolution: boolean;
  readonly surfaceGeometry: Candidate2CFacetedThermalSurfaceGeometry;
}

export interface Candidate2CFacetedThermalBirthEvent {
  readonly ordinal: number;
  readonly time: number;
  readonly bracketStart: number;
  readonly bracketEnd: number;
}

export interface Candidate2CFacetedThermalState {
  readonly configuration: DerivedCandidate2CFacetedThermalConfiguration;
  readonly temperature: Float64Array;
  /** Oldest/innermost first; offsets are strictly descending while valid. */
  readonly activeLoopOffsets: readonly number[];
  readonly completedLayers: number;
  readonly nucleationAccumulator: number;
  readonly emittedLayers: number;
  readonly birthEvents: readonly Candidate2CFacetedThermalBirthEvent[];
  readonly lastLayerBirthRate: number;
  readonly integratedSolidVolume: number;
  readonly rasterizedSolidVolume: number;
  /** Exact swept volume distributed through the 3D prism cells. */
  readonly solidVolumeByCell: Float64Array;
  readonly maximumLocalSolidHeight: number;
  readonly cumulativeExternalHeat: number;
  readonly cumulativeLatentHeat: number;
  readonly initialThermalEnergy: number;
  readonly maximumEnergyRelativeResidual: number;
  readonly maximumRasterGeometryRelativeError: number;
  readonly loopCrossingDetected: boolean;
  readonly time: number;
  readonly step: number;
}

export interface Candidate2CFacetedThermalLedger {
  readonly thermalEnergy: number;
  readonly expectedThermalEnergy: number;
  readonly residual: number;
  readonly scale: number;
  readonly normalizedResidual: number;
  readonly analyticSolidVolume: number;
  readonly rasterizedSolidVolume: number;
  readonly rasterGeometryRelativeError: number;
  readonly expectedLatentHeat: number;
  readonly latentResidual: number;
}

export interface Candidate2CFacetedThermalCheckpoint {
  readonly step: number;
  readonly time: number;
  readonly solidEdgeTemperature: number;
  readonly liquidEdgeTemperature: number;
  /** U_liquid - U_solid across the fixed W bands; diagnostic only. */
  readonly edgeContrast: number;
  readonly contactLineTemperature: number;
  readonly contactLineUndercooling: number;
  /** q_solid - q_liquid; its sign selects the outer solid step source. */
  readonly surfaceFluxJump: number;
  readonly activeLoopOffsets: readonly number[];
  readonly activeTerraceCount: number;
  readonly resolvedTerraceCount: number;
  readonly completedLayers: number;
  readonly emittedLayers: number;
  /** Continuous deterministic layer clock: emitted + fractional phase. */
  readonly layerPhase: number;
  readonly openingDepth: number;
  readonly maximumLocalSolidHeight: number;
  readonly cumulativeExternalHeat: number;
  readonly cumulativeLatentHeat: number;
  readonly ledger: Candidate2CFacetedThermalLedger;
}

export interface Candidate2CFacetedThermalArmResult {
  readonly finalState: Candidate2CFacetedThermalState;
  readonly checkpoints: readonly Candidate2CFacetedThermalCheckpoint[];
}

export interface Candidate2CFacetedThermalOddEven {
  readonly equal: number;
  readonly forward: number;
  readonly reverse: number;
  readonly odd: number;
  readonly even: number;
}

export interface Candidate2CFacetedThermalComparison {
  readonly step: number;
  readonly time: number;
  readonly edgeContrast: Candidate2CFacetedThermalOddEven;
  readonly surfaceFluxJump: Candidate2CFacetedThermalOddEven;
}

export interface Candidate2CFacetedThermalRefinement {
  readonly topologyMatches: boolean;
  readonly birthCountsCompatible: boolean;
  readonly strictTopologyBoth: boolean;
  readonly maximumLayerPhaseDifference: number;
  readonly maximumBirthTimeDifference: number;
  readonly edgeContrastDifference: number;
  readonly contactLineTemperatureDifference: number;
  readonly surfaceFluxJumpDifference: number;
  readonly externalHeatDifference: number;
  readonly latentHeatDifference: number;
  readonly solidVolumeDifference: number;
  readonly maximumLoopOffsetDifference: number;
  readonly maximumDifference: number;
}

export interface Candidate2CFacetedThermalGates {
  readonly finite: boolean;
  readonly stableAndCourantSafe: boolean;
  readonly surfaceGeometryResolved: boolean;
  readonly promotableResolution: boolean;
  readonly equalSourceNull: boolean;
  readonly contrastReverses: boolean;
  readonly energyLedgersClose: boolean;
  readonly rasterAndGeometryLedgersClose: boolean;
  readonly nestedTopologyPasses: boolean;
  readonly timeRefinementPasses: boolean;
  readonly spaceRefinementPasses: boolean;
}

export interface Candidate2CFacetedThermalDiagnosticResult {
  readonly classification: Candidate2CFacetedThermalClassification;
  readonly arms: Readonly<
    Record<Candidate2CFacetedThermalArmName, Candidate2CFacetedThermalArmResult>
  >;
  readonly timeRefinedForward: Candidate2CFacetedThermalArmResult;
  readonly spaceRefinedForward: Candidate2CFacetedThermalArmResult;
  readonly comparisons: readonly Candidate2CFacetedThermalComparison[];
  readonly timeRefinement: Candidate2CFacetedThermalRefinement;
  readonly spaceRefinement: Candidate2CFacetedThermalRefinement;
  readonly gates: Candidate2CFacetedThermalGates;
}

export type Candidate2CFacetedThermalRobinRefinementClassification =
  'passes-first-order-isolation' | 'fails-robin-refinement';

export interface Candidate2CFacetedThermalRobinRefinementSample {
  readonly spacing: number;
  readonly contactLineTemperature: number;
  readonly surfaceFluxJump: number;
  readonly continuumFluxError: number;
}

export interface Candidate2CFacetedThermalRobinRefinementGates {
  readonly equalSourceNull: boolean;
  readonly contrastReverses: boolean;
  readonly monotoneConvergence: boolean;
  readonly successiveErrorReductionPasses: boolean;
  readonly refinedPairPasses: boolean;
  readonly fineContinuumPasses: boolean;
}

export interface Candidate2CFacetedThermalRobinRefinementResult {
  readonly classification: Candidate2CFacetedThermalRobinRefinementClassification;
  readonly samples: readonly Candidate2CFacetedThermalRobinRefinementSample[];
  readonly continuumContactLineTemperature: number;
  readonly continuumSurfaceFluxJump: number;
  readonly coarseToMediumFluxDifference: number;
  readonly mediumToFineFluxDifference: number;
  readonly fineContinuumFluxDifference: number;
  readonly successiveErrorReductionRatios: readonly [number, number];
  readonly equalSurfaceFluxJump: number;
  readonly reverseSurfaceFluxJump: number;
  readonly gates: Candidate2CFacetedThermalRobinRefinementGates;
}

const BASE_SHAPE = Object.freeze([80, 48, 80] as const);
const BASE_SPACING = 0.375;
const BASE_CENTER_XZ = Object.freeze([15, 15] as const);
const EDGE_BAND_WIDTH = 1.5;
const INITIAL_TEMPERATURE = 0;
const AMBIENT_TEMPERATURE = -1.5;
const EQUAL_BIOT_NUMBER =
  (CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.liquidBiotNumber +
    CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.solidBiotNumber) /
  2;

/** Fixed before running the faceted thermal-prism discriminator. */
export const CANDIDATE2C_FACETED_THERMAL_ISOLATION = Object.freeze({
  ...CANDIDATE2C_FACETED_ISOLATION,
  shape: BASE_SHAPE,
  spacing: BASE_SPACING,
  timeStep: 0.0025,
  thermalDiffusivity: 1,
  initialTemperature: INITIAL_TEMPERATURE,
  edgeBandWidth: EDGE_BAND_WIDTH,
  centerXZ: BASE_CENTER_XZ,
  nucleationPrefactor: 2,
  nucleationBarrier: 0.1,
  freeSurface: {
    enabled: true,
    biotNumber: CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.liquidBiotNumber,
    solidBiotNumber: CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.solidBiotNumber,
    ambientTemperature: AMBIENT_TEMPERATURE,
  },
}) satisfies Candidate2CFacetedThermalConfiguration;

/** Numeric envelopes declared before the first coupled evaluation. */
export const CANDIDATE2C_FACETED_THERMAL_GATES = Object.freeze({
  evaluationTime: 1.5,
  checkpointTimes: Object.freeze([0.1, 0.25, 0.5, 1, 1.5] as const),
  maximumStableFraction: 0.8,
  maximumStepCourant: 0.25,
  maximumEqualContrast: 1e-10,
  minimumReversedContrast: 0.01,
  maximumEvenToOddRatio: 0.25,
  maximumEnergyRelativeError: 1e-10,
  maximumRasterGeometryRelativeError: 1e-10,
  minimumActiveTerraces: 2,
  minimumResolvedTerraces: 2,
  minimumOpeningDepthInSteps: 2,
  maximumTimeRefinementDifference: 0.05,
  maximumSpaceRefinementDifference: 0.15,
  minimumEdgeBandCells: 4,
  minimumFacetInradiusCells: 10,
  resolvedOffsetCutoff: BASE_SPACING,
  maximumLayerPhaseDifference: 0.15,
});

/** Fixed before the three-spacing Robin face result is evaluated. */
export const CANDIDATE2C_FACETED_THERMAL_ROBIN_REFINEMENT = Object.freeze({
  spacings: Object.freeze([0.375, 0.1875, 0.09375] as const),
  screenMaximumContinuousDifference: 0.15,
  minimumSuccessiveErrorReductionRatio: 1.5,
  maximumRefinedPairFluxDifference: 0.1,
  maximumFineContinuumFluxDifference: 0.1,
});

type Point2 = readonly [number, number];

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

function surfaceIndex(x: number, z: number, width: number): number {
  return x + width * z;
}

function volumeIndex(
  x: number,
  y: number,
  z: number,
  shape: GridShape,
): number {
  return x + shape[0] * (y + shape[1] * z);
}

function linearCellTraceUnchecked(
  field: Float64Array,
  shape: GridShape,
  spacing: number,
  x: number,
  y: number,
  z: number,
  point: readonly [number, number, number],
): number {
  const centerIndex = volumeIndex(x, y, z, shape);
  const center = field[centerIndex] ?? Number.NaN;
  const coordinates = [x, y, z] as const;
  const gradient = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    const axisSize = shape[axis] ?? 0;
    if (axisSize === 1) continue;
    const coordinate = coordinates[axis] ?? 0;
    const lower = [x, y, z];
    const upper = [x, y, z];
    if (coordinate > 0 && coordinate + 1 < axisSize) {
      lower[axis] = coordinate - 1;
      upper[axis] = coordinate + 1;
      gradient[axis] =
        ((field[volumeIndex(lower[0]!, lower[1]!, lower[2]!, shape)] ??
          Number.NaN) -
          (field[volumeIndex(upper[0]!, upper[1]!, upper[2]!, shape)] ??
            Number.NaN)) /
        (-2 * spacing);
    } else if (coordinate + 1 < axisSize) {
      upper[axis] = coordinate + 1;
      gradient[axis] =
        ((field[volumeIndex(upper[0]!, upper[1]!, upper[2]!, shape)] ??
          Number.NaN) -
          center) /
        spacing;
    } else {
      lower[axis] = coordinate - 1;
      gradient[axis] =
        (center -
          (field[volumeIndex(lower[0]!, lower[1]!, lower[2]!, shape)] ??
            Number.NaN)) /
        spacing;
    }
  }
  return (
    center +
    (gradient[0] ?? Number.NaN) * (point[0] - (x + 0.5) * spacing) +
    (gradient[1] ?? Number.NaN) * (point[1] - (y + 0.5) * spacing) +
    (gradient[2] ?? Number.NaN) * (point[2] - (z + 0.5) * spacing)
  );
}

/** Linear FV trace used by the cut-cell perimeter and step-front quadrature. */
export function candidate2CFacetedThermalLinearCellTrace(
  field: Float64Array,
  shape: GridShape,
  spacing: number,
  cell: readonly [number, number, number],
  point: readonly [number, number, number],
): number {
  assertFinitePositive('spacing', spacing);
  if (field.length !== shape[0] * shape[1] * shape[2]) {
    throw new RangeError('field length must match shape.');
  }
  for (let axis = 0; axis < 3; axis += 1) {
    const coordinate = cell[axis] ?? -1;
    const axisSize = shape[axis] ?? 0;
    if (
      !Number.isInteger(coordinate) ||
      coordinate < 0 ||
      coordinate >= axisSize
    ) {
      throw new RangeError('cell must lie inside shape.');
    }
    const minimum = coordinate * spacing;
    const maximum = (coordinate + 1) * spacing;
    if (
      !Number.isFinite(point[axis]) ||
      (point[axis] ?? Number.NaN) < minimum ||
      (point[axis] ?? Number.NaN) > maximum
    ) {
      throw new RangeError('point must lie inside cell.');
    }
  }
  return linearCellTraceUnchecked(
    field,
    shape,
    spacing,
    cell[0],
    cell[1],
    cell[2],
    point,
  );
}

function polygonArea(vertices: readonly Point2[]): number {
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index] ?? [Number.NaN, Number.NaN];
    const next = vertices[(index + 1) % vertices.length] ?? [
      Number.NaN,
      Number.NaN,
    ];
    twiceArea += current[0] * next[1] - current[1] * next[0];
  }
  return Math.abs(twiceArea) / 2;
}

function clipPolygon(
  vertices: readonly Point2[],
  axis: 0 | 1,
  boundary: number,
  keepGreater: boolean,
): Point2[] {
  if (vertices.length === 0) return [];
  const clipped: Point2[] = [];
  const inside = (point: Point2) =>
    keepGreater ? point[axis] >= boundary : point[axis] <= boundary;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index] ?? [Number.NaN, Number.NaN];
    const end = vertices[(index + 1) % vertices.length] ?? [
      Number.NaN,
      Number.NaN,
    ];
    const startInside = inside(start);
    const endInside = inside(end);
    if (startInside) clipped.push(start);
    if (startInside === endInside) continue;
    const denominator = end[axis] - start[axis];
    const fraction = (boundary - start[axis]) / denominator;
    clipped.push([
      start[0] + fraction * (end[0] - start[0]),
      start[1] + fraction * (end[1] - start[1]),
    ]);
  }
  return clipped;
}

function polygonRectangleIntersectionArea(
  vertices: readonly Point2[],
  minimumX: number,
  maximumX: number,
  minimumZ: number,
  maximumZ: number,
): number {
  let clipped = clipPolygon(vertices, 0, minimumX, true);
  clipped = clipPolygon(clipped, 0, maximumX, false);
  clipped = clipPolygon(clipped, 1, minimumZ, true);
  clipped = clipPolygon(clipped, 1, maximumZ, false);
  return polygonArea(clipped);
}

function worldPolygon(
  frame: Candidate2CFacetedFrame,
  centerXZ: readonly [number, number],
  vertices: readonly Candidate2CFacetedVec2[],
  scale = 1,
): Point2[] {
  return vertices.map((vertex) => [
    centerXZ[0] +
      scale * (vertex[0] * frame.tangentU[0] + vertex[1] * frame.tangentV[0]),
    centerXZ[1] +
      scale * (vertex[0] * frame.tangentU[2] + vertex[1] * frame.tangentV[2]),
  ]);
}

function polygonCellAreas(
  vertices: readonly Point2[],
  shape: GridShape,
  spacing: number,
): Float64Array {
  const [width, , depth] = shape;
  const areas = new Float64Array(width * depth);
  const minimumX = Math.min(...vertices.map((point) => point[0]));
  const maximumX = Math.max(...vertices.map((point) => point[0]));
  const minimumZ = Math.min(...vertices.map((point) => point[1]));
  const maximumZ = Math.max(...vertices.map((point) => point[1]));
  const firstX = Math.max(0, Math.floor(minimumX / spacing));
  const lastX = Math.min(width - 1, Math.floor(maximumX / spacing));
  const firstZ = Math.max(0, Math.floor(minimumZ / spacing));
  const lastZ = Math.min(depth - 1, Math.floor(maximumZ / spacing));
  for (let z = firstZ; z <= lastZ; z += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      areas[surfaceIndex(x, z, width)] = polygonRectangleIntersectionArea(
        vertices,
        x * spacing,
        (x + 1) * spacing,
        z * spacing,
        (z + 1) * spacing,
      );
    }
  }
  return areas;
}

function sumArray(values: Float64Array): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum;
}

function subtractAreas(outer: Float64Array, inner: Float64Array): Float64Array {
  const result = new Float64Array(outer.length);
  for (let index = 0; index < result.length; index += 1) {
    const difference =
      (outer[index] ?? Number.NaN) - (inner[index] ?? Number.NaN);
    result[index] = Math.max(0, difference);
  }
  return result;
}

function relativeError(left: number, right: number): number {
  return Math.abs(left - right) / Math.max(1, Math.abs(left), Math.abs(right));
}

function createSurfaceGeometry(
  configuration: Candidate2CFacetedThermalConfiguration,
  frame: Candidate2CFacetedFrame,
): Candidate2CFacetedThermalSurfaceGeometry {
  const outerVertices = worldPolygon(
    frame,
    configuration.centerXZ,
    frame.outerPolygon.vertices,
  );
  const innerPolygon = candidate2CFacetedLoopPolygon(
    frame,
    configuration.edgeBandWidth,
  );
  const innerVertices = worldPolygon(
    frame,
    configuration.centerXZ,
    innerPolygon.vertices,
  );
  const expandedScale =
    (configuration.facetInradius + configuration.edgeBandWidth) /
    configuration.facetInradius;
  const expandedVertices = worldPolygon(
    frame,
    configuration.centerXZ,
    frame.outerPolygon.vertices,
    expandedScale,
  );
  const solidAreaByCell = polygonCellAreas(
    outerVertices,
    configuration.shape,
    configuration.spacing,
  );
  const innerAreaByCell = polygonCellAreas(
    innerVertices,
    configuration.shape,
    configuration.spacing,
  );
  const expandedAreaByCell = polygonCellAreas(
    expandedVertices,
    configuration.shape,
    configuration.spacing,
  );
  const solidBandAreaByCell = subtractAreas(solidAreaByCell, innerAreaByCell);
  const liquidBandAreaByCell = subtractAreas(
    expandedAreaByCell,
    solidAreaByCell,
  );
  const solidArea = sumArray(solidAreaByCell);
  const solidBandArea = sumArray(solidBandAreaByCell);
  const liquidBandArea = sumArray(liquidBandAreaByCell);
  const exactSolidArea = frame.outerPolygon.area;
  const exactSolidBandArea = exactSolidArea - innerPolygon.area;
  const exactExpandedArea = exactSolidArea * expandedScale ** 2;
  const exactLiquidBandArea = exactExpandedArea - exactSolidArea;
  return {
    solidAreaByCell,
    solidBandAreaByCell,
    liquidBandAreaByCell,
    solidArea,
    solidBandArea,
    liquidBandArea,
    maximumCoverageRelativeError: Math.max(
      relativeError(solidArea, exactSolidArea),
      relativeError(solidBandArea, exactSolidBandArea),
      relativeError(liquidBandArea, exactLiquidBandArea),
    ),
  };
}

export function candidate2CFacetedThermalBoundaryForArm(
  arm: Candidate2CFacetedThermalArmName,
): Candidate2AFreeSurfaceBoundary {
  if (arm === 'equal') {
    return {
      enabled: true,
      biotNumber: EQUAL_BIOT_NUMBER,
      solidBiotNumber: EQUAL_BIOT_NUMBER,
      ambientTemperature: AMBIENT_TEMPERATURE,
    };
  }
  const forward = arm === 'forward';
  return {
    enabled: true,
    biotNumber: forward
      ? CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.liquidBiotNumber
      : CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.solidBiotNumber,
    solidBiotNumber: forward
      ? CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.solidBiotNumber
      : CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.liquidBiotNumber,
    ambientTemperature: AMBIENT_TEMPERATURE,
  };
}

export function deriveCandidate2CFacetedThermalConfiguration(
  configuration: Candidate2CFacetedThermalConfiguration,
): DerivedCandidate2CFacetedThermalConfiguration {
  if (
    configuration.shape.length !== 3 ||
    configuration.shape.some((size) => !Number.isInteger(size) || size < 2)
  ) {
    throw new RangeError('shape must contain three integers >= 2.');
  }
  for (const [name, value] of [
    ['spacing', configuration.spacing],
    ['timeStep', configuration.timeStep],
    ['thermalDiffusivity', configuration.thermalDiffusivity],
    ['facetInradius', configuration.facetInradius],
    ['stepHeight', configuration.stepHeight],
    ['birthInwardOffset', configuration.birthInwardOffset],
    ['stepKineticCoefficient', configuration.stepKineticCoefficient],
    ['latentHeatPerVolume', configuration.latentHeatPerVolume],
    ['edgeBandWidth', configuration.edgeBandWidth],
  ] as const) {
    assertFinitePositive(name, value);
  }
  assertFiniteNonnegative(
    'nucleationPrefactor',
    configuration.nucleationPrefactor,
  );
  assertFiniteNonnegative('nucleationBarrier', configuration.nucleationBarrier);
  if (
    !Number.isFinite(configuration.initialTemperature) ||
    !Number.isFinite(configuration.freeSurface.ambientTemperature)
  ) {
    throw new RangeError('Thermal temperatures must be finite.');
  }
  if (!configuration.freeSurface.enabled) {
    throw new RangeError('The thermal prism requires the free surface.');
  }
  if (configuration.edgeBandWidth >= configuration.facetInradius) {
    throw new RangeError('edgeBandWidth must be less than facetInradius.');
  }
  const frame = createCandidate2CFacetedFrame(configuration);
  if (
    Math.abs(Math.abs(frame.planeNormal[1]) - 1) > 1e-12 ||
    Math.abs(frame.tangentU[1]) > 1e-12 ||
    Math.abs(frame.tangentV[1]) > 1e-12
  ) {
    throw new RangeError('The thermal-prism facet must lie in the x-z plane.');
  }
  const domainSize = configuration.shape.map(
    (size) => size * configuration.spacing,
  ) as [number, number, number];
  const requiredRadius =
    configuration.facetInradius + configuration.edgeBandWidth;
  if (
    configuration.centerXZ[0] - requiredRadius <= 0 ||
    configuration.centerXZ[0] + requiredRadius >= domainSize[0] ||
    configuration.centerXZ[1] - requiredRadius <= 0 ||
    configuration.centerXZ[1] + requiredRadius >= domainSize[2]
  ) {
    throw new RangeError(
      'The faceted footprint and fixed edge bands must clear the side faces.',
    );
  }
  const maximumBiotNumber = Math.max(
    configuration.freeSurface.biotNumber,
    configuration.freeSurface.solidBiotNumber ??
      configuration.freeSurface.biotNumber,
  );
  const bulkLossRate =
    (6 * configuration.thermalDiffusivity) / configuration.spacing ** 2;
  const surfaceLossRate =
    (5 * configuration.thermalDiffusivity) / configuration.spacing ** 2 +
    (configuration.thermalDiffusivity * maximumBiotNumber) /
      configuration.spacing;
  const maximumStableTimeStep =
    CANDIDATE2C_FACETED_THERMAL_GATES.maximumStableFraction /
    Math.max(bulkLossRate, surfaceLossRate);
  if (configuration.timeStep > maximumStableTimeStep) {
    throw new RangeError(
      `timeStep ${configuration.timeStep} exceeds the thermal-prism bound ${maximumStableTimeStep}.`,
    );
  }
  const maximumUndercooling = Math.max(
    0,
    -configuration.initialTemperature,
    -configuration.freeSurface.ambientTemperature,
  );
  const maximumStepCourant =
    (configuration.stepKineticCoefficient *
      maximumUndercooling *
      configuration.timeStep) /
    configuration.spacing;
  if (
    maximumStepCourant > CANDIDATE2C_FACETED_THERMAL_GATES.maximumStepCourant
  ) {
    throw new RangeError(
      `step Courant ${maximumStepCourant} exceeds ${CANDIDATE2C_FACETED_THERMAL_GATES.maximumStepCourant}.`,
    );
  }
  const surfaceGeometry = createSurfaceGeometry(configuration, frame);
  const edgeBandCells = configuration.edgeBandWidth / configuration.spacing;
  const facetInradiusCells =
    configuration.facetInradius / configuration.spacing;
  return {
    ...configuration,
    frame,
    voxelCount:
      configuration.shape[0] * configuration.shape[1] * configuration.shape[2],
    surfaceCellCount: configuration.shape[0] * configuration.shape[2],
    cellVolume: configuration.spacing ** 3,
    faceArea: configuration.spacing ** 2,
    domainSize,
    thermalDomainDepth: domainSize[1],
    maximumStableTimeStep,
    maximumStepCourant,
    edgeBandCells,
    facetInradiusCells,
    promotableResolution:
      edgeBandCells >= CANDIDATE2C_FACETED_THERMAL_GATES.minimumEdgeBandCells &&
      facetInradiusCells >=
        CANDIDATE2C_FACETED_THERMAL_GATES.minimumFacetInradiusCells,
    surfaceGeometry,
  };
}

function loopWorldPolygon(
  configuration: DerivedCandidate2CFacetedThermalConfiguration,
  inwardOffset: number,
): Point2[] {
  const polygon = candidate2CFacetedLoopPolygon(
    configuration.frame,
    inwardOffset,
  );
  return worldPolygon(
    configuration.frame,
    configuration.centerXZ,
    polygon.vertices,
  );
}

function analyticGeometryVolume(
  configuration: DerivedCandidate2CFacetedThermalConfiguration,
  completedLayers: number,
  activeLoopOffsets: readonly number[],
): number {
  const outerArea = configuration.frame.outerPolygon.area;
  return (
    configuration.stepHeight *
    (completedLayers * outerArea +
      activeLoopOffsets.reduce(
        (sum, offset) =>
          sum +
          outerArea -
          candidate2CFacetedLoopPolygon(configuration.frame, offset).area,
        0,
      ))
  );
}

function rasterizedSolidVolumes(
  configuration: DerivedCandidate2CFacetedThermalConfiguration,
  completedLayers: number,
  activeLoopOffsets: readonly number[],
): Float64Array {
  const outerAreas = configuration.surfaceGeometry.solidAreaByCell;
  const volumes = new Float64Array(configuration.voxelCount);
  const maximumHeight =
    (completedLayers + activeLoopOffsets.length) * configuration.stepHeight;
  if (
    maximumHeight >
    configuration.thermalDomainDepth +
      1e-12 * Math.max(1, configuration.thermalDomainDepth)
  ) {
    throw new RangeError('The swept step stack exceeds the thermal prism.');
  }

  const addCoverage = (
    areas: Float64Array,
    lowerHeight: number,
    upperHeight: number,
  ): void => {
    if (!(upperHeight > lowerHeight)) return;
    const firstY = Math.max(0, Math.floor(lowerHeight / configuration.spacing));
    const lastY = Math.min(
      configuration.shape[1] - 1,
      Math.ceil(upperHeight / configuration.spacing) - 1,
    );
    for (let y = firstY; y <= lastY; y += 1) {
      const overlap =
        Math.min(upperHeight, (y + 1) * configuration.spacing) -
        Math.max(lowerHeight, y * configuration.spacing);
      if (!(overlap > 0)) continue;
      for (let z = 0; z < configuration.shape[2]; z += 1) {
        for (let x = 0; x < configuration.shape[0]; x += 1) {
          volumes[volumeIndex(x, y, z, configuration.shape)] =
            (volumes[volumeIndex(x, y, z, configuration.shape)] ?? Number.NaN) +
            overlap *
              (areas[surfaceIndex(x, z, configuration.shape[0])] ?? Number.NaN);
        }
      }
    }
  };

  if (completedLayers > 0) {
    addCoverage(outerAreas, 0, completedLayers * configuration.stepHeight);
  }
  for (let layer = 0; layer < activeLoopOffsets.length; layer += 1) {
    const offset = activeLoopOffsets[layer] ?? Number.NaN;
    const loopAreas = polygonCellAreas(
      loopWorldPolygon(configuration, offset),
      configuration.shape,
      configuration.spacing,
    );
    const sweptAreas = subtractAreas(outerAreas, loopAreas);
    const lowerHeight = (completedLayers + layer) * configuration.stepHeight;
    addCoverage(
      sweptAreas,
      lowerHeight,
      lowerHeight + configuration.stepHeight,
    );
  }
  return volumes;
}

export function candidate2CFacetedThermalEnergy(
  state: Candidate2CFacetedThermalState,
): number {
  let sum = 0;
  for (const temperature of state.temperature) sum += temperature;
  return sum * state.configuration.cellVolume;
}

export function candidate2CFacetedThermalLedger(
  state: Candidate2CFacetedThermalState,
): Candidate2CFacetedThermalLedger {
  const thermalEnergy = candidate2CFacetedThermalEnergy(state);
  const expectedThermalEnergy =
    state.initialThermalEnergy +
    state.cumulativeExternalHeat +
    state.cumulativeLatentHeat;
  const residual = thermalEnergy - expectedThermalEnergy;
  const scale = Math.max(
    1,
    Math.abs(thermalEnergy),
    Math.abs(state.initialThermalEnergy),
    Math.abs(state.cumulativeExternalHeat),
    Math.abs(state.cumulativeLatentHeat),
  );
  const rasterGeometryRelativeError = relativeError(
    state.integratedSolidVolume,
    state.rasterizedSolidVolume,
  );
  const expectedLatentHeat =
    state.rasterizedSolidVolume * state.configuration.latentHeatPerVolume;
  return {
    thermalEnergy,
    expectedThermalEnergy,
    residual,
    scale,
    normalizedResidual: residual / scale,
    analyticSolidVolume: state.integratedSolidVolume,
    rasterizedSolidVolume: state.rasterizedSolidVolume,
    rasterGeometryRelativeError,
    expectedLatentHeat,
    latentResidual: state.cumulativeLatentHeat - expectedLatentHeat,
  };
}

export function createCandidate2CFacetedThermalState(
  configuration: Candidate2CFacetedThermalConfiguration,
): Candidate2CFacetedThermalState {
  const derived = deriveCandidate2CFacetedThermalConfiguration(configuration);
  const temperature = new Float64Array(derived.voxelCount);
  temperature.fill(derived.initialTemperature);
  const initialThermalEnergy =
    derived.initialTemperature * derived.voxelCount * derived.cellVolume;
  return {
    configuration: derived,
    temperature,
    activeLoopOffsets: [],
    completedLayers: 0,
    nucleationAccumulator: 0,
    emittedLayers: 0,
    birthEvents: [],
    lastLayerBirthRate: 0,
    integratedSolidVolume: 0,
    rasterizedSolidVolume: 0,
    solidVolumeByCell: new Float64Array(derived.voxelCount),
    maximumLocalSolidHeight: 0,
    cumulativeExternalHeat: 0,
    cumulativeLatentHeat: 0,
    initialThermalEnergy,
    maximumEnergyRelativeResidual: 0,
    maximumRasterGeometryRelativeError: 0,
    loopCrossingDetected: false,
    time: 0,
    step: 0,
  };
}

function weightedSurfaceTemperature(
  state: Candidate2CFacetedThermalState,
  areas: Float64Array,
): number {
  const [width, , depth] = state.configuration.shape;
  let weightedTemperature = 0;
  let totalArea = 0;
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const surfaceOffset = surfaceIndex(x, z, width);
      const area = areas[surfaceOffset] ?? Number.NaN;
      if (!(area > 0)) continue;
      weightedTemperature +=
        area *
        (state.temperature[volumeIndex(x, 0, z, state.configuration.shape)] ??
          Number.NaN);
      totalArea += area;
    }
  }
  return weightedTemperature / totalArea;
}

export function candidate2CFacetedThermalEdgeTemperatures(
  state: Candidate2CFacetedThermalState,
): {
  readonly solid: number;
  readonly liquid: number;
  readonly contrast: number;
} {
  const solid = weightedSurfaceTemperature(
    state,
    state.configuration.surfaceGeometry.solidBandAreaByCell,
  );
  const liquid = weightedSurfaceTemperature(
    state,
    state.configuration.surfaceGeometry.liquidBandAreaByCell,
  );
  return { solid, liquid, contrast: liquid - solid };
}

function segmentBreakpoints(
  start: Point2,
  end: Point2,
  spacing: number,
  axis: 0 | 1,
): number[] {
  const delta = end[axis] - start[axis];
  if (Math.abs(delta) < 1e-15) return [];
  const minimum = Math.min(start[axis], end[axis]);
  const maximum = Math.max(start[axis], end[axis]);
  const firstBoundary = Math.floor(minimum / spacing) + 1;
  const lastBoundary = Math.ceil(maximum / spacing) - 1;
  const values: number[] = [];
  for (let boundary = firstBoundary; boundary <= lastBoundary; boundary += 1) {
    const fraction = (boundary * spacing - start[axis]) / delta;
    if (fraction > 1e-14 && fraction < 1 - 1e-14) values.push(fraction);
  }
  return values;
}

function perimeterTemperature(
  state: Candidate2CFacetedThermalState,
  inwardOffset: number,
  lowerHeight = 0,
  upperHeight = state.configuration.spacing,
): number {
  const vertices = loopWorldPolygon(state.configuration, inwardOffset);
  const [width, height, depth] = state.configuration.shape;
  const spacing = state.configuration.spacing;
  if (
    !Number.isFinite(lowerHeight) ||
    !Number.isFinite(upperHeight) ||
    lowerHeight < 0 ||
    !(upperHeight > lowerHeight) ||
    upperHeight > state.configuration.thermalDomainDepth
  ) {
    throw new RangeError(
      'The step-front sampling interval must lie inside the thermal prism.',
    );
  }
  const firstY = Math.max(0, Math.floor(lowerHeight / spacing));
  const lastY = Math.min(height - 1, Math.ceil(upperHeight / spacing) - 1);
  let weightedTemperature = 0;
  let sampledArea = 0;
  for (let edge = 0; edge < vertices.length; edge += 1) {
    const start = vertices[edge] ?? [Number.NaN, Number.NaN];
    const end = vertices[(edge + 1) % vertices.length] ?? [
      Number.NaN,
      Number.NaN,
    ];
    const edgeLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const breakpoints = [
      0,
      ...segmentBreakpoints(start, end, spacing, 0),
      ...segmentBreakpoints(start, end, spacing, 1),
      1,
    ].sort((left, right) => left - right);
    const unique: number[] = [];
    for (const value of breakpoints) {
      if (
        unique.length === 0 ||
        Math.abs(value - (unique.at(-1) ?? Number.NaN)) > 1e-12
      ) {
        unique.push(value);
      }
    }
    for (let index = 0; index + 1 < unique.length; index += 1) {
      const lower = unique[index] ?? Number.NaN;
      const upper = unique[index + 1] ?? Number.NaN;
      const midpoint = (lower + upper) / 2;
      const xCoordinate = start[0] + midpoint * (end[0] - start[0]);
      const zCoordinate = start[1] + midpoint * (end[1] - start[1]);
      const x = Math.max(
        0,
        Math.min(width - 1, Math.floor(xCoordinate / spacing)),
      );
      const z = Math.max(
        0,
        Math.min(depth - 1, Math.floor(zCoordinate / spacing)),
      );
      const length = edgeLength * (upper - lower);
      for (let y = firstY; y <= lastY; y += 1) {
        const overlapLower = Math.max(lowerHeight, y * spacing);
        const overlapUpper = Math.min(upperHeight, (y + 1) * spacing);
        const overlap = overlapUpper - overlapLower;
        if (!(overlap > 0)) continue;
        const area = length * overlap;
        weightedTemperature +=
          area *
          linearCellTraceUnchecked(
            state.temperature,
            state.configuration.shape,
            spacing,
            x,
            y,
            z,
            [xCoordinate, (overlapLower + overlapUpper) / 2, zCoordinate],
          );
        sampledArea += area;
      }
    }
  }
  return weightedTemperature / sampledArea;
}

export interface Candidate2CFacetedThermalContactLineSource {
  readonly temperature: number;
  readonly undercooling: number;
  readonly surfaceFluxJump: number;
  readonly outerSolidSourceSelected: boolean;
}

export interface Candidate2CFacetedThermalSurfaceTrace {
  readonly temperature: number;
  /** Diffusivity-normalized outward heat flux. */
  readonly outwardHeatFlux: number;
}

export function candidate2CFacetedThermalRobinFaceTrace(
  cellTemperature: number,
  spacing: number,
  biotNumber: number,
  ambientTemperature: number,
): Candidate2CFacetedThermalSurfaceTrace {
  if (
    !Number.isFinite(cellTemperature) ||
    !Number.isFinite(ambientTemperature)
  ) {
    throw new RangeError('Robin face temperatures must be finite.');
  }
  assertFinitePositive('spacing', spacing);
  assertFiniteNonnegative('biotNumber', biotNumber);
  const halfCellBiot = (biotNumber * spacing) / 2;
  const temperature =
    (cellTemperature + halfCellBiot * ambientTemperature) / (1 + halfCellBiot);
  return {
    temperature,
    outwardHeatFlux: biotNumber * (temperature - ambientTemperature),
  };
}

/**
 * Reconstructs a Robin face trace from a cell-centred finite volume. The
 * half-cell resistance is required because the stored temperature is dx / 2
 * below the free surface rather than on the boundary itself.
 */
function reconstructedSurfaceTrace(
  state: Candidate2CFacetedThermalState,
  orderParameter: -1 | 1,
  cellTemperature: number,
): Candidate2CFacetedThermalSurfaceTrace {
  const { configuration } = state;
  const biotNumber = candidate2AFreeSurfaceBiotNumber(
    orderParameter,
    configuration.freeSurface,
  );
  return candidate2CFacetedThermalRobinFaceTrace(
    cellTemperature,
    configuration.spacing,
    biotNumber,
    configuration.freeSurface.ambientTemperature,
  );
}

function stepFrontTemperature(
  state: Candidate2CFacetedThermalState,
  inwardOffset: number,
  layerOrdinal: number,
): number {
  const lowerHeight = layerOrdinal * state.configuration.stepHeight;
  return perimeterTemperature(
    state,
    inwardOffset,
    lowerHeight,
    lowerHeight + state.configuration.stepHeight,
  );
}

export function candidate2CFacetedThermalContactLineSource(
  state: Candidate2CFacetedThermalState,
): Candidate2CFacetedThermalContactLineSource {
  const cellTemperature = perimeterTemperature(state, 0);
  const solidTrace = reconstructedSurfaceTrace(state, 1, cellTemperature);
  const liquidTrace = reconstructedSurfaceTrace(state, -1, cellTemperature);
  const temperature = (solidTrace.temperature + liquidTrace.temperature) / 2;
  const surfaceFluxJump =
    solidTrace.outwardHeatFlux - liquidTrace.outwardHeatFlux;
  return {
    temperature,
    undercooling: Math.max(0, -temperature),
    surfaceFluxJump,
    outerSolidSourceSelected: surfaceFluxJump > 0,
  };
}

interface Candidate2CFacetedThermalGeometryAdvance {
  readonly activeLoopOffsets: readonly number[];
  readonly completedLayers: number;
  readonly nucleationAccumulator: number;
  readonly emittedLayers: number;
  readonly birthEvents: readonly Candidate2CFacetedThermalBirthEvent[];
  readonly layerBirthRate: number;
  readonly crossingDetected: boolean;
}

function strictlyDescending(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (!((values[index - 1] ?? Number.NaN) > (values[index] ?? Number.NaN))) {
      return false;
    }
  }
  return true;
}

function advanceGeometry(
  state: Candidate2CFacetedThermalState,
  contactLine: Candidate2CFacetedThermalContactLineSource,
): Candidate2CFacetedThermalGeometryAdvance {
  const { configuration } = state;
  const duration = configuration.timeStep;
  const moved: number[] = [];
  let completedLayers = state.completedLayers;
  for (
    let layerIndex = 0;
    layerIndex < state.activeLoopOffsets.length;
    layerIndex += 1
  ) {
    const offset = state.activeLoopOffsets[layerIndex] ?? Number.NaN;
    const localUndercooling = Math.max(
      0,
      -stepFrontTemperature(state, offset, state.completedLayers + layerIndex),
    );
    const nextOffset = Math.min(
      configuration.facetInradius,
      offset +
        configuration.stepKineticCoefficient * localUndercooling * duration,
    );
    if (nextOffset >= configuration.facetInradius) completedLayers += 1;
    else moved.push(nextOffset);
  }

  const sourceUndercooling = contactLine.outerSolidSourceSelected
    ? contactLine.undercooling
    : 0;
  const layerBirthRate =
    candidate2CNucleationVelocity(
      sourceUndercooling,
      configuration.nucleationPrefactor,
      configuration.nucleationBarrier,
    ) / configuration.stepHeight;
  const accumulatedLayers =
    state.nucleationAccumulator + layerBirthRate * duration;
  const births = Math.floor(accumulatedLayers);
  const birthEvents = [...state.birthEvents];
  if (layerBirthRate > 0) {
    for (let birth = 0; birth < births; birth += 1) {
      const birthLayerOrdinal =
        state.completedLayers + state.activeLoopOffsets.length + birth;
      const birthUndercooling = Math.max(
        0,
        -stepFrontTemperature(
          state,
          configuration.birthInwardOffset,
          birthLayerOrdinal,
        ),
      );
      const eventTime =
        (1 - state.nucleationAccumulator + birth) / layerBirthRate;
      birthEvents.push({
        ordinal: state.emittedLayers + birth + 1,
        time: state.time + eventTime,
        bracketStart: state.time,
        bracketEnd: state.time + duration,
      });
      const nextOffset = Math.min(
        configuration.facetInradius,
        configuration.birthInwardOffset +
          configuration.stepKineticCoefficient *
            birthUndercooling *
            Math.max(0, duration - eventTime),
      );
      if (nextOffset >= configuration.facetInradius) completedLayers += 1;
      else moved.push(nextOffset);
    }
  }
  const crossingDetected = !strictlyDescending(moved);
  moved.sort((left, right) => right - left);
  return {
    activeLoopOffsets: moved,
    completedLayers,
    nucleationAccumulator: accumulatedLayers - births,
    emittedLayers: state.emittedLayers + births,
    birthEvents,
    layerBirthRate,
    crossingDetected,
  };
}

export function stepCandidate2CFacetedThermalState(
  state: Candidate2CFacetedThermalState,
): Candidate2CFacetedThermalState {
  const { configuration } = state;
  const [width, height, depth] = configuration.shape;
  const energy = new Float64Array(configuration.voxelCount);
  for (let index = 0; index < energy.length; index += 1) {
    energy[index] =
      (state.temperature[index] ?? Number.NaN) * configuration.cellVolume;
  }

  const faceHeatScale =
    configuration.timeStep *
    configuration.thermalDiffusivity *
    configuration.spacing;
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = volumeIndex(x, y, z, configuration.shape);
        if (x + 1 < width) {
          const neighbor = volumeIndex(x + 1, y, z, configuration.shape);
          const heat =
            faceHeatScale *
            ((state.temperature[neighbor] ?? Number.NaN) -
              (state.temperature[index] ?? Number.NaN));
          energy[index] = (energy[index] ?? Number.NaN) + heat;
          energy[neighbor] = (energy[neighbor] ?? Number.NaN) - heat;
        }
        if (y + 1 < height) {
          const neighbor = volumeIndex(x, y + 1, z, configuration.shape);
          const heat =
            faceHeatScale *
            ((state.temperature[neighbor] ?? Number.NaN) -
              (state.temperature[index] ?? Number.NaN));
          energy[index] = (energy[index] ?? Number.NaN) + heat;
          energy[neighbor] = (energy[neighbor] ?? Number.NaN) - heat;
        }
        if (z + 1 < depth) {
          const neighbor = volumeIndex(x, y, z + 1, configuration.shape);
          const heat =
            faceHeatScale *
            ((state.temperature[neighbor] ?? Number.NaN) -
              (state.temperature[index] ?? Number.NaN));
          energy[index] = (energy[index] ?? Number.NaN) + heat;
          energy[neighbor] = (energy[neighbor] ?? Number.NaN) - heat;
        }
      }
    }
  }

  let externalHeat = 0;
  const solidAreas = configuration.surfaceGeometry.solidAreaByCell;
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const surfaceOffset = surfaceIndex(x, z, width);
      const index = volumeIndex(x, 0, z, configuration.shape);
      const temperature = state.temperature[index] ?? Number.NaN;
      const solidArea = Math.max(
        0,
        Math.min(
          configuration.faceArea,
          solidAreas[surfaceOffset] ?? Number.NaN,
        ),
      );
      const liquidArea = configuration.faceArea - solidArea;
      const solidTrace = reconstructedSurfaceTrace(state, 1, temperature);
      const liquidTrace = reconstructedSurfaceTrace(state, -1, temperature);
      const outwardHeatRate =
        configuration.thermalDiffusivity *
        (solidArea * solidTrace.outwardHeatFlux +
          liquidArea * liquidTrace.outwardHeatFlux);
      const heat = -configuration.timeStep * outwardHeatRate;
      energy[index] = (energy[index] ?? Number.NaN) + heat;
      externalHeat += heat;
    }
  }

  const contactLine = candidate2CFacetedThermalContactLineSource(state);
  const geometry = advanceGeometry(state, contactLine);
  const nextAnalyticVolume = analyticGeometryVolume(
    configuration,
    geometry.completedLayers,
    geometry.activeLoopOffsets,
  );
  if (
    nextAnalyticVolume <
    state.integratedSolidVolume -
      1e-12 * Math.max(1, state.integratedSolidVolume)
  ) {
    throw new RangeError('Faceted thermal solid volume must not decrease.');
  }
  const nextSolidVolumes = rasterizedSolidVolumes(
    configuration,
    geometry.completedLayers,
    geometry.activeLoopOffsets,
  );
  let rasterizedSolidVolume = 0;
  let sweptRasterVolume = 0;
  for (let index = 0; index < nextSolidVolumes.length; index += 1) {
    const nextVolume = nextSolidVolumes[index] ?? Number.NaN;
    const oldVolume = state.solidVolumeByCell[index] ?? Number.NaN;
    const sweptVolume = nextVolume - oldVolume;
    if (sweptVolume < -1e-11 * Math.max(1, nextVolume, oldVolume)) {
      throw new RangeError(
        'A faceted loop cannot remove previously swept solid volume.',
      );
    }
    const clampedSweptVolume = Math.max(0, sweptVolume);
    energy[index] =
      (energy[index] ?? Number.NaN) +
      clampedSweptVolume * configuration.latentHeatPerVolume;
    rasterizedSolidVolume += nextVolume;
    sweptRasterVolume += clampedSweptVolume;
  }
  const latentHeat = sweptRasterVolume * configuration.latentHeatPerVolume;
  const nextTemperature = new Float64Array(configuration.voxelCount);
  for (let index = 0; index < nextTemperature.length; index += 1) {
    nextTemperature[index] =
      (energy[index] ?? Number.NaN) / configuration.cellVolume;
  }
  const nextStateBase: Candidate2CFacetedThermalState = {
    configuration,
    temperature: nextTemperature,
    activeLoopOffsets: geometry.activeLoopOffsets,
    completedLayers: geometry.completedLayers,
    nucleationAccumulator: geometry.nucleationAccumulator,
    emittedLayers: geometry.emittedLayers,
    birthEvents: geometry.birthEvents,
    lastLayerBirthRate: geometry.layerBirthRate,
    integratedSolidVolume: nextAnalyticVolume,
    rasterizedSolidVolume,
    solidVolumeByCell: nextSolidVolumes,
    maximumLocalSolidHeight:
      (geometry.completedLayers + geometry.activeLoopOffsets.length) *
      configuration.stepHeight,
    cumulativeExternalHeat: state.cumulativeExternalHeat + externalHeat,
    cumulativeLatentHeat: state.cumulativeLatentHeat + latentHeat,
    initialThermalEnergy: state.initialThermalEnergy,
    maximumEnergyRelativeResidual: state.maximumEnergyRelativeResidual,
    maximumRasterGeometryRelativeError:
      state.maximumRasterGeometryRelativeError,
    loopCrossingDetected:
      state.loopCrossingDetected || geometry.crossingDetected,
    time: state.time + configuration.timeStep,
    step: state.step + 1,
  };
  const ledger = candidate2CFacetedThermalLedger(nextStateBase);
  return {
    ...nextStateBase,
    maximumEnergyRelativeResidual: Math.max(
      state.maximumEnergyRelativeResidual,
      Math.abs(ledger.normalizedResidual),
    ),
    maximumRasterGeometryRelativeError: Math.max(
      state.maximumRasterGeometryRelativeError,
      ledger.rasterGeometryRelativeError,
    ),
  };
}

export function runCandidate2CFacetedThermalSteps(
  initial: Candidate2CFacetedThermalState,
  steps: number,
): Candidate2CFacetedThermalState {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a nonnegative integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = stepCandidate2CFacetedThermalState(state);
  }
  return state;
}

export function measureCandidate2CFacetedThermalCheckpoint(
  state: Candidate2CFacetedThermalState,
): Candidate2CFacetedThermalCheckpoint {
  const edge = candidate2CFacetedThermalEdgeTemperatures(state);
  const contactLine = candidate2CFacetedThermalContactLineSource(state);
  const resolvedTerraceCount = state.activeLoopOffsets.filter(
    (offset) =>
      offset >= CANDIDATE2C_FACETED_THERMAL_GATES.resolvedOffsetCutoff,
  ).length;
  return {
    step: state.step,
    time: state.time,
    solidEdgeTemperature: edge.solid,
    liquidEdgeTemperature: edge.liquid,
    edgeContrast: edge.contrast,
    contactLineTemperature: contactLine.temperature,
    contactLineUndercooling: contactLine.undercooling,
    surfaceFluxJump: contactLine.surfaceFluxJump,
    activeLoopOffsets: [...state.activeLoopOffsets],
    activeTerraceCount: state.activeLoopOffsets.length,
    resolvedTerraceCount,
    completedLayers: state.completedLayers,
    emittedLayers: state.emittedLayers,
    layerPhase: state.emittedLayers + state.nucleationAccumulator,
    openingDepth: resolvedTerraceCount * state.configuration.stepHeight,
    maximumLocalSolidHeight: state.maximumLocalSolidHeight,
    cumulativeExternalHeat: state.cumulativeExternalHeat,
    cumulativeLatentHeat: state.cumulativeLatentHeat,
    ledger: candidate2CFacetedThermalLedger(state),
  };
}

function runArm(
  configuration: Candidate2CFacetedThermalConfiguration,
): Candidate2CFacetedThermalArmResult {
  let state = createCandidate2CFacetedThermalState(configuration);
  const checkpointSteps = CANDIDATE2C_FACETED_THERMAL_GATES.checkpointTimes.map(
    (time) => Math.round(time / configuration.timeStep),
  );
  const finalStep = Math.round(
    CANDIDATE2C_FACETED_THERMAL_GATES.evaluationTime / configuration.timeStep,
  );
  const checkpoints: Candidate2CFacetedThermalCheckpoint[] = [];
  for (let step = 1; step <= finalStep; step += 1) {
    state = stepCandidate2CFacetedThermalState(state);
    if (checkpointSteps.includes(step)) {
      checkpoints.push(measureCandidate2CFacetedThermalCheckpoint(state));
    }
  }
  return { finalState: state, checkpoints };
}

function configurationForArm(
  arm: Candidate2CFacetedThermalArmName,
  overrides: Partial<Candidate2CFacetedThermalConfiguration> = {},
): Candidate2CFacetedThermalConfiguration {
  return {
    ...CANDIDATE2C_FACETED_THERMAL_ISOLATION,
    ...overrides,
    freeSurface: candidate2CFacetedThermalBoundaryForArm(arm),
  };
}

function oddEven(
  equal: number,
  forward: number,
  reverse: number,
): Candidate2CFacetedThermalOddEven {
  return {
    equal,
    forward,
    reverse,
    odd: (forward - reverse) / 2,
    even: (forward + reverse) / 2 - equal,
  };
}

function compareArms(
  arms: Readonly<
    Record<Candidate2CFacetedThermalArmName, Candidate2CFacetedThermalArmResult>
  >,
): Candidate2CFacetedThermalComparison[] {
  return CANDIDATE2C_FACETED_THERMAL_GATES.checkpointTimes.map((_, index) => {
    const equal = arms.equal.checkpoints[index]!;
    const forward = arms.forward.checkpoints[index]!;
    const reverse = arms.reverse.checkpoints[index]!;
    return {
      step: equal.step,
      time: equal.time,
      edgeContrast: oddEven(
        equal.edgeContrast,
        forward.edgeContrast,
        reverse.edgeContrast,
      ),
      surfaceFluxJump: oddEven(
        equal.surfaceFluxJump,
        forward.surfaceFluxJump,
        reverse.surfaceFluxJump,
      ),
    };
  });
}

function normalizedDifference(left: number, right: number): number {
  return Math.abs(left - right) / Math.max(1, Math.abs(left), Math.abs(right));
}

function candidate2CRobinContactLineForBiotPair(
  spacing: number,
  solidBiotNumber: number,
  liquidBiotNumber: number,
): { readonly temperature: number; readonly surfaceFluxJump: number } {
  const solid = candidate2CFacetedThermalRobinFaceTrace(
    INITIAL_TEMPERATURE,
    spacing,
    solidBiotNumber,
    AMBIENT_TEMPERATURE,
  );
  const liquid = candidate2CFacetedThermalRobinFaceTrace(
    INITIAL_TEMPERATURE,
    spacing,
    liquidBiotNumber,
    AMBIENT_TEMPERATURE,
  );
  return {
    temperature: (solid.temperature + liquid.temperature) / 2,
    surfaceFluxJump: solid.outwardHeatFlux - liquid.outwardHeatFlux,
  };
}

/**
 * Isolates the spacing dependence of the conservative half-cell Robin trace.
 * It does not alter the morphology screen or authorize coefficient tuning.
 */
export function runCandidate2CFacetedThermalRobinRefinement(): Candidate2CFacetedThermalRobinRefinementResult {
  const protocol = CANDIDATE2C_FACETED_THERMAL_ROBIN_REFINEMENT;
  const solidBiotNumber =
    CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.solidBiotNumber;
  const liquidBiotNumber =
    CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.liquidBiotNumber;
  const continuumContactLineTemperature = INITIAL_TEMPERATURE;
  const continuumSurfaceFluxJump =
    (solidBiotNumber - liquidBiotNumber) *
    (INITIAL_TEMPERATURE - AMBIENT_TEMPERATURE);
  const samples = protocol.spacings.map((spacing) => {
    const contact = candidate2CRobinContactLineForBiotPair(
      spacing,
      solidBiotNumber,
      liquidBiotNumber,
    );
    return {
      spacing,
      contactLineTemperature: contact.temperature,
      surfaceFluxJump: contact.surfaceFluxJump,
      continuumFluxError: normalizedDifference(
        contact.surfaceFluxJump,
        continuumSurfaceFluxJump,
      ),
    } satisfies Candidate2CFacetedThermalRobinRefinementSample;
  });
  const coarse = samples[0]!;
  const medium = samples[1]!;
  const fine = samples[2]!;
  const coarseToMediumFluxDifference = normalizedDifference(
    coarse.surfaceFluxJump,
    medium.surfaceFluxJump,
  );
  const mediumToFineFluxDifference = normalizedDifference(
    medium.surfaceFluxJump,
    fine.surfaceFluxJump,
  );
  const fineContinuumFluxDifference = normalizedDifference(
    fine.surfaceFluxJump,
    continuumSurfaceFluxJump,
  );
  const successiveErrorReductionRatios = [
    coarse.continuumFluxError / medium.continuumFluxError,
    medium.continuumFluxError / fine.continuumFluxError,
  ] as const;
  const equal = candidate2CRobinContactLineForBiotPair(
    medium.spacing,
    EQUAL_BIOT_NUMBER,
    EQUAL_BIOT_NUMBER,
  );
  const reverse = candidate2CRobinContactLineForBiotPair(
    medium.spacing,
    liquidBiotNumber,
    solidBiotNumber,
  );
  const gates: Candidate2CFacetedThermalRobinRefinementGates = {
    equalSourceNull: Math.abs(equal.surfaceFluxJump) <= 1e-12,
    contrastReverses:
      Math.abs(reverse.surfaceFluxJump + medium.surfaceFluxJump) <= 1e-12,
    monotoneConvergence:
      coarse.continuumFluxError > medium.continuumFluxError &&
      medium.continuumFluxError > fine.continuumFluxError,
    successiveErrorReductionPasses: successiveErrorReductionRatios.every(
      (ratio) => ratio >= protocol.minimumSuccessiveErrorReductionRatio,
    ),
    refinedPairPasses:
      mediumToFineFluxDifference <= protocol.maximumRefinedPairFluxDifference,
    fineContinuumPasses:
      fineContinuumFluxDifference <=
      protocol.maximumFineContinuumFluxDifference,
  };
  return {
    classification: Object.values(gates).every(Boolean)
      ? 'passes-first-order-isolation'
      : 'fails-robin-refinement',
    samples,
    continuumContactLineTemperature,
    continuumSurfaceFluxJump,
    coarseToMediumFluxDifference,
    mediumToFineFluxDifference,
    fineContinuumFluxDifference,
    successiveErrorReductionRatios,
    equalSurfaceFluxJump: equal.surfaceFluxJump,
    reverseSurfaceFluxJump: reverse.surfaceFluxJump,
    gates,
  };
}

function compareRefinement(
  base: Candidate2CFacetedThermalArmResult,
  refined: Candidate2CFacetedThermalArmResult,
): Candidate2CFacetedThermalRefinement {
  const left = base.finalState;
  const right = refined.finalState;
  const birthCountsCompatible = left.emittedLayers === right.emittedLayers;
  const strictTopologyBoth =
    !left.loopCrossingDetected &&
    !right.loopCrossingDetected &&
    strictlyDescending(left.activeLoopOffsets) &&
    strictlyDescending(right.activeLoopOffsets);
  const topologyMatches =
    birthCountsCompatible &&
    strictTopologyBoth &&
    left.emittedLayers === right.emittedLayers &&
    left.completedLayers === right.completedLayers &&
    left.activeLoopOffsets.length === right.activeLoopOffsets.length;
  let maximumLoopOffsetDifference = topologyMatches
    ? 0
    : Number.POSITIVE_INFINITY;
  if (topologyMatches) {
    for (let index = 0; index < left.activeLoopOffsets.length; index += 1) {
      maximumLoopOffsetDifference = Math.max(
        maximumLoopOffsetDifference,
        Math.abs(
          (left.activeLoopOffsets[index] ?? Number.NaN) -
            (right.activeLoopOffsets[index] ?? Number.NaN),
        ) / left.configuration.facetInradius,
      );
    }
  }
  const leftEdge = candidate2CFacetedThermalEdgeTemperatures(left).contrast;
  const rightEdge = candidate2CFacetedThermalEdgeTemperatures(right).contrast;
  const edgeContrastDifference = normalizedDifference(leftEdge, rightEdge);
  const leftSource = candidate2CFacetedThermalContactLineSource(left);
  const rightSource = candidate2CFacetedThermalContactLineSource(right);
  const contactLineTemperatureDifference = normalizedDifference(
    leftSource.temperature,
    rightSource.temperature,
  );
  const surfaceFluxJumpDifference = normalizedDifference(
    leftSource.surfaceFluxJump,
    rightSource.surfaceFluxJump,
  );
  const externalHeatDifference = normalizedDifference(
    left.cumulativeExternalHeat,
    right.cumulativeExternalHeat,
  );
  const latentHeatDifference = normalizedDifference(
    left.cumulativeLatentHeat,
    right.cumulativeLatentHeat,
  );
  const solidVolumeDifference = normalizedDifference(
    left.integratedSolidVolume,
    right.integratedSolidVolume,
  );
  let maximumLayerPhaseDifference = 0;
  for (
    let index = 0;
    index < Math.min(base.checkpoints.length, refined.checkpoints.length);
    index += 1
  ) {
    maximumLayerPhaseDifference = Math.max(
      maximumLayerPhaseDifference,
      Math.abs(
        (base.checkpoints[index]?.layerPhase ?? Number.NaN) -
          (refined.checkpoints[index]?.layerPhase ?? Number.NaN),
      ),
    );
  }
  let maximumBirthTimeDifference = 0;
  const commonBirths = Math.min(
    left.birthEvents.length,
    right.birthEvents.length,
  );
  for (let index = 0; index < commonBirths; index += 1) {
    const leftEvent = left.birthEvents[index]!;
    const rightEvent = right.birthEvents[index]!;
    if (leftEvent.ordinal !== rightEvent.ordinal) {
      maximumBirthTimeDifference = Number.POSITIVE_INFINITY;
      break;
    }
    maximumBirthTimeDifference = Math.max(
      maximumBirthTimeDifference,
      Math.abs(leftEvent.time - rightEvent.time),
    );
  }
  return {
    topologyMatches,
    birthCountsCompatible,
    strictTopologyBoth,
    maximumLayerPhaseDifference,
    maximumBirthTimeDifference,
    edgeContrastDifference,
    contactLineTemperatureDifference,
    surfaceFluxJumpDifference,
    externalHeatDifference,
    latentHeatDifference,
    solidVolumeDifference,
    maximumLoopOffsetDifference,
    maximumDifference: Math.max(
      edgeContrastDifference,
      contactLineTemperatureDifference,
      surfaceFluxJumpDifference,
      externalHeatDifference,
      latentHeatDifference,
      solidVolumeDifference,
      maximumLoopOffsetDifference,
      maximumLayerPhaseDifference,
      maximumBirthTimeDifference,
    ),
  };
}

function allFiniteState(state: Candidate2CFacetedThermalState): boolean {
  if (
    ![
      state.completedLayers,
      state.nucleationAccumulator,
      state.emittedLayers,
      state.lastLayerBirthRate,
      state.integratedSolidVolume,
      state.rasterizedSolidVolume,
      state.cumulativeExternalHeat,
      state.cumulativeLatentHeat,
      state.initialThermalEnergy,
      state.maximumEnergyRelativeResidual,
      state.maximumRasterGeometryRelativeError,
      state.maximumLocalSolidHeight,
      state.time,
      state.step,
      ...state.activeLoopOffsets,
      ...state.birthEvents.flatMap((event) => [
        event.ordinal,
        event.time,
        event.bracketStart,
        event.bracketEnd,
      ]),
    ].every(Number.isFinite)
  ) {
    return false;
  }
  for (const temperature of state.temperature) {
    if (!Number.isFinite(temperature)) return false;
  }
  return true;
}

function latentLedgerCloses(state: Candidate2CFacetedThermalState): boolean {
  const ledger = candidate2CFacetedThermalLedger(state);
  return (
    Math.abs(ledger.latentResidual) /
      Math.max(
        1,
        Math.abs(state.cumulativeLatentHeat),
        Math.abs(ledger.expectedLatentHeat),
      ) <=
    CANDIDATE2C_FACETED_THERMAL_GATES.maximumRasterGeometryRelativeError
  );
}

function strictLoopTopology(state: Candidate2CFacetedThermalState): boolean {
  if (
    state.loopCrossingDetected ||
    !strictlyDescending(state.activeLoopOffsets)
  ) {
    return false;
  }
  let previousArea = Number.NEGATIVE_INFINITY;
  for (const offset of state.activeLoopOffsets) {
    if (
      offset < state.configuration.birthInwardOffset ||
      offset >= state.configuration.facetInradius
    ) {
      return false;
    }
    const polygon = candidate2CFacetedLoopPolygon(
      state.configuration.frame,
      offset,
    );
    if (
      polygon.vertices.length !== 6 ||
      !Number.isFinite(polygon.area) ||
      !(polygon.area > previousArea)
    ) {
      return false;
    }
    previousArea = polygon.area;
  }
  return true;
}

function nestedTopologyPasses(
  result: Candidate2CFacetedThermalArmResult,
): boolean {
  const state = result.finalState;
  const final = result.checkpoints.at(-1)!;
  return (
    strictLoopTopology(state) &&
    state.emittedLayers >=
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumActiveTerraces &&
    state.activeLoopOffsets.length >=
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumActiveTerraces &&
    final.resolvedTerraceCount >=
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumResolvedTerraces &&
    final.openingDepth >=
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumOpeningDepthInSteps *
        state.configuration.stepHeight
  );
}

function classify(
  gates: Candidate2CFacetedThermalGates,
): Candidate2CFacetedThermalClassification {
  if (
    !gates.finite ||
    !gates.stableAndCourantSafe ||
    !gates.surfaceGeometryResolved ||
    !gates.promotableResolution
  ) {
    return 'invalid';
  }
  if (!gates.equalSourceNull) return 'equal-source-not-null';
  if (!gates.contrastReverses) return 'contrast-reversal-failure';
  if (!gates.energyLedgersClose || !gates.rasterAndGeometryLedgersClose) {
    return 'ledger-failure';
  }
  if (!gates.nestedTopologyPasses) return 'topology-failure';
  if (!gates.timeRefinementPasses || !gates.spaceRefinementPasses) {
    return 'refinement-failure';
  }
  return 'passes-reduced-coupling';
}

export function createCandidate2CFacetedThermalDiagnosticConfiguration(
  arm: Candidate2CFacetedThermalArmName,
  overrides: Partial<Candidate2CFacetedThermalConfiguration> = {},
): Candidate2CFacetedThermalConfiguration {
  return configurationForArm(arm, overrides);
}

/**
 * Runs the fixed faceted thermal-prism gate. Passing this reduced coupling
 * authorizes a morphology screen; it is not a calibrated bismuth model.
 */
export function runCandidate2CFacetedThermalDiagnostic(): Candidate2CFacetedThermalDiagnosticResult {
  const arms = {
    equal: runArm(configurationForArm('equal')),
    forward: runArm(configurationForArm('forward')),
    reverse: runArm(configurationForArm('reverse')),
  };
  const timeRefinedForward = runArm(
    configurationForArm('forward', { timeStep: 0.00125 }),
  );
  const spaceRefinedForward = runArm(
    configurationForArm('forward', {
      shape: [160, 96, 160],
      spacing: 0.1875,
    }),
  );
  const comparisons = compareArms(arms);
  const timeRefinement = compareRefinement(arms.forward, timeRefinedForward);
  const spaceRefinement = compareRefinement(arms.forward, spaceRefinedForward);
  const allResults = [
    ...Object.values(arms),
    timeRefinedForward,
    spaceRefinedForward,
  ];
  const allStates = allResults.map((result) => result.finalState);
  const equalSourceNull =
    arms.equal.checkpoints.every(
      (checkpoint) =>
        Math.abs(checkpoint.edgeContrast) <=
          CANDIDATE2C_FACETED_THERMAL_GATES.maximumEqualContrast &&
        Math.abs(checkpoint.surfaceFluxJump) <=
          CANDIDATE2C_FACETED_THERMAL_GATES.maximumEqualContrast,
    ) &&
    arms.equal.finalState.emittedLayers === 0 &&
    arms.equal.finalState.integratedSolidVolume === 0 &&
    arms.equal.finalState.cumulativeLatentHeat === 0;
  const contrastReverses = comparisons.every((comparison) => {
    const contrast = comparison.edgeContrast;
    const fluxJump = comparison.surfaceFluxJump;
    return (
      contrast.forward >=
        CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast &&
      contrast.reverse <=
        -CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast &&
      Math.abs(contrast.even) <=
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumEvenToOddRatio *
          Math.abs(contrast.odd) &&
      fluxJump.forward >=
        CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast &&
      fluxJump.reverse <=
        -CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast &&
      Math.abs(fluxJump.even) <=
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumEvenToOddRatio *
          Math.abs(fluxJump.odd)
    );
  });
  const gates: Candidate2CFacetedThermalGates = {
    finite: allStates.every(allFiniteState),
    stableAndCourantSafe: allStates.every(
      (state) =>
        state.configuration.timeStep <=
          state.configuration.maximumStableTimeStep &&
        state.configuration.maximumStepCourant <=
          CANDIDATE2C_FACETED_THERMAL_GATES.maximumStepCourant,
    ),
    surfaceGeometryResolved: allStates.every(
      (state) =>
        state.configuration.surfaceGeometry.solidArea > 0 &&
        state.configuration.surfaceGeometry.solidBandArea > 0 &&
        state.configuration.surfaceGeometry.liquidBandArea > 0 &&
        state.configuration.surfaceGeometry.maximumCoverageRelativeError <=
          CANDIDATE2C_FACETED_THERMAL_GATES.maximumRasterGeometryRelativeError,
    ),
    promotableResolution: allStates.every(
      (state) => state.configuration.promotableResolution,
    ),
    equalSourceNull,
    contrastReverses,
    energyLedgersClose: allStates.every(
      (state) =>
        state.maximumEnergyRelativeResidual <=
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumEnergyRelativeError,
    ),
    rasterAndGeometryLedgersClose: allStates.every(
      (state) =>
        state.maximumRasterGeometryRelativeError <=
          CANDIDATE2C_FACETED_THERMAL_GATES.maximumRasterGeometryRelativeError &&
        latentLedgerCloses(state),
    ),
    nestedTopologyPasses:
      allStates.every(strictLoopTopology) && nestedTopologyPasses(arms.forward),
    timeRefinementPasses:
      timeRefinement.topologyMatches &&
      timeRefinement.maximumLayerPhaseDifference <=
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumLayerPhaseDifference &&
      timeRefinement.maximumDifference <=
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumTimeRefinementDifference,
    spaceRefinementPasses:
      spaceRefinement.topologyMatches &&
      spaceRefinement.maximumLayerPhaseDifference <=
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumLayerPhaseDifference &&
      spaceRefinement.maximumDifference <=
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumSpaceRefinementDifference,
  };
  return {
    classification: classify(gates),
    arms,
    timeRefinedForward,
    spaceRefinedForward,
    comparisons,
    timeRefinement,
    spaceRefinement,
    gates,
  };
}
