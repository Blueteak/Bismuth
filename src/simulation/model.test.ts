import { describe, expect, it } from 'vitest';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
  type Vec3,
} from './config';
import {
  anisotropyFlux,
  anisotropyMagnitude,
  chemicalSourceIncrement,
  chemicalSourceRate,
  doubleWell,
  doubleWellDerivative,
  interpolation,
  interpolationDerivative,
  phaseDiffusivity,
  phaseLocalRate,
} from './model';

const identityAxes = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
] as const;

describe('paper phase-field model', () => {
  it('implements the potential and interpolation functions and derivatives', () => {
    expect(doubleWell(0)).toBe(0);
    expect(doubleWell(1)).toBe(0);
    expect(doubleWell(0.5)).toBeCloseTo(0.03125);
    expect(interpolation(0)).toBe(0);
    expect(interpolation(1)).toBe(1);

    for (const phi of [0.1, 0.3, 0.7, 0.9]) {
      const step = 1e-6;
      expect(doubleWellDerivative(phi)).toBeCloseTo(
        (doubleWell(phi + step) - doubleWell(phi - step)) / (2 * step),
        7,
      );
      expect(interpolationDerivative(phi)).toBeCloseTo(
        (interpolation(phi + step) - interpolation(phi - step)) / (2 * step),
        7,
      );
    }
  });

  it('interpolates diffusivity between the solid and liquid values', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper'),
    );
    expect(phaseDiffusivity(0, config)).toBeCloseTo(config.solidDiffusivity);
    expect(phaseDiffusivity(1, config)).toBeCloseTo(
      config.parameters.liquidDiffusivity,
    );
  });

  it('implements the regularized cubic anisotropy and its derivative', () => {
    const gradient: Vec3 = [0.4, -0.7, 1.2];
    const epsilon = 0.02;
    const magnitude = anisotropyMagnitude(gradient, identityAxes, epsilon);
    const squaredGradient = gradient.reduce(
      (sum, component) => sum + component * component,
      0,
    );
    expect(magnitude).toBeCloseTo(
      gradient.reduce(
        (sum, component) =>
          sum + Math.sqrt(component ** 2 + epsilon ** 2 * squaredGradient),
        0,
      ),
    );

    const flux = anisotropyFlux(gradient, identityAxes, epsilon);
    const finiteDifference = (axis: 0 | 1 | 2) => {
      const step = 1e-6;
      const plus = [...gradient] as [number, number, number];
      const minus = [...gradient] as [number, number, number];
      plus[axis] += step;
      minus[axis] -= step;
      return (
        (0.5 * anisotropyMagnitude(plus, identityAxes, epsilon) ** 2 -
          0.5 * anisotropyMagnitude(minus, identityAxes, epsilon) ** 2) /
        (2 * step)
      );
    };
    expect(flux[0]).toBeCloseTo(finiteDifference(0), 6);
    expect(flux[1]).toBeCloseTo(finiteDifference(1), 6);
    expect(flux[2]).toBeCloseTo(finiteDifference(2), 6);
    expect(anisotropyFlux([0, 0, 0], identityAxes, epsilon)).toEqual([0, 0, 0]);
  });

  it('keeps pure bulk phases stationary and couples phase rate into mu', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper'),
    );
    expect(phaseLocalRate(0, 1, 0, config)).toBe(0);
    expect(phaseLocalRate(1, 0.04, 0, config)).toBe(0);
    expect(chemicalSourceRate(0.5, 2, config)).toBeCloseTo(-4.8);
    expect(chemicalSourceIncrement(0.4, 0.6, config)).toBeCloseTo(
      -config.parameters.freeEnergyCurvature *
        config.deltaConcentration *
        (interpolation(0.6) - interpolation(0.4)),
    );
  });

  it('conserves implied concentration with the exact Delta-g source', () => {
    const config = deriveSimulationConfiguration(
      createSimulationConfiguration('hopper'),
    );
    const { parameters, deltaConcentration } = config;
    const impliedConcentration = (phi: number, chemicalPotential: number) =>
      parameters.solidConcentration +
      deltaConcentration * interpolation(phi) +
      (chemicalPotential - parameters.equilibriumChemicalPotential) /
        parameters.freeEnergyCurvature;

    for (const [oldPhi, nextPhi, oldMu] of [
      [0.1, 0.9, 0.37],
      [0.9, 0.1, 0.82],
      [0.49, 0.51, -0.2],
    ] as const) {
      const nextMu = oldMu + chemicalSourceIncrement(oldPhi, nextPhi, config);

      expect(impliedConcentration(nextPhi, nextMu)).toBeCloseTo(
        impliedConcentration(oldPhi, oldMu),
        14,
      );
    }
  });
});
