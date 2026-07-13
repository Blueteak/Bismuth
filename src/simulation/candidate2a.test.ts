import { describe, expect, it } from 'vitest';
import {
  bismuthKineticCoefficient,
  bismuthSlowFacetNormals,
  bismuthSurfaceEnergy,
  CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
  createInitialCandidate2AThermalState,
  measureCandidate2APlanarSignature,
  relaxationTimeForKineticCoefficient,
  runCandidate2AThermalSteps,
  sharpInterfaceLiquidTemperature,
  sharpInterfacePlanarVelocity,
  thinInterfaceKineticCoefficient,
  totalDimensionlessEnthalpy,
  type Candidate2AThermalConfiguration,
} from './candidate2a';

const isolationFacetParameters = CANDIDATE2A_FACET_ISOLATION_PARAMETERS;

const planarConfiguration: Candidate2AThermalConfiguration = {
  shape: [65, 33, 3],
  spacing: 0.5,
  timeStep: 0.005,
  thermalDiffusivity: 1,
  undercooling: 1.2,
  interfaceWidth: 1,
  couplingLambda: 2,
  kineticCoefficient: 2,
  initialFrontPosition: 12,
  freeSurface: {
    enabled: false,
    biotNumber: 1,
    ambientTemperature: -1.5,
  },
};

describe('Candidate 2A thermal/free-surface isolation', () => {
  it('constructs the observed {1-102} hexagonal facet family explicitly', () => {
    const normals = bismuthSlowFacetNormals();
    expect(normals).toHaveLength(3);
    for (const normal of normals) {
      expect(Math.hypot(...normal)).toBeCloseTo(1, 12);
      expect(normal[2]).toBeGreaterThan(0);
    }
    expect(normals[0]?.[0]).not.toBeCloseTo(normals[1]?.[0] ?? 0, 6);
  });

  it('keeps surface energy and attachment kinetics independent', () => {
    const facetNormals = bismuthSlowFacetNormals();
    const facet = facetNormals[0];
    const offFacet = [0, 0, 1] as const;
    const facetGamma = bismuthSurfaceEnergy(
      facet,
      facetNormals,
      isolationFacetParameters,
    );
    const offFacetGamma = bismuthSurfaceEnergy(
      offFacet,
      facetNormals,
      isolationFacetParameters,
    );
    const facetBeta = bismuthKineticCoefficient(
      facet,
      facetNormals,
      isolationFacetParameters,
    );
    const offFacetBeta = bismuthKineticCoefficient(
      offFacet,
      facetNormals,
      isolationFacetParameters,
    );

    expect(facetGamma).toBeLessThan(offFacetGamma);
    expect(facetBeta).toBeGreaterThan(offFacetBeta);
    expect(sharpInterfacePlanarVelocity(1.2, facetBeta)).toBeLessThan(
      sharpInterfacePlanarVelocity(1.2, offFacetBeta),
    );

    const kineticsOnlyChange = {
      ...isolationFacetParameters,
      kineticCoefficientContrast: 0.25,
    };
    expect(bismuthSurfaceEnergy(facet, facetNormals, kineticsOnlyChange)).toBe(
      facetGamma,
    );
    expect(
      bismuthKineticCoefficient(facet, facetNormals, kineticsOnlyChange),
    ).not.toBe(facetBeta);
  });

  it('round-trips the sourced thin-interface kinetic mapping', () => {
    const relaxationTime = relaxationTimeForKineticCoefficient(2, 1, 2, 1);
    expect(
      thinInterfaceKineticCoefficient(relaxationTime, 1, 2, 1),
    ).toBeCloseTo(2, 12);
  });

  it('converges the one-dimensional sharp-interface thermal profile', () => {
    const residual = (spacing: number) => {
      const undercooling = 1.2;
      const beta = 2;
      const diffusivity = 1;
      const velocity = sharpInterfacePlanarVelocity(undercooling, beta);
      let maximum = 0;
      for (let x = spacing; x <= 8; x += spacing) {
        const left = sharpInterfaceLiquidTemperature(
          x - spacing,
          undercooling,
          beta,
          diffusivity,
        );
        const center = sharpInterfaceLiquidTemperature(
          x,
          undercooling,
          beta,
          diffusivity,
        );
        const right = sharpInterfaceLiquidTemperature(
          x + spacing,
          undercooling,
          beta,
          diffusivity,
        );
        const first = (right - left) / (2 * spacing);
        const second = (right - 2 * center + left) / spacing ** 2;
        maximum = Math.max(
          maximum,
          Math.abs(velocity * first + diffusivity * second),
        );
      }
      return maximum;
    };

    const coarse = residual(0.5);
    const fine = residual(0.25);
    expect(coarse / fine).toBeGreaterThan(3.5);
    expect(coarse / fine).toBeLessThan(4.5);
  });

  it('conserves dimensionless enthalpy in the no-flux 1D latent-heat case', () => {
    const initial = createInitialCandidate2AThermalState({
      ...planarConfiguration,
      shape: [65, 1, 1],
      freeSurface: { ...planarConfiguration.freeSurface, enabled: false },
    });
    const final = runCandidate2AThermalSteps(initial, 100);
    expect(totalDimensionlessEnthalpy(final)).toBeCloseTo(
      totalDimensionlessEnthalpy(initial),
      4,
    );
  });

  it('isolates contact-line acceleration to the heat-removal boundary', () => {
    const sourceOffInitial =
      createInitialCandidate2AThermalState(planarConfiguration);
    const sourceOnInitial = createInitialCandidate2AThermalState({
      ...planarConfiguration,
      freeSurface: { ...planarConfiguration.freeSurface, enabled: true },
    });
    const steps = 600;
    const sourceOff = measureCandidate2APlanarSignature(
      sourceOffInitial,
      runCandidate2AThermalSteps(sourceOffInitial, steps),
    );
    const sourceOn = measureCandidate2APlanarSignature(
      sourceOnInitial,
      runCandidate2AThermalSteps(sourceOnInitial, steps),
    );

    expect(sourceOff.finite).toBe(true);
    expect(sourceOn.finite).toBe(true);
    expect(Math.abs(sourceOff.excessContactLineAdvance)).toBeLessThan(1e-6);
    expect(sourceOn.excessContactLineAdvance).toBeGreaterThan(0.02);
    expect(sourceOn.contactLineAdvance).toBeGreaterThan(
      sourceOff.contactLineAdvance,
    );
  });
});
