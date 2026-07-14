/**
 * Retired Candidate 2C mechanism scaffold. Its equal six-support carrier is
 * incompatible with the Candidate 2D target and must not be imported by an
 * active product-generation path.
 */
import { snBiPyramidFacetNormals } from './candidate2a';
import {
  crystalAxesFromEuler,
  type EulerOrientation,
  type Vec3,
} from './config';
import { candidate2CNucleationVelocity } from './candidate2c';

export type Candidate2CFacetedVec2 = readonly [number, number];

export interface Candidate2CFacetedConfiguration {
  readonly orientation: EulerOrientation;
  readonly facetInradius: number;
  readonly stepHeight: number;
  /** Physical inward extent assigned when a finite new loop is born. */
  readonly birthInwardOffset: number;
  readonly stepKineticCoefficient: number;
  readonly nucleationPrefactor: number;
  readonly nucleationBarrier: number;
  readonly latentHeatPerVolume: number;
  readonly timeStep: number;
}

export interface Candidate2CFacetedPolygon {
  readonly supports: readonly number[];
  readonly vertices: readonly Candidate2CFacetedVec2[];
  readonly edgeLengths: readonly number[];
  readonly area: number;
  readonly supportArea: number;
}

export interface Candidate2CFacetedFrame {
  readonly planeNormal: Vec3;
  readonly tangentU: Vec3;
  readonly tangentV: Vec3;
  readonly normals2D: readonly Candidate2CFacetedVec2[];
  readonly normals3D: readonly Vec3[];
  readonly outerPolygon: Candidate2CFacetedPolygon;
}

export interface Candidate2CFacetedState {
  readonly configuration: Candidate2CFacetedConfiguration;
  readonly frame: Candidate2CFacetedFrame;
  /** Oldest/innermost first; every value lies in [0, facetInradius). */
  readonly activeLoopOffsets: readonly number[];
  readonly completedLayers: number;
  readonly nucleationAccumulator: number;
  readonly emittedLayers: number;
  readonly integratedSolidVolume: number;
  readonly releasedLatentHeat: number;
  readonly time: number;
  readonly step: number;
}

export const CANDIDATE2C_FACETED_ISOLATION = Object.freeze({
  orientation: { x: -Math.PI / 2, y: 0, z: 0 },
  facetInradius: 4,
  stepHeight: 0.25,
  birthInwardOffset: 0.125,
  stepKineticCoefficient: 1,
  nucleationPrefactor: 0.25,
  nucleationBarrier: 1,
  latentHeatPerVolume: 1,
  timeStep: 0.05,
}) satisfies Candidate2CFacetedConfiguration;

