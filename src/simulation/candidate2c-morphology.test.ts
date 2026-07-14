import { describe, expect, it } from 'vitest';
import { extractMarchingCubesReference } from '../extraction/marching-cubes-reference';
import type { ExtractionVec3 } from '../extraction/marching-cubes';
import { candidate2CFacetedLoopPolygon } from './candidate2c-faceted';
import {
  CANDIDATE2C_FACETED_THERMAL_ISOLATION,
  createCandidate2CFacetedThermalState,
  type Candidate2CFacetedThermalState,
} from './candidate2c-faceted-thermal';
import {
  CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER,
  CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN,
  candidate2CFacetedMorphologyAnalyticVolume,
  createCandidate2CFacetedMorphologySnapshot,
  createCandidate2CFacetedMorphologyScreenConfiguration,
  sampleCandidate2CFacetedMorphology,
} from './candidate2c-morphology';
import {
  CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT,
  CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT,
  createCandidate2CFacetedMorphologySpaceRefinedConfiguration,
  createCandidate2CFacetedMorphologyTimeRefinedConfiguration,
} from './candidate2c-morphology-refinement';

const FIXED_OFFSETS = Object.freeze([
  0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125,
] as const);
const COARSE_SPACING = 0.125;
const COARSE_SHAPE = Object.freeze([80, 26, 80] as const);
const COARSE_ORIGIN = Object.freeze([-4.9375, -0.5625, -4.9375] as const);

function geometryVolume(
  state: Candidate2CFacetedThermalState,
  completedLayers: number,
  activeLoopOffsets: readonly number[],
): number {
  const { frame, stepHeight } = state.configuration;
  const outerArea = frame.outerPolygon.area;
  return (
    stepHeight *
    (completedLayers * outerArea +
      activeLoopOffsets.reduce(
        (sum, offset) =>
          sum + outerArea - candidate2CFacetedLoopPolygon(frame, offset).area,
        0,
      ))
  );
}

function fixtureState(
  completedLayers = 0,
  activeLoopOffsets: readonly number[] = FIXED_OFFSETS,
): Candidate2CFacetedThermalState {
  const initial = createCandidate2CFacetedThermalState(
    CANDIDATE2C_FACETED_THERMAL_ISOLATION,
  );
  return {
    ...initial,
    activeLoopOffsets: [...activeLoopOffsets],
    completedLayers,
    emittedLayers: completedLayers + activeLoopOffsets.length,
    integratedSolidVolume: geometryVolume(
      initial,
      completedLayers,
      activeLoopOffsets,
    ),
    maximumLocalSolidHeight:
      (completedLayers + activeLoopOffsets.length) *
      initial.configuration.stepHeight,
    time: CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.evaluationTime,
    step: CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.totalSteps,
  };
}

function gridIndex(
  x: number,
  y: number,
  z: number,
  shape: readonly [number, number, number],
): number {
  return x + shape[0] * (y + shape[1] * z);
}

function nearestGridIndex(coordinate: number, axis: 0 | 2): number {
  const { physicalOrigin, spacing, shape } =
    CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER;
  return Math.max(
    0,
    Math.min(
      shape[axis] - 1,
      Math.round((coordinate - physicalOrigin[axis]) / spacing),
    ),
  );
}

function topCrossing(field: Float32Array, x: number, z: number): number {
  const { shape, spacing, physicalOrigin } =
    CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER;
  let crossing = Number.NaN;
  for (let y = 0; y + 1 < shape[1]; y += 1) {
    const lower = field[gridIndex(x, y, z, shape)] ?? Number.NaN;
    const upper = field[gridIndex(x, y + 1, z, shape)] ?? Number.NaN;
    if (lower >= 0 && upper < 0) {
      const fraction = lower / (lower - upper);
      crossing = physicalOrigin[1] + (y + fraction) * spacing;
    }
  }
  return crossing;
}

function maximumTopCrossing(field: Float32Array): number {
  const { shape } = CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let z = 0; z < shape[2]; z += 1) {
    for (let x = 0; x < shape[0]; x += 1) {
      const crossing = topCrossing(field, x, z);
      if (Number.isFinite(crossing)) maximum = Math.max(maximum, crossing);
    }
  }
  return maximum;
}

