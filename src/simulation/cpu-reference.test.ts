import { describe, expect, it } from 'vitest';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
  farFieldChemicalPotentialAt,
  type DerivedSimulationConfiguration,
} from './config';
import {
  UNBORN_SOLIDIFICATION_TIME,
  authorCenteredAnisotropyDivergence,
  captureSolidificationTimes,
  computeCpuChemicalPotentialStep,
  computeCpuPhaseStep,
  createInitialCpuState,
  gridIndex,
  stepCpuSimulation,
  type CpuSimulationState,
} from './cpu-reference';

function smallConfig(
  perturbations: Parameters<typeof createSimulationConfiguration>[1] = {},
): DerivedSimulationConfiguration {
  return deriveSimulationConfiguration(
    createSimulationConfiguration('hopper', {
      parameters: {
        initialRadius: 1.5,
        criticalRadius: 0.75,
        interfaceWidth: 1,
      },
      grid: { shape: [11, 11, 11], spacing: 1, timeStep: 0.001 },
      ...perturbations,
    }),
  );
}

function uniformLiquidState(
  config: DerivedSimulationConfiguration,
): CpuSimulationState {
  const phase = new Float32Array(config.voxelCount);
  phase.fill(1);
  const chemicalPotential = new Float32Array(config.voxelCount);
  chemicalPotential.fill(config.parameters.farFieldChemicalPotential);
  const solidificationTime = new Float32Array(config.voxelCount);
  solidificationTime.fill(UNBORN_SOLIDIFICATION_TIME);
  return {
    config,
    phase,
    chemicalPotential,
    solidificationTime,
    time: 0,
    step: 0,
  };
}