/** Declared before evaluating the fixed faceted-loop isolation. */
export const CANDIDATE2C_FACETED_GATES = Object.freeze({
  evaluationTime: 6,
  minimumActiveTerraces: 2,
  minimumOpeningDepthInSteps: 2,
  maximumGeometryRelativeError: 1e-12,
  maximumTimeRefinementError: 1e-11,
});

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function dot3(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function normalize3(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  if (!(length > 0)) {
    throw new RangeError('Projected facet normal must have nonzero length.');
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function validateConfiguration(
  configuration: Candidate2CFacetedConfiguration,
): void {
  for (const [name, angle] of [
    ['orientation.x', configuration.orientation.x],
    ['orientation.y', configuration.orientation.y],
    ['orientation.z', configuration.orientation.z],
  ] as const) {
    if (!Number.isFinite(angle)) {
      throw new RangeError(`${name} must be finite.`);
    }
  }
  assertFinitePositive('facetInradius', configuration.facetInradius);
  assertFinitePositive('stepHeight', configuration.stepHeight);
  assertFinitePositive('birthInwardOffset', configuration.birthInwardOffset);
  if (configuration.birthInwardOffset >= configuration.facetInradius) {
    throw new RangeError('birthInwardOffset must be less than facetInradius.');
  }
  assertFinitePositive(
    'stepKineticCoefficient',
    configuration.stepKineticCoefficient,
  );
  if (
    !Number.isFinite(configuration.nucleationPrefactor) ||
    configuration.nucleationPrefactor < 0
  ) {
    throw new RangeError('nucleationPrefactor must be finite and nonnegative.');
  }
  if (
    !Number.isFinite(configuration.nucleationBarrier) ||
    configuration.nucleationBarrier < 0
  ) {
    throw new RangeError('nucleationBarrier must be finite and nonnegative.');
  }
  assertFinitePositive(
    'latentHeatPerVolume',
    configuration.latentHeatPerVolume,
  );
  assertFinitePositive('timeStep', configuration.timeStep);
}

function polygonFromSupports(
  normals: readonly Candidate2CFacetedVec2[],
  supports: readonly number[],
): Candidate2CFacetedPolygon {
  if (normals.length !== 6 || supports.length !== normals.length) {
    throw new RangeError('A faceted loop requires exactly six supports.');
  }
  const vertices: Candidate2CFacetedVec2[] = [];
  for (let index = 0; index < normals.length; index += 1) {
    const left = normals[index] ?? [Number.NaN, Number.NaN];
    const right = normals[(index + 1) % normals.length] ?? [
      Number.NaN,
      Number.NaN,
    ];
    const leftSupport = supports[index] ?? Number.NaN;
    const rightSupport = supports[(index + 1) % supports.length] ?? Number.NaN;
    const determinant = left[0] * right[1] - left[1] * right[0];
    if (!(determinant > 0)) {
      throw new RangeError('Faceted loop normals must be cyclically ordered.');
    }
    vertices.push([
      (leftSupport * right[1] - left[1] * rightSupport) / determinant,
      (left[0] * rightSupport - leftSupport * right[0]) / determinant,
    ]);
  }

  const edgeLengths = normals.map((_, index) => {
    const start = vertices[(index + vertices.length - 1) % vertices.length] ?? [
      Number.NaN,
      Number.NaN,
    ];
    const end = vertices[index] ?? [Number.NaN, Number.NaN];
    return Math.hypot(end[0] - start[0], end[1] - start[1]);
  });
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index] ?? [Number.NaN, Number.NaN];
    const next = vertices[(index + 1) % vertices.length] ?? [
      Number.NaN,
      Number.NaN,
    ];
    twiceArea += current[0] * next[1] - current[1] * next[0];
  }
  const area = 0.5 * twiceArea;
  const supportArea =
    0.5 *
    supports.reduce(
      (sum, support, index) =>
        sum + support * (edgeLengths[index] ?? Number.NaN),
      0,
    );
  if (
    !(area >= 0) ||
    !Number.isFinite(supportArea) ||
    edgeLengths.some((length) => !Number.isFinite(length) || length < 0)
  ) {
    throw new RangeError('Faceted loop polygon is not finite and convex.');
  }
  return {
    supports: [...supports],
    vertices,
    edgeLengths,
    area,
    supportArea,
  };
}

export function createCandidate2CFacetedFrame(
  configuration: Candidate2CFacetedConfiguration,
): Candidate2CFacetedFrame {
  validateConfiguration(configuration);
  const basis = crystalAxesFromEuler(configuration.orientation);
  const tangentU = basis[0];
  const tangentV = basis[1];
  const planeNormal = basis[2];
  const projected = snBiPyramidFacetNormals(configuration.orientation).map(
    (facetNormal) => {
      const axial = dot3(facetNormal, planeNormal);
      return normalize3([
        facetNormal[0] - axial * planeNormal[0],
        facetNormal[1] - axial * planeNormal[1],
        facetNormal[2] - axial * planeNormal[2],
      ]);
    },
  );
  const normals3D = projected
    .flatMap((normal) => [normal, [-normal[0], -normal[1], -normal[2]] as Vec3])
    .sort(
      (left, right) =>
        Math.atan2(dot3(left, tangentV), dot3(left, tangentU)) -
        Math.atan2(dot3(right, tangentV), dot3(right, tangentU)),
    );
  const normals2D = normals3D.map(
    (normal) =>
      [
        dot3(normal, tangentU),
        dot3(normal, tangentV),
      ] as Candidate2CFacetedVec2,
  );
  const outerPolygon = polygonFromSupports(
    normals2D,
    new Array<number>(6).fill(configuration.facetInradius),
  );
  return {
    planeNormal,
    tangentU,
    tangentV,
    normals2D,
    normals3D,
    outerPolygon,
  };
}

export function candidate2CFacetedLoopPolygon(
  frame: Candidate2CFacetedFrame,
  inwardOffset: number,
): Candidate2CFacetedPolygon {
  const inradius = frame.outerPolygon.supports[0] ?? Number.NaN;
  if (
    !Number.isFinite(inwardOffset) ||
    inwardOffset < 0 ||
    inwardOffset > inradius
  ) {
    throw new RangeError('inwardOffset must lie in [0, facetInradius].');
  }
  return polygonFromSupports(
    frame.normals2D,
    frame.outerPolygon.supports.map((support) => support - inwardOffset),
  );
}

export function candidate2CFacetedLevel(
  frame: Candidate2CFacetedFrame,
  inwardOffset: number,
  point: Candidate2CFacetedVec2,
): number {
  const polygon = candidate2CFacetedLoopPolygon(frame, inwardOffset);
  return frame.normals2D.reduce(
    (level, normal, index) =>
      Math.max(
        level,
        normal[0] * point[0] +
          normal[1] * point[1] -
          (polygon.supports[index] ?? Number.NaN),
      ),
    Number.NEGATIVE_INFINITY,
  );
}

function volumeFromGeometry(
  configuration: Candidate2CFacetedConfiguration,
  frame: Candidate2CFacetedFrame,
  completedLayers: number,
  activeLoopOffsets: readonly number[],
): number {
  const outerArea = frame.outerPolygon.area;
  return (
    configuration.stepHeight *
    (completedLayers * outerArea +
      activeLoopOffsets.reduce(
        (sum, offset) =>
          sum + outerArea - candidate2CFacetedLoopPolygon(frame, offset).area,
        0,
      ))
  );
}

export function candidate2CFacetedGeometryVolume(
  state: Candidate2CFacetedState,
): number {
  return volumeFromGeometry(
    state.configuration,
    state.frame,
    state.completedLayers,
    state.activeLoopOffsets,
  );
}

export function createCandidate2CFacetedState(
  configuration: Candidate2CFacetedConfiguration,
): Candidate2CFacetedState {
  const frame = createCandidate2CFacetedFrame(configuration);
  return {
    configuration,
    frame,
    activeLoopOffsets: [],
    completedLayers: 0,
    nucleationAccumulator: 0,
    emittedLayers: 0,
    integratedSolidVolume: 0,
    releasedLatentHeat: 0,
    time: 0,
    step: 0,
  };
}

export function stepCandidate2CFacetedState(
  state: Candidate2CFacetedState,
  undercooling: number,
): Candidate2CFacetedState {
  if (!Number.isFinite(undercooling) || undercooling < 0) {
    throw new RangeError('undercooling must be finite and nonnegative.');
  }
  const { configuration, frame } = state;
  const duration = configuration.timeStep;
  const inradius = configuration.facetInradius;
  const stepSpeed = configuration.stepKineticCoefficient * undercooling;
  const nextOffsets: number[] = [];
  let completedLayers = state.completedLayers;

  const moveOffset = (offset: number, movementDuration: number): void => {
    const nextOffset = Math.min(
      inradius,
      offset + stepSpeed * Math.max(0, movementDuration),
    );
    if (nextOffset >= inradius) completedLayers += 1;
    else nextOffsets.push(nextOffset);
  };
  for (const offset of state.activeLoopOffsets) {
    moveOffset(offset, duration);
  }

  const layerBirthRate =
    candidate2CNucleationVelocity(
      undercooling,
      configuration.nucleationPrefactor,
      configuration.nucleationBarrier,
    ) / configuration.stepHeight;
  const accumulatedLayers =
    state.nucleationAccumulator + layerBirthRate * duration;
  const births = Math.floor(accumulatedLayers);
  if (layerBirthRate > 0) {
    for (let birth = 0; birth < births; birth += 1) {
      const eventTime =
        (1 - state.nucleationAccumulator + birth) / layerBirthRate;
      moveOffset(configuration.birthInwardOffset, duration - eventTime);
    }
  }
  nextOffsets.sort((left, right) => right - left);

  const geometryVolume = volumeFromGeometry(
    configuration,
    frame,
    completedLayers,
    nextOffsets,
  );
  const sweptVolume = geometryVolume - state.integratedSolidVolume;
  if (sweptVolume < -1e-12 * Math.max(1, geometryVolume)) {
    throw new RangeError('Faceted-loop solid volume must not decrease.');
  }
  return {
    configuration,
    frame,
    activeLoopOffsets: nextOffsets,
    completedLayers,
    nucleationAccumulator: accumulatedLayers - births,
    emittedLayers: state.emittedLayers + births,
    integratedSolidVolume: geometryVolume,
    releasedLatentHeat:
      state.releasedLatentHeat +
      Math.max(0, sweptVolume) * configuration.latentHeatPerVolume,
    time: state.time + duration,
    step: state.step + 1,
  };
}

export function runCandidate2CFacetedSteps(
  initial: Candidate2CFacetedState,
  steps: number,
  undercooling: number,
): Candidate2CFacetedState {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError('steps must be a nonnegative integer.');
  }
  let state = initial;
  for (let step = 0; step < steps; step += 1) {
    state = stepCandidate2CFacetedState(state, undercooling);
  }
  return state;
}
