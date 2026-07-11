import { describe, expect, it } from 'vitest';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
} from './config';
import { createInitialCpuState, gridIndex } from './cpu-reference';
import {
  measureFaceCenterDepression,
  measureMorphology,
  measureSolidBounds,
  measureSymmetry,
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
});
