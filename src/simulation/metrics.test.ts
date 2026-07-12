import { describe, expect, it } from 'vitest';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
} from './config';
import { createInitialCpuState, gridIndex } from './cpu-reference';
import {
  evaluateExpectedMorphology,
  measureFaceCenterDepression,
  measureGrowthMaturity,
  measureMorphology,
  measureSolidBounds,
  measureSymmetry,
  measureTransitionMorphology,
  summarizeField,
} from './metrics';

function metricConfig() {
  return deriveSimulationConfiguration(
    createSimulationConfiguration('hopper', {
      parameters: {
        initialRadius: 1,
        criticalRadius: 0.5,
        interfaceWidth: 0.5,
      },
      grid: { shape: [9, 9, 9], spacing: 1, timeStep: 0.001 },
    }),
  );
}

describe('simulation metrics', () => {
  it('summarizes finite values and reports non-finite samples', () => {
    expect(
      summarizeField([1, 2, Number.NaN, 5, Number.POSITIVE_INFINITY]),
    ).toEqual({
      minimum: 1,
      maximum: 5,
      mean: 8 / 3,
      finiteCount: 3,
      nonFiniteCount: 2,
    });
  });

  it('measures thresholded solid bounds in physical coordinates', () => {
    const config = metricConfig();
    const phase = new Float32Array(config.voxelCount);
    phase.fill(1);
    phase[gridIndex(2, 3, 4, config.grid.shape)] = 0;
    phase[gridIndex(6, 5, 4, config.grid.shape)] = 0;

    expect(measureSolidBounds(phase, config)).toEqual({
      empty: false,
      minimum: [-2, -1, 0],
      maximum: [2, 1, 0],
      extent: [4, 2, 0],
      voxelCount: 2,
    });
  });

  it('detects mirror asymmetry independently on each axis', () => {
    const config = metricConfig();
    const symmetric = new Float32Array(config.voxelCount);
    symmetric.fill(1);
    symmetric[gridIndex(2, 4, 4, config.grid.shape)] = 0;
    symmetric[gridIndex(6, 4, 4, config.grid.shape)] = 0;
    expect(measureSymmetry(symmetric, config.grid.shape).maximum).toBe(0);

    symmetric[gridIndex(6, 4, 4, config.grid.shape)] = 0.5;
    const asymmetric = measureSymmetry(symmetric, config.grid.shape);
    expect(asymmetric.x).toBeGreaterThan(0);
    expect(asymmetric.y).toBe(0);
    expect(asymmetric.z).toBe(0);
  });

  it('measures face-center depression against the outer solid extent', () => {
    const config = metricConfig();
    const phase = new Float32Array(config.voxelCount);
    phase.fill(1);

    for (let z = 1; z <= 7; z += 1) {
      for (let y = 1; y <= 7; y += 1) {
        for (let x = 1; x <= 7; x += 1) {
          const offsets = [Math.abs(x - 4), Math.abs(y - 4), Math.abs(z - 4)];
          const nonZeroAxes = offsets.filter((offset) => offset > 0).length;
          const onRecessedCenterRay =
            nonZeroAxes === 1 && Math.max(...offsets) > 1;
          if (!onRecessedCenterRay) {
            phase[gridIndex(x, y, z, config.grid.shape)] = 0;
          }
        }
      }
    }

    const depression = measureFaceCenterDepression(phase, config);
    expect(depression.faces).toHaveLength(6);
    expect(depression.faces.every((face) => face.depth === 2)).toBe(true);
    expect(depression.meanDepth).toBe(2);
  });

  it('does not mistake one off-axis outlier for a face depression', () => {
    const config = metricConfig();
    const phase = new Float32Array(config.voxelCount);
    phase.fill(1);
    phase[gridIndex(4, 4, 4, config.grid.shape)] = 0;
    phase[gridIndex(5, 4, 4, config.grid.shape)] = 0.5;
    phase[gridIndex(8, 5, 4, config.grid.shape)] = 0;

    const depression = measureFaceCenterDepression(phase, config);
    const positiveX = depression.faces.find(
      (face) => face.axis === 'x' && face.direction === 1,
    );
    const bounds = measureSolidBounds(phase, config);

    expect(positiveX).toEqual({
      axis: 'x',
      direction: 1,
      outerRadius: 1,
      centerRadius: 1,
      depth: 0,
    });
    expect(bounds.maximum).toEqual([4, 1, 0]);
    expect(bounds.voxelCount).toBe(3);
  });

  it('combines finite field and baseline symmetry diagnostics', () => {
    const state = createInitialCpuState(metricConfig());
    const metrics = measureMorphology(state);
    expect(metrics.phase.nonFiniteCount).toBe(0);
    expect(metrics.chemicalPotential.nonFiniteCount).toBe(0);
    expect(metrics.solidVolume).toBeGreaterThan(0);
    expect(metrics.symmetry.maximum).toBe(0);
  });

  it('distinguishes a filled cube from a resolved hopper recession', () => {
    const config = metricConfig();
    const cube = new Float32Array(config.voxelCount);
    cube.fill(1);
    for (let z = 2; z <= 6; z += 1) {
      for (let y = 2; y <= 6; y += 1) {
        for (let x = 2; x <= 6; x += 1) {
          cube[gridIndex(x, y, z, config.grid.shape)] = 0;
        }
      }
    }

    const cubeTransition = measureTransitionMorphology(cube, config);
    const cubeDepression = measureFaceCenterDepression(cube, config);
    expect(cubeTransition.boundingBoxFillFraction).toBe(1);
    expect(cubeTransition.connectedComponentCount).toBe(1);
    expect(cubeTransition.largestConnectedComponentFraction).toBe(1);
    expect(cubeTransition.directionalReach.bodyDiagonalToFaceRatio).toBe(1);
    expect(
      evaluateExpectedMorphology('cube', cubeTransition, cubeDepression, config)
        .passed,
    ).toBe(true);
    expect(
      evaluateExpectedMorphology(
        'hopper',
        cubeTransition,
        cubeDepression,
        config,
      ).passed,
    ).toBe(false);

    const hopper = new Float32Array(cube);
    for (const [x, y, z] of [
      [2, 4, 4],
      [3, 4, 4],
      [5, 4, 4],
      [6, 4, 4],
      [4, 2, 4],
      [4, 3, 4],
      [4, 5, 4],
      [4, 6, 4],
      [4, 4, 2],
      [4, 4, 3],
      [4, 4, 5],
      [4, 4, 6],
      [4, 4, 4],
    ] as const) {
      hopper[gridIndex(x, y, z, config.grid.shape)] = 1;
    }
    const hopperTransition = measureTransitionMorphology(hopper, config);
    expect(hopperTransition.boundingBoxFillFraction).toBeLessThan(0.9);
    expect(hopperTransition.surfaceComplexity).toBeGreaterThan(
      cubeTransition.surfaceComplexity,
    );
  });

  it('reports disconnected solids and diagonal-arm reach', () => {
    const config = metricConfig();
    const phase = new Float32Array(config.voxelCount);
    phase.fill(1);
    for (let offset = -3; offset <= 3; offset += 1) {
      phase[gridIndex(4 + offset, 4 + offset, 4 + offset, config.grid.shape)] =
        0;
    }
    phase[gridIndex(1, 7, 4, config.grid.shape)] = 0;

    const transition = measureTransitionMorphology(phase, config);
    expect(transition.connectedComponentCount).toBe(8);
    expect(transition.largestConnectedComponentFraction).toBe(1 / 8);
    expect(transition.directionalReach.bodyDiagonal[0]).toBeGreaterThan(0);
    expect(transition.directionalReach.bodyDiagonal[7]).toBeGreaterThan(0);
    expect(transition.directionalReach.meanFace).toBe(0);
  });

  it('interprets an octant field as a mirrored full crystal', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper', {
        domainMode: 'octant',
        parameters: {
          initialRadius: 1,
          criticalRadius: 0.5,
          interfaceWidth: 0.5,
        },
        grid: { shape: [9, 9, 9], spacing: 1, timeStep: 0.001 },
      }),
    );
    const phase = new Float32Array(config.voxelCount);
    phase.fill(1);
    for (let z = 0; z <= 4; z += 1) {
      for (let y = 0; y <= 4; y += 1) {
        for (let x = 0; x <= 4; x += 1) {
          phase[gridIndex(x, y, z, config.grid.shape)] = 0;
        }
      }
    }

    const bounds = measureSolidBounds(phase, config);
    const transition = measureTransitionMorphology(phase, config);
    const maturity = measureGrowthMaturity(phase, config);
    expect(bounds.minimum).toEqual([-4, -4, -4]);
    expect(bounds.maximum).toEqual([4, 4, 4]);
    expect(bounds.extent).toEqual([8, 8, 8]);
    expect(transition.boundingBoxFillFraction).toBe(1);
    expect(transition.directionalReach.bodyDiagonalToFaceRatio).toBe(1);
    expect(maturity.maximumDirectionalReach).toBe(4);
    expect(maturity.radiusMultiple).toBe(4);
    expect(maturity.farBoundaryDistance).toBe(8);
    expect(maturity.farBoundaryClearanceRatio).toBe(1);
  });
});