function labelSolidComponents(
  field: Float32Array,
  shape: readonly [number, number, number],
): number[] {
  const visited = new Uint8Array(field.length);
  const queue = new Int32Array(field.length);
  const componentSizes: number[] = [];
  for (let start = 0; start < field.length; start += 1) {
    if ((field[start] ?? -1) < 0 || visited[start] !== 0) continue;
    let head = 0;
    let tail = 1;
    let size = 0;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++] ?? -1;
      size += 1;
      const x = index % shape[0];
      const yz = (index - x) / shape[0];
      const y = yz % shape[1];
      const z = (yz - y) / shape[1];
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < shape[0] ? index + 1 : -1,
        y > 0 ? index - shape[0] : -1,
        y + 1 < shape[1] ? index + shape[0] : -1,
        z > 0 ? index - shape[0] * shape[1] : -1,
        z + 1 < shape[2] ? index + shape[0] * shape[1] : -1,
      ];
      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          (field[neighbor] ?? -1) >= 0 &&
          visited[neighbor] === 0
        ) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    componentSizes.push(size);
  }
  return componentSizes;
}

function extractionPhase(orderParameter: Float32Array): Float32Array {
  const phase = new Float32Array(orderParameter.length);
  for (let index = 0; index < phase.length; index += 1) {
    phase[index] = (1 - (orderParameter[index] ?? Number.NaN)) / 2;
  }
  return phase;
}

function sampleObservationalField(
  state: Candidate2CFacetedThermalState,
  shape: readonly [number, number, number],
  spacing: number,
  origin: readonly [number, number, number],
): Float32Array {
  const field = new Float32Array(shape[0] * shape[1] * shape[2]);
  for (let z = 0; z < shape[2]; z += 1) {
    for (let y = 0; y < shape[1]; y += 1) {
      for (let x = 0; x < shape[0]; x += 1) {
        field[gridIndex(x, y, z, shape)] = sampleCandidate2CFacetedMorphology(
          state,
          [
            origin[0] + x * spacing,
            origin[1] + y * spacing,
            origin[2] + z * spacing,
          ],
        );
      }
    }
  }
  return field;
}

function vertexKey(position: ExtractionVec3): string {
  return position.map((value) => value.toFixed(7)).join(',');
}