describe('CPU phase-field reference', () => {
  it('initializes the centered analytical seed and exact mu reservoir', () => {
    const config = smallConfig({
      perturbations: { farFieldGradient: [0.01, -0.005, 0.002] },
    });
    const state = createInitialCpuState(config);
    const center = gridIndex(5, 5, 5, config.grid.shape);
    const seedSurface = gridIndex(6, 6, 5, config.grid.shape);
    const boundary = gridIndex(0, 5, 5, config.grid.shape);

    expect(state.phase[center]).toBeCloseTo(1 / (1 + Math.exp(1.5)), 6);
    expect(state.phase[seedSurface]).toBeGreaterThan(state.phase[center] ?? 0);
    expect(state.chemicalPotential[boundary]).toBeCloseTo(
      farFieldChemicalPotentialAt(config, [-5, 0, 0]),
      6,
    );
    expect(state.solidificationTime[center]).toBe(0);
    expect(state.solidificationTime[boundary]).toBe(UNBORN_SOLIDIFICATION_TIME);
  });

  it('keeps perturbations deterministic and changes them with the seed', () => {
    const overrides = {
      perturbations: {
        seed: 123,
        seedRadiusAmplitude: 0.2,
        chemicalPotentialAmplitude: 0.03,
      },
    } as const;
    const first = createInitialCpuState(smallConfig(overrides));
    const repeated = createInitialCpuState(smallConfig(overrides));
    const different = createInitialCpuState(
      smallConfig({
        perturbations: { ...overrides.perturbations, seed: 124 },
      }),
    );

    expect(first.phase).toEqual(repeated.phase);
    expect(first.chemicalPotential).toEqual(repeated.chemicalPotential);
    expect(first.phase).not.toEqual(different.phase);
    expect(first.chemicalPotential).not.toEqual(different.chemicalPotential);
  });

  it('leaves a uniform equilibrium liquid invariant', () => {
    const state = uniformLiquidState(smallConfig());
    const next = stepCpuSimulation(state);
    expect(next.phase).toEqual(state.phase);
    expect(next.chemicalPotential).toEqual(state.chemicalPotential);
    expect(next.solidificationTime).toEqual(state.solidificationTime);
  });

  it('uses conservative variable-D face fluxes', () => {
    const state = createInitialCpuState(smallConfig());
    const constantMu = new Float32Array(state.config.voxelCount);
    constantMu.fill(state.config.parameters.farFieldChemicalPotential);
    const constantState = { ...state, chemicalPotential: constantMu };
    const phaseStep = {
      phase: state.phase,
      phaseRate: new Float32Array(state.config.voxelCount),
    };

    expect(computeCpuChemicalPotentialStep(constantState, phaseStep)).toEqual(
      constantMu,
    );
  });

  it('applies the exact Delta-g source in the split chemical step', () => {
    const state = uniformLiquidState(smallConfig());
    const center = gridIndex(5, 5, 5, state.config.grid.shape);
    const oldPhase = new Float32Array(state.phase);
    oldPhase[center] = 0.2;
    const chemicalPotential = new Float32Array(state.chemicalPotential);
    chemicalPotential.fill(0.37);
    const oldState = { ...state, phase: oldPhase, chemicalPotential };
    const nextPhase = new Float32Array(oldPhase);
    nextPhase[center] = 0.8;
    const phaseStep = {
      phase: nextPhase,
      phaseRate: new Float32Array(state.config.voxelCount),
    };
    const nextMu = computeCpuChemicalPotentialStep(oldState, phaseStep);
    const { parameters, deltaConcentration } = state.config;
    const impliedConcentration = (phi: number, mu: number) =>
      parameters.solidConcentration +
      deltaConcentration * (3 * phi ** 2 - 2 * phi ** 3) +
      (mu - parameters.equilibriumChemicalPotential) /
        parameters.freeEnergyCurvature;

    expect(
      impliedConcentration(
        nextPhase[center] ?? Number.NaN,
        nextMu[center] ?? Number.NaN,
      ),
    ).toBeCloseTo(
      impliedConcentration(
        oldPhase[center] ?? Number.NaN,
        chemicalPotential[center] ?? Number.NaN,
      ),
      6,
    );
  });

  it('stages phase before chemical potential and advances deterministically', () => {
    const state = createInitialCpuState(smallConfig());
    const phaseStep = computeCpuPhaseStep(state);
    const chemical = computeCpuChemicalPotentialStep(state, phaseStep);
    const stepped = stepCpuSimulation(state);

    expect(stepped.phase).toEqual(phaseStep.phase);
    expect(stepped.chemicalPotential).toEqual(chemical);
    expect(stepped.time).toBeCloseTo(state.config.grid.timeStep);
    expect(stepped.step).toBe(1);
    expect(Array.from(stepped.phase).every(Number.isFinite)).toBe(true);
    expect(Array.from(stepped.chemicalPotential).every(Number.isFinite)).toBe(
      true,
    );

    let firstRun = stepped;
    let repeatedRun = stepCpuSimulation(state);
    for (let step = 0; step < 4; step += 1) {
      firstRun = stepCpuSimulation(firstRun);
      repeatedRun = stepCpuSimulation(repeatedRun);
    }
    expect(firstRun.phase).toEqual(repeatedRun.phase);
    expect(firstRun.chemicalPotential).toEqual(repeatedRun.chemicalPotential);
    expect(Array.from(firstRun.phase).every(Number.isFinite)).toBe(true);
    expect(Array.from(firstRun.chemicalPotential).every(Number.isFinite)).toBe(
      true,
    );
  });

  it('applies Neumann phase and gradient-reservoir mu at the boundary', () => {
    const config = smallConfig({
      perturbations: { farFieldGradient: [0.01, 0, 0] },
    });
    const initialized = createInitialCpuState(config);
    const modifiedPhase = new Float32Array(initialized.phase);
    modifiedPhase[gridIndex(0, 5, 5, config.grid.shape)] = 0.25;
    const state = { ...initialized, phase: modifiedPhase };
    const phaseStep = computeCpuPhaseStep(state);
    const boundary = gridIndex(0, 5, 5, config.grid.shape);
    const nearestInterior = gridIndex(1, 5, 5, config.grid.shape);
    expect(phaseStep.phase[boundary]).toBe(phaseStep.phase[nearestInterior]);

    const nextMu = computeCpuChemicalPotentialStep(state, phaseStep);
    expect(nextMu[boundary]).toBeCloseTo(
      farFieldChemicalPotentialAt(config, [-5, 0, 0]),
      6,
    );
  });

  it('applies octant symmetry at origin planes and a reservoir at far faces', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper', {
        domainMode: 'octant',
        parameters: {
          initialRadius: 2.5,
          criticalRadius: 1,
          interfaceWidth: 1,
        },
        grid: { shape: [11, 11, 11], spacing: 1, timeStep: 0.001 },
      }),
    );
    const initialized = createInitialCpuState(config);
    const symmetry = gridIndex(0, 1, 1, config.grid.shape);
    const nearestInterior = gridIndex(1, 1, 1, config.grid.shape);
    const far = gridIndex(10, 1, 1, config.grid.shape);

    expect(initialized.phase[symmetry]).toBe(
      initialized.phase[nearestInterior],
    );
    expect(initialized.chemicalPotential[symmetry]).toBe(
      initialized.chemicalPotential[nearestInterior],
    );
    expect(initialized.solidificationTime[symmetry]).toBe(0);
    expect(initialized.chemicalPotential[far]).toBeCloseTo(
      config.parameters.farFieldChemicalPotential,
      7,
    );
    expect(initialized.solidificationTime[far]).toBe(-1);

    const stepped = stepCpuSimulation(initialized);
    expect(stepped.phase[symmetry]).toBe(stepped.phase[nearestInterior]);
    expect(stepped.chemicalPotential[symmetry]).toBe(
      stepped.chemicalPotential[nearestInterior],
    );
    expect(stepped.chemicalPotential[far]).toBeCloseTo(
      config.parameters.farFieldChemicalPotential,
      7,
    );
  });

  it('couples adjacent lattice sites through analytic near-isotropic face fluxes', () => {
    const epsilon = 10;
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper', {
        parameters: {
          initialRadius: 1.5,
          criticalRadius: 0.75,
          interfaceWidth: 1,
          anisotropyRegularization: epsilon,
        },
        grid: { shape: [11, 11, 11], spacing: 1, timeStep: 1e-4 },
      }),
    );
    const phase = new Float32Array(config.voxelCount);
    phase.fill(0.5);
    const center = gridIndex(5, 5, 5, config.grid.shape);
    const plusX = gridIndex(6, 5, 5, config.grid.shape);
    phase[plusX] = 0.51;
    const chemicalPotential = new Float32Array(config.voxelCount);
    chemicalPotential.fill(config.parameters.equilibriumChemicalPotential);
    const state: CpuSimulationState = {
      config,
      phase,
      chemicalPotential,
      solidificationTime: new Float32Array(config.voxelCount).fill(-1),
      time: 0,
      step: 0,
    };

    // For a one-dimensional face gradient g, A = C |g| and F_x = C^2 g,
    // where C = sqrt(1 + epsilon^2) + 2 epsilon. The prior centered-
    // gradient/centered-divergence stencil incorrectly returned zero here.
    const centerPhi = phase[center] ?? Number.NaN;
    const faceGradient = (phase[plusX] ?? Number.NaN) - centerPhi;
    const anisotropyCoefficient = Math.sqrt(1 + epsilon ** 2) + 2 * epsilon;
    const plusFlux = Math.fround(
      config.surfaceEnergyNormalization *
        anisotropyCoefficient ** 2 *
        faceGradient,
    );
    const expected = Math.fround(
      centerPhi + config.grid.timeStep * Math.fround(plusFlux),
    );
    const next = computeCpuPhaseStep(state);

    expect(next.phase[center]).toBe(expected);
    expect(next.phase[center]).toBeGreaterThan(centerPhi);
  });

  it('supports the authors centered gradient-Hessian phase operator', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper', {
        phaseOperator: 'author-centered',
        parameters: {
          initialRadius: 1.5,
          criticalRadius: 0.75,
          interfaceWidth: 1,
        },
        grid: { shape: [11, 11, 11], spacing: 1, timeStep: 1e-4 },
      }),
    );
    const phase = new Float32Array(config.voxelCount);
    phase.fill(0.5);
    phase[gridIndex(4, 5, 5, config.grid.shape)] = 0.51;
    phase[gridIndex(6, 5, 5, config.grid.shape)] = 0.51;
    const centerCoordinate = [5, 5, 5] as const;
    const divergence = authorCenteredAnisotropyDivergence(
      phase,
      [...centerCoordinate],
      config,
    );
    expect(divergence).toBeCloseTo(0.02, 6);

    const chemicalPotential = new Float32Array(config.voxelCount);
    chemicalPotential.fill(config.parameters.equilibriumChemicalPotential);
    const state: CpuSimulationState = {
      config,
      phase,
      chemicalPotential,
      solidificationTime: new Float32Array(config.voxelCount).fill(-1),
      time: 0,
      step: 0,
    };
    const next = computeCpuPhaseStep(state);
    expect(
      next.phase[gridIndex(...centerCoordinate, config.grid.shape)],
    ).toBeCloseTo(0.5 + config.grid.timeStep * divergence, 7);
  });

  it('captures downward threshold crossings once', () => {
    const captured = captureSolidificationTimes(
      new Float32Array([0.6, 0.6, 0.4, 0.4]),
      new Float32Array([0.4, 0.4, 0.3, 0.7]),
      new Float32Array([-1, 2, -1, -1]),
      3.5,
      0.5,
    );

    expect(Array.from(captured)).toEqual([3.5, 2, -1, -1]);
  });

  it('does not conceal instability by clamping phase values', () => {
    const config = smallConfig();
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

    const phaseStep = computeCpuPhaseStep(state);
    expect(phaseStep.phase[gridIndex(5, 5, 5, config.grid.shape)]).toBeLessThan(
      0,
    );
  });
});
