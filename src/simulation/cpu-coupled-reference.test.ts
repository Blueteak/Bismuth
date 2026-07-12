import { describe, expect, it } from 'vitest';
import {
  createInitialCpuState,
  evaluateCpuChemicalPotentialUpdateMap,
  gridIndex,
  solveCpuCoupledBackwardEulerStep,
  stepCpuSimulation,
  UNBORN_SOLIDIFICATION_TIME,
  type CpuSimulationState,
} from './cpu-reference';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
  type SimulationConfigurationOverrides,
} from './config';
import {
  measureContinuousDirectionalReach,
  runCpuCouplingExperiment,
} from './cpu-coupling-experiment';
import { interpolation } from './model';

function coupledConfig(overrides: SimulationConfigurationOverrides = {}) {
  return deriveSimulationConfiguration(
    createSimulationConfiguration('dendritic', {
      phaseOperator: 'author-centered',
      domainMode: 'octant',
      grid: { shape: [17, 17, 17], spacing: 2, timeStep: 0.01 },
      perturbations: {
        seedRadiusAmplitude: 0,
        chemicalPotentialAmplitude: 0,
        farFieldGradient: [0, 0, 0],
      },
      ...overrides,
    }),
  );
}

function uniformLiquidState(): CpuSimulationState {
  const config = coupledConfig();
  const phase = new Float32Array(config.voxelCount);
  phase.fill(1);
  const chemicalPotential = new Float32Array(config.voxelCount);
  chemicalPotential.fill(config.parameters.farFieldChemicalPotential);
  return {
    config,
    phase,
    chemicalPotential,
    solidificationTime: new Float32Array(config.voxelCount).fill(
      UNBORN_SOLIDIFICATION_TIME,
    ),
    time: 0,
    step: 0,
  };
}