function validateClosedConnectedMesh(
  positions: readonly ExtractionVec3[],
): void {
  const edgeUses = new Map<string, number>();
  const orientedEdgeBalance = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();
  for (let index = 0; index < positions.length; index += 3) {
    const vertices = [
      vertexKey(positions[index]!),
      vertexKey(positions[index + 1]!),
      vertexKey(positions[index + 2]!),
    ];
    expect(new Set(vertices).size).toBe(3);
    for (let edge = 0; edge < 3; edge += 1) {
      const first = vertices[edge]!;
      const second = vertices[(edge + 1) % 3]!;
      const key = [first, second].sort().join('|');
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
      orientedEdgeBalance.set(
        key,
        (orientedEdgeBalance.get(key) ?? 0) + (first < second ? 1 : -1),
      );
      const firstNeighbors = adjacency.get(first) ?? new Set<string>();
      firstNeighbors.add(second);
      adjacency.set(first, firstNeighbors);
      const secondNeighbors = adjacency.get(second) ?? new Set<string>();
      secondNeighbors.add(first);
      adjacency.set(second, secondNeighbors);
    }
  }
  expect([...edgeUses.values()].every((count) => count === 2)).toBe(true);
  expect([...orientedEdgeBalance.values()].every((sum) => sum === 0)).toBe(
    true,
  );
  expect(adjacency.size - edgeUses.size + positions.length / 3).toBe(2);

  const start = adjacency.keys().next().value;
  expect(start).toBeDefined();
  const visited = new Set<string>(start ? [start] : []);
  const pending = start ? [start] : [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  expect(visited.size).toBe(adjacency.size);
}

function meshSignedVolume(positions: readonly ExtractionVec3[]): number {
  let sixVolume = 0;
  for (let index = 0; index < positions.length; index += 3) {
    const a = positions[index]!;
    const b = positions[index + 1]!;
    const c = positions[index + 2]!;
    sixVolume +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return sixVolume / 6;
}

describe('Candidate 2C observational scalar carrier', () => {
  it('fixes the aligned temporal and spatial screen protocols', () => {
    const carrier = CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER;
    const screen = CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN;
    expect(carrier.shape).toEqual([158, 42, 158]);
    expect(carrier.spacing).toBe(0.0625);
    expect(carrier.physicalOrigin).toEqual([-4.90625, -0.28125, -4.90625]);
    expect(carrier.observationalTransitionWidth).toBe(0.125);
    expect(carrier.baseLayerCount).toBe(1);
    expect(carrier.maximumTotalLayerCount).toBe(8);
    expect(screen.timeStep).toBe(0.0009375);
    expect(screen.timeStep * screen.totalSteps).toBe(screen.evaluationTime);
    expect(screen.checkpointSteps).toHaveLength(17);
    expect(screen.checkpointSteps.at(-1)).toBe(1600);
    const screenConfiguration =
      createCandidate2CFacetedMorphologyScreenConfiguration();
    expect(screenConfiguration.timeStep).toBe(0.0009375);
    expect(screenConfiguration.shape).toEqual(
      CANDIDATE2C_FACETED_THERMAL_ISOLATION.shape,
    );
    const refinement = CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT;
    expect(refinement.base.checkpointSteps).toEqual(screen.checkpointSteps);
    expect(refinement.refined.totalSteps).toBe(3200);
    expect(refinement.refined.timeStep).toBe(0.00046875);
    expect(refinement.refined.checkpointInterval).toBe(200);
    expect(refinement.refined.checkpointSteps).toEqual(
      Array.from({ length: 17 }, (_, index) => index * 200),
    );
    expect(refinement.refined.checkpointTimes).toEqual(
      refinement.base.checkpointTimes,
    );
    expect(refinement.gates).toEqual({
      maximumTimeAlignmentError: 1e-12,
      maximumLayerPhaseDifference: 0.15,
      maximumBirthTimeDifference: 0.05,
      maximumMatchedLoopOffsetDifference: 0.05,
      maximumContinuousDifference: 0.05,
      maximumLedgerResidual: 1e-10,
    });
    const refinedConfiguration =
      createCandidate2CFacetedMorphologyTimeRefinedConfiguration();
    const { timeStep: baseTimeStep, ...baseFrozenConfiguration } =
      screenConfiguration;
    const { timeStep: refinedTimeStep, ...refinedFrozenConfiguration } =
      refinedConfiguration;
    expect(refinedTimeStep).toBe(baseTimeStep / 2);
    expect(refinedFrozenConfiguration).toEqual(baseFrozenConfiguration);

    const spaceRefinement = CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT;
    expect(spaceRefinement.base.checkpointSteps).toEqual(
      screen.checkpointSteps,
    );
    expect(spaceRefinement.refined.checkpointSteps).toEqual(
      screen.checkpointSteps,
    );
    expect(spaceRefinement.refined.timeStep).toBe(screen.timeStep);
    expect(spaceRefinement.refinedShape).toEqual([160, 96, 160]);
    expect(spaceRefinement.refinedSpacing).toBe(0.1875);
    expect(spaceRefinement.gates).toEqual({
      maximumTimeAlignmentError: 1e-12,
      maximumDiscreteTerraceDifference: 1,
      maximumOpeningDepthDifferenceInSteps: 1,
      maximumLayerPhaseDifference: 0.25,
      maximumBirthTimeDifference: 0.1,
      maximumMatchedLoopOffsetDifference: 0.1,
      maximumContinuousDifference: 0.15,
      maximumLedgerResidual: 1e-10,
    });
    const spaceConfiguration =
      createCandidate2CFacetedMorphologySpaceRefinedConfiguration();
    expect(spaceConfiguration.shape).toEqual([160, 96, 160]);
    expect(spaceConfiguration.spacing).toBe(0.1875);
    expect(spaceConfiguration.timeStep).toBe(screen.timeStep);
    expect(
      spaceConfiguration.shape.map((size) => size * spaceConfiguration.spacing),
    ).toEqual(
      screenConfiguration.shape.map(
        (size) => size * screenConfiguration.spacing,
      ),
    );
  });

  it('preserves analytic volume, exact plateaus, and every loop support', () => {
    const state = fixtureState();
    const snapshot = createCandidate2CFacetedMorphologySnapshot(state);
    const expectedVolume =
      state.integratedSolidVolume +
      state.configuration.frame.outerPolygon.area *
        state.configuration.stepHeight;
    expect(candidate2CFacetedMorphologyAnalyticVolume(state)).toBeCloseTo(
      expectedVolume,
      11,
    );
    expect(snapshot.shape).toEqual(
      CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.shape,
    );
    expect(snapshot.orderParameter.length).toBe(snapshot.voxelCount);
    expect(snapshot.step).toBe(1600);
    expect(snapshot.simulatedTime).toBe(1.5);

    const centerX = nearestGridIndex(0, 0);
    const centerZ = nearestGridIndex(0, 2);
    const centerHeight =
      (CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.baseLayerCount +
        state.completedLayers) *
      state.configuration.stepHeight;
    const rimHeight =
      (CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.baseLayerCount +
        state.completedLayers +
        state.activeLoopOffsets.length) *
      state.configuration.stepHeight;
    expect(topCrossing(snapshot.orderParameter, centerX, centerZ)).toBeCloseTo(
      centerHeight,
      7,
    );
    expect(maximumTopCrossing(snapshot.orderParameter)).toBeCloseTo(
      rimHeight,
      7,
    );

    for (let index = 0; index < state.activeLoopOffsets.length; index += 1) {
      const offset = state.activeLoopOffsets[index]!;
      const support = state.configuration.facetInradius - offset;
      const y =
        (CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.baseLayerCount +
          state.completedLayers +
          index +
          0.5) *
        state.configuration.stepHeight;
      for (const normal of state.configuration.frame.normals3D) {
        const boundary = [normal[0] * support, y, normal[2] * support] as const;
        const outward = [
          boundary[0] +
            normal[0] * CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.spacing,
          y,
          boundary[2] +
            normal[2] * CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.spacing,
        ] as const;
        const inward = [
          boundary[0] -
            normal[0] * CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.spacing,
          y,
          boundary[2] -
            normal[2] * CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.spacing,
        ] as const;
        expect(sampleCandidate2CFacetedMorphology(state, boundary)).toBeCloseTo(
          0,
          11,
        );
        expect(
          sampleCandidate2CFacetedMorphology(state, outward),
        ).toBeGreaterThan(0);
        expect(sampleCandidate2CFacetedMorphology(state, inward)).toBeLessThan(
          0,
        );
      }
    }
  });

  it('stays one solid component and extracts a closed mesh within capacity', () => {
    const state = fixtureState();
    const snapshot = createCandidate2CFacetedMorphologySnapshot(state);
    const components = labelSolidComponents(
      snapshot.orderParameter,
      snapshot.shape,
    );
    expect(components).toHaveLength(1);
    expect(components[0]).toBeGreaterThan(0);

    const mesh = extractMarchingCubesReference({
      field: extractionPhase(snapshot.orderParameter),
      shape: snapshot.shape,
      spacing: CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.spacing,
      physicalOrigin: CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.physicalOrigin,
    });
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(mesh.positions.length).toBeLessThanOrEqual(
      CANDIDATE2C_FACETED_MORPHOLOGY_CARRIER.maximumExtractionVertexCount,
    );
    validateClosedConnectedMesh(mesh.positions);
    const expectedVolume = candidate2CFacetedMorphologyAnalyticVolume(state);
    const fineVolume = meshSignedVolume(mesh.positions);
    expect(fineVolume).toBeGreaterThan(0);
    const fineVolumeError =
      Math.abs(fineVolume - expectedVolume) / expectedVolume;
    expect(fineVolumeError).toBeLessThan(0.02);

    const coarseMesh = extractMarchingCubesReference({
      field: extractionPhase(
        sampleObservationalField(
          state,
          COARSE_SHAPE,
          COARSE_SPACING,
          COARSE_ORIGIN,
        ),
      ),
      shape: COARSE_SHAPE,
      spacing: COARSE_SPACING,
      physicalOrigin: COARSE_ORIGIN,
    });
    const coarseVolume = meshSignedVolume(coarseMesh.positions);
    expect(coarseVolume).toBeGreaterThan(0);
    const coarseVolumeError =
      Math.abs(coarseVolume - expectedVolume) / expectedVolume;
    expect(coarseVolumeError).toBeLessThanOrEqual(0.04);
    expect(fineVolumeError).toBeLessThan(coarseVolumeError);
  });

  it('accepts exactly eight total layers and rejects overflow or crossings', () => {
    const full = fixtureState(7, []);
    expect(() =>
      createCandidate2CFacetedMorphologySnapshot(full),
    ).not.toThrow();
    expect(() =>
      createCandidate2CFacetedMorphologySnapshot(fixtureState(8, [])),
    ).toThrow(/capacity/);
    expect(() =>
      createCandidate2CFacetedMorphologySnapshot({
        ...fixtureState(),
        loopCrossingDetected: true,
      }),
    ).toThrow(/crossing/);
    expect(() =>
      createCandidate2CFacetedMorphologySnapshot({
        ...fixtureState(),
        integratedSolidVolume: Number.NaN,
      }),
    ).toThrow(/finite/);
  });
});
