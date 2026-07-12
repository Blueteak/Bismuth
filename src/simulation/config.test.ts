import { describe, expect, it } from 'vitest';
import {
  PAPER_CONSTANTS,
  SIMULATION_PRESETS,
  createSimulationConfiguration,
  crystalAxesFromEuler,
  deriveSimulationConfiguration,
  farFieldChemicalPotentialAt,
  validateSimulationConfiguration,
} from './config';

describe('simulation configuration', () => {
  it('transcribes the paper constants and named morphology series', () => {
    expect(PAPER_CONSTANTS).toMatchObject({
      mobility: 1,
      liquidConcentration: 0.9,
      solidConcentration: 0.5,
      equilibriumChemicalPotential: 1,
      freeEnergyCurvature: 4,
      criticalRadius: 10,
      initialRadius: 20,
      interfaceWidth: 2,
      anisotropyRegularization: 0.02,
      surfaceEnergyScale: 1 / (3 * 1.02 ** 2),
      farFieldChemicalPotential: 0.04,
    });
    expect(SIMULATION_PRESETS.cube.parameters.liquidDiffusivity).toBe(20);
    expect(SIMULATION_PRESETS.hopper.parameters.liquidDiffusivity).toBeCloseTo(
      1 / 12,
    );
    expect(SIMULATION_PRESETS.fractal.parameters.liquidDiffusivity).toBe(0.5);
    expect(SIMULATION_PRESETS.dendritic.parameters.liquidDiffusivity).toBe(4);
  });

  it('derives concentration, diffusivity, coupling, and stability values', () => {
    const derived = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper'),
    );

    expect(derived.deltaConcentration).toBeCloseTo(0.4);
    expect(derived.solidDiffusivity).toBeCloseTo((1 / 12) * 1e-4);
    expect(derived.couplingLambda).toBeCloseTo(2.4);
    expect(derived.surfaceEnergyNormalization).toBeCloseTo(1 / (3 * 1.02 ** 2));
    expect(derived.voxelCount).toBe(65 ** 3);
    expect(derived.maximumStableTimeStep).toBeGreaterThanOrEqual(
      derived.grid.timeStep,
    );
  });

  it('derives the source normalization and active-stencil stability bound', () => {
    const config = createSimulationConfiguration('hopper', {
      parameters: {
        mobility: 2,
        liquidDiffusivity: 0.4,
        criticalRadius: 0.5,
        initialRadius: 1,
        interfaceWidth: 0.1,
        anisotropyRegularization: 0.05,
      },
      grid: { shape: [65, 65, 65], spacing: 0.25, timeStep: 1e-5 },
    });
    const derived = deriveSimulationConfiguration(config);
    const { parameters, grid } = config;
    const epsilon = parameters.anisotropyRegularization;
    const normalization = 1 / (3 * (1 + epsilon) ** 2);
    const axisRoot = Math.sqrt(1 + epsilon ** 2);
    const axisAnisotropy = axisRoot + 2 * epsilon;
    const normalStiffness = axisAnisotropy ** 2;
    const transverseStiffness =
      axisAnisotropy * (epsilon ** 2 / axisRoot + 1 / epsilon + 2 * epsilon);
    const phaseTrace =
      parameters.mobility *
      normalization *
      (normalStiffness + 2 * transverseStiffness);
    const phaseDiffusionEigenvalue = (4 * phaseTrace) / grid.spacing ** 2;
    const deltaConcentration =
      parameters.liquidConcentration - parameters.solidConcentration;
    const couplingLambda =
      (3 * parameters.criticalRadius * deltaConcentration ** 2) /
      parameters.interfaceWidth;
    const maximumInitialChemicalDeparture = Math.abs(
      parameters.equilibriumChemicalPotential -
        parameters.farFieldChemicalPotential,
    );
    const localPhaseStiffness =
      (parameters.mobility / parameters.interfaceWidth ** 2) *
      (1 +
        (6 * maximumInitialChemicalDeparture * deltaConcentration) /
          couplingLambda);
    const phaseLimit = 2 / (phaseDiffusionEigenvalue + localPhaseStiffness);
    const chemicalDiffusion =
      parameters.freeEnergyCurvature * parameters.liquidDiffusivity;
    const chemicalLimit = grid.spacing ** 2 / (2 * 3 * chemicalDiffusion);
    const expectedLimit = Math.min(0.01, 0.9 * phaseLimit, 0.9 * chemicalLimit);

    expect(derived.surfaceEnergyNormalization).toBeCloseTo(normalization, 14);
    expect(derived.maximumStableTimeStep).toBeCloseTo(expectedLimit, 14);
    expect(() =>
      validateSimulationConfiguration({
        ...config,
        grid: { ...grid, timeStep: expectedLimit },
      }),
    ).not.toThrow();
    expect(() =>
      validateSimulationConfiguration({
        ...config,
        grid: { ...grid, timeStep: expectedLimit * (1 + 1e-6) },
      }),
    ).toThrow(/stability limit/);
  });

  it('rotates orthonormal crystal axes with the documented Euler convention', () => {
    expect(crystalAxesFromEuler({ x: 0, y: 0, z: 0 })).toEqual([
      [1, 0, -0],
      [0, 1, 0],
      [0, 0, 1],
    ]);

    const [axisX, axisY, axisZ] = crystalAxesFromEuler({
      x: 0,
      y: 0,
      z: Math.PI / 2,
    });
    expect(axisX[0]).toBeCloseTo(0);
    expect(axisX[1]).toBeCloseTo(1);
    expect(axisY[0]).toBeCloseTo(-1);
    expect(axisY[1]).toBeCloseTo(0);
    expect(axisZ).toEqual([0, 0, 1]);
  });

  it('applies a physical, non-normalized far-field gradient', () => {
    const config = createSimulationConfiguration('hopper', {
      perturbations: { farFieldGradient: [0.001, -0.002, 0.003] },
    });

    expect(farFieldChemicalPotentialAt(config, [2, 3, -4])).toBeCloseTo(
      0.04 + 0.002 - 0.006 - 0.012,
    );
  });

  it('derives an octant domain and rejects symmetry-breaking inputs', () => {
    const octant = createSimulationConfiguration('hopper', {
      domainMode: 'octant',
      grid: { shape: [65, 65, 65], spacing: 2 },
    });
    const derived = deriveSimulationConfiguration(octant);

    expect(derived.domainCenter).toEqual([0, 0, 0]);
    expect(derived.domainMinimum).toEqual([0, 0, 0]);
    expect(derived.domainMaximum).toEqual([128, 128, 128]);
    expect(() =>
      createSimulationConfiguration('hopper', {
        domainMode: 'octant',
        orientation: { z: 0.1 },
      }),
    ).toThrow(/axis-aligned/);
    expect(() =>
      createSimulationConfiguration('hopper', {
        domainMode: 'octant',
        perturbations: { seedRadiusAmplitude: 0.1 },
      }),
    ).toThrow(/unperturbed/);
  });

  it('rejects unstable or physically invalid configurations', () => {
    const base = createSimulationConfiguration('hopper');
    expect(() =>
      validateSimulationConfiguration({
        ...base,
        grid: { ...base.grid, timeStep: 1 },
      }),
    ).toThrow(/stability limit/);
    expect(() =>
      validateSimulationConfiguration({
        ...base,
        perturbations: { ...base.perturbations, seedRadiusAmplitude: 3 },
      }),
    ).toThrow(/seedRadiusAmplitude/);
    expect(() =>
      validateSimulationConfiguration({
        ...base,
        perturbations: {
          ...base.perturbations,
          chemicalPotentialCorrelationLength: 1,
        },
      }),
    ).toThrow(/correlation lengths/);
    expect(() =>
      validateSimulationConfiguration({
        ...base,
        parameters: { ...base.parameters, anisotropyRegularization: 0 },
      }),
    ).toThrow(/anisotropyRegularization/);
    expect(() =>
      validateSimulationConfiguration({
        ...base,
        grid: { ...base.grid, shape: [9, 9, 9] },
      }),
    ).toThrow(/fit inside the domain/);
    expect(() =>
      validateSimulationConfiguration({
        ...base,
        parameters: { ...base.parameters, interfaceWidth: 0.01 },
      }),
    ).toThrow(/stability limit/);
  });
});