describe('coupled CPU backward-Euler reference', () => {
  it('keeps uniform equilibrium liquid at an exact fixed point', () => {
    const state = uniformLiquidState();
    const result = solveCpuCoupledBackwardEulerStep(state);

    expect(result.diagnostics.converged).toBe(true);
    expect(result.diagnostics.iterations).toBe(0);
    expect(result.diagnostics.residual.maximumNormalized).toBeLessThan(0.005);
    expect(result.state?.phase).toEqual(state.phase);
    expect(result.state?.chemicalPotential).toEqual(state.chemicalPotential);
    expect(result.state?.time).toBeCloseTo(0.01);
  });

  it('reduces a nontrivial split predictor defect to the Float32 residual floor', () => {
    const state = createInitialCpuState(coupledConfig());
    const first = solveCpuCoupledBackwardEulerStep(state);
    const repeated = solveCpuCoupledBackwardEulerStep(state);

    expect(first.diagnostics.converged).toBe(true);
    expect(first.diagnostics.iterations).toBeGreaterThan(0);
    expect(first.diagnostics.iterations).toBeLessThanOrEqual(8);
    expect(
      first.diagnostics.predictorResidual.maximumNormalized,
    ).toBeGreaterThan(100);
    expect(first.diagnostics.residual.maximumNormalized).toBeLessThanOrEqual(1);
    expect(first.diagnostics.update.maximumNormalized).toBeLessThanOrEqual(1);
    expect(
      first.diagnostics.predictorResidual.chemicalPotential.maximumAbsolute /
        first.diagnostics.residual.chemicalPotential.maximumAbsolute,
    ).toBeGreaterThan(100);
    expect(first.state?.phase).toEqual(repeated.state?.phase);
    expect(first.state?.chemicalPotential).toEqual(
      repeated.state?.chemicalPotential,
    );
    expect(Array.from(first.phase).every(Number.isFinite)).toBe(true);
    expect(Array.from(first.chemicalPotential).every(Number.isFinite)).toBe(
      true,
    );
  });

  it('reports non-convergence without advancing time or birth state', () => {
    const state = createInitialCpuState(coupledConfig());
    const split = stepCpuSimulation(state);
    const result = solveCpuCoupledBackwardEulerStep(state, {
      maximumIterations: 0,
    });

    expect(result.diagnostics.converged).toBe(false);
    expect(result.state).toBeNull();
    expect(result.phase).toEqual(split.phase);
    expect(result.chemicalPotential).toEqual(split.chemicalPotential);
    expect(state.time).toBe(0);
    expect(state.step).toBe(0);
  });

  it('enforces octant phase, symmetry, reservoir, and birth-time boundaries', () => {
    const state = createInitialCpuState(coupledConfig());
    const result = solveCpuCoupledBackwardEulerStep(state);
    expect(result.state).not.toBeNull();
    if (result.state === null) return;

    const { shape } = state.config.grid;
    const symmetry = gridIndex(0, 5, 5, shape);
    const symmetryInterior = gridIndex(1, 5, 5, shape);
    const far = gridIndex(16, 5, 5, shape);
    const farInterior = gridIndex(15, 5, 5, shape);
    expect(result.state.phase[symmetry]).toBe(
      result.state.phase[symmetryInterior],
    );
    expect(result.state.chemicalPotential[symmetry]).toBe(
      result.state.chemicalPotential[symmetryInterior],
    );
    expect(result.state.phase[far]).toBe(result.state.phase[farInterior]);
    expect(result.state.chemicalPotential[far]).toBeCloseTo(0.04, 7);
    expect(result.state.solidificationTime[far]).toBe(
      UNBORN_SOLIDIFICATION_TIME,
    );
    expect(result.diagnostics.residual.phaseBoundaryMaximum).toBe(0);
    expect(
      result.diagnostics.residual.chemicalPotentialBoundaryMaximum,
    ).toBeLessThanOrEqual(2e-9);
  });

  it('anchors the coupled Delta-g source at the old conserved chemical state', () => {
    const base = uniformLiquidState();
    const center = gridIndex(8, 8, 8, base.config.grid.shape);
    const oldPhase = new Float32Array(base.phase);
    oldPhase[center] = 0.2;
    const oldChemicalPotential = new Float32Array(base.chemicalPotential);
    oldChemicalPotential.fill(0.37);
    const state = {
      ...base,
      phase: oldPhase,
      chemicalPotential: oldChemicalPotential,
    };
    const evaluationPhase = new Float32Array(oldPhase);
    evaluationPhase[center] = 0.8;
    const evaluationChemicalPotential = new Float32Array(
      base.config.voxelCount,
    );
    evaluationChemicalPotential.fill(0.61);
    const mapped = evaluateCpuChemicalPotentialUpdateMap(
      state,
      evaluationPhase,
      evaluationChemicalPotential,
    );
    const scale =
      base.config.parameters.freeEnergyCurvature *
      base.config.deltaConcentration;

    expect(
      (mapped[center] ?? Number.NaN) + scale * interpolation(0.8),
    ).toBeCloseTo(
      (oldChemicalPotential[center] ?? Number.NaN) + scale * interpolation(0.2),
      6,
    );
  });

  it('does not clamp an unstable split predictor while diagnosing it', () => {
    const config = coupledConfig({
      parameters: {
        initialRadius: 3,
        criticalRadius: 1.5,
        interfaceWidth: 1,
      },
      grid: { shape: [11, 11, 11], spacing: 1, timeStep: 0.001 },
    });
    const phase = new Float32Array(config.voxelCount);
    phase.fill(0.5);
    const chemicalPotential = new Float32Array(config.voxelCount);
    chemicalPotential.fill(-1000);
    const state: CpuSimulationState = {
      config,
      phase,
      chemicalPotential,
      solidificationTime: new Float32Array(config.voxelCount).fill(-1),
      time: 0,
      step: 0,
    };
    const result = solveCpuCoupledBackwardEulerStep(state, {
      maximumIterations: 0,
    });

    expect(result.phase[gridIndex(5, 5, 5, config.grid.shape)]).toBeLessThan(0);
    expect(result.state).toBeNull();
  });

  it('rejects invalid nonlinear-solve controls', () => {
    const state = uniformLiquidState();
    expect(() =>
      solveCpuCoupledBackwardEulerStep(state, { maximumIterations: -1 }),
    ).toThrow(/maximumIterations/);
    expect(() =>
      solveCpuCoupledBackwardEulerStep(state, { residualTolerance: 0 }),
    ).toThrow(/residualTolerance/);
    expect(() =>
      solveCpuCoupledBackwardEulerStep(state, { relaxation: 1.1 }),
    ).toThrow(/relaxation/);
  });

  it('interpolates subcell threshold reach on face, edge, and diagonal rays', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('dendritic', {
        phaseOperator: 'author-centered',
        domainMode: 'octant',
        parameters: {
          initialRadius: 2,
          criticalRadius: 1,
          interfaceWidth: 1,
        },
        grid: { shape: [9, 9, 9], spacing: 1, timeStep: 0.0005 },
      }),
    );
    const phase = new Float32Array(config.voxelCount);
    for (let z = 0; z < 9; z += 1) {
      for (let y = 0; y < 9; y += 1) {
        for (let x = 0; x < 9; x += 1) {
          phase[gridIndex(x, y, z, config.grid.shape)] =
            Math.max(x, y, z) <= 3 ? 0 : 1;
        }
      }
    }

    expect(measureContinuousDirectionalReach(phase, config)).toEqual({
      face: 3.5,
      edge: 3.5,
      bodyDiagonal: 3.5,
      bodyDiagonalToFaceRatio: 1,
    });
  });

  it('distinguishes no solid from boundary-limited solid rays', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('dendritic', {
        phaseOperator: 'author-centered',
        domainMode: 'octant',
        parameters: {
          initialRadius: 2,
          criticalRadius: 1,
          interfaceWidth: 1,
        },
        grid: { shape: [9, 9, 9], spacing: 1, timeStep: 0.0005 },
      }),
    );
    const liquid = measureContinuousDirectionalReach(
      new Float32Array(config.voxelCount).fill(1),
      config,
    );
    const solid = measureContinuousDirectionalReach(
      new Float32Array(config.voxelCount).fill(0),
      config,
    );

    expect(liquid.face).toBe(0);
    expect(liquid.edge).toBe(0);
    expect(liquid.bodyDiagonal).toBe(0);
    expect(liquid.bodyDiagonalToFaceRatio).toBeNaN();
    expect(solid).toEqual({
      face: 8,
      edge: 8,
      bodyDiagonal: 8,
      bodyDiagonalToFaceRatio: 1,
    });
  });

  it('aborts the experiment when its deadline is already exhausted', () => {
    expect(() =>
      runCpuCouplingExperiment({ deadline: performance.now() - 1 }),
    ).toThrow(/exceeded its 25000 ms deadline/);
  });
});
