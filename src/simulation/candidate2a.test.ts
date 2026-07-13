import { describe, expect, it } from 'vitest';
import {
  advanceCandidate2ATemperature,
  bismuthKineticCoefficient,
  bismuthSlowFacetNormals,
  bismuthSurfaceEnergy,
  CANDIDATE2A_FACET_ISOLATION_PARAMETERS,
  CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION,
  CANDIDATE2A_PHASE_STIFFNESS_BOUND,
  candidate2ADiffuseSolidVolume,
  candidate2AFreeSurfaceBiotNumber,
  candidate2AFreeSurfaceHeatFlux,
  candidate2AFreeSurfaceHeatRate,
  candidate2AGradientEnergyDensity,
  candidate2APhaseDrivingForce,
  candidate2APhaseEnergy,
  candidate2APhaseForceDecomposition,
  candidate2APhaseFlux,
  createInitialCandidate2AThermalState,
  deriveCandidate2AThermalConfiguration,
  KARMA_RAPPEL_IVF_CONSTANTS,
  measureCandidate2APlanarSignature,
  preRelaxCandidate2ASurfaceSeed,
  relaxationTimeForKineticCoefficient,
  runCandidate2AThermalSteps,
  sharpInterfaceLiquidTemperature,
  sharpInterfacePlanarVelocity,
  stepCandidate2AThermalState,
  thinInterfaceKineticCoefficient,
  totalDimensionlessEnthalpy,
  type Candidate2AThermalState,
  type Candidate2AThermalConfiguration,
} from './candidate2a';
import type { Vec3 } from './config';

const isolationFacetParameters = CANDIDATE2A_FACET_ISOLATION_PARAMETERS;

function normalized(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function symmetricEigenvalues(
  matrix: readonly (readonly number[])[],
): number[] {
  const a00 = matrix[0]?.[0] ?? Number.NaN;
  const a01 = matrix[0]?.[1] ?? Number.NaN;
  const a02 = matrix[0]?.[2] ?? Number.NaN;
  const a11 = matrix[1]?.[1] ?? Number.NaN;
  const a12 = matrix[1]?.[2] ?? Number.NaN;
  const a22 = matrix[2]?.[2] ?? Number.NaN;
  const offDiagonalSquared = a01 ** 2 + a02 ** 2 + a12 ** 2;
  if (offDiagonalSquared === 0) return [a00, a11, a22].sort((a, b) => a - b);

  const mean = (a00 + a11 + a22) / 3;
  const scale = Math.sqrt(
    ((a00 - mean) ** 2 +
      (a11 - mean) ** 2 +
      (a22 - mean) ** 2 +
      2 * offDiagonalSquared) /
      6,
  );
  const b00 = (a00 - mean) / scale;
  const b01 = a01 / scale;
  const b02 = a02 / scale;
  const b11 = (a11 - mean) / scale;
  const b12 = a12 / scale;
  const b22 = (a22 - mean) / scale;
  const determinant =
    b00 * (b11 * b22 - b12 * b12) -
    b01 * (b01 * b22 - b12 * b02) +
    b02 * (b01 * b12 - b11 * b02);
  const angle = Math.acos(Math.max(-1, Math.min(1, determinant / 2))) / 3;
  const largest = mean + 2 * scale * Math.cos(angle);
  const smallest = mean + 2 * scale * Math.cos(angle + (2 * Math.PI) / 3);
  return [smallest, 3 * mean - largest - smallest, largest].sort(
    (a, b) => a - b,
  );
}

function sampleOrderParameter(
  state: Candidate2AThermalState,
  position: readonly [number, number],
): number {
  const { shape, spacing } = state.config;
  const gx = position[0] / spacing;
  const gy = position[1] / spacing;
  const x0 = Math.max(0, Math.min(shape[0] - 1, Math.floor(gx)));
  const y0 = Math.max(0, Math.min(shape[1] - 1, Math.floor(gy)));
  const x1 = Math.min(shape[0] - 1, x0 + 1);
  const y1 = Math.min(shape[1] - 1, y0 + 1);
  const tx = gx - x0;
  const ty = gy - y0;
  const at = (x: number, y: number) =>
    state.orderParameter[x + shape[0] * y] ?? Number.NaN;
  const lower = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const upper = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return lower * (1 - ty) + upper * ty;
}

function planarInterfaceOffset(
  state: Candidate2AThermalState,
  normal: Vec3,
): number {
  const unitNormal = normalized(normal);
  const center: readonly [number, number] = [
    ((state.config.shape[0] - 1) * state.config.spacing) / 2,
    ((state.config.shape[1] - 1) * state.config.spacing) / 2,
  ];
  const halfLength = 5 * state.config.interfaceWidth;
  const sampleStep = state.config.spacing / 4;
  let previousDistance = -halfLength;
  let previousValue = sampleOrderParameter(state, [
    center[0] + previousDistance * unitNormal[0],
    center[1] + previousDistance * unitNormal[1],
  ]);
  for (
    let distance = previousDistance + sampleStep;
    distance <= halfLength;
    distance += sampleStep
  ) {
    const value = sampleOrderParameter(state, [
      center[0] + distance * unitNormal[0],
      center[1] + distance * unitNormal[1],
    ]);
    if (previousValue >= 0 && value <= 0) {
      const fraction = previousValue / (previousValue - value);
      const crossing =
        previousDistance + fraction * (distance - previousDistance);
      return center[0] * unitNormal[0] + center[1] * unitNormal[1] + crossing;
    }
    previousDistance = distance;
    previousValue = value;
  }
  return Number.NaN;
}

interface PlanarRefinementResult {
  readonly advance: number;
  readonly timeStep: number;
}

function runPlanarRefinementCase(
  spacing: number,
  rotation: number,
  timeStepFraction: number,
): PlanarRefinementResult {
  const normal: Vec3 = [Math.cos(rotation), Math.sin(rotation), 0];
  const shapeSize = Math.round(16 / spacing) + 1;
  const center = ((shapeSize - 1) * spacing) / 2;
  const base: Candidate2AThermalConfiguration = {
    ...planarConfiguration,
    shape: [shapeSize, shapeSize, 1],
    spacing,
    timeStep: 1e-6,
    orientation: { x: 0, y: 0, z: rotation },
    initialCondition: {
      kind: 'planar-front',
      normal,
      offset: center * normal[0] + center * normal[1],
    },
    freeSurface: { ...planarConfiguration.freeSurface, enabled: false },
  };
  const bound =
    deriveCandidate2AThermalConfiguration(base).maximumStableTimeStep;
  const targetTime = 0.2;
  const steps = Math.ceil(targetTime / (timeStepFraction * bound));
  const configuration = { ...base, timeStep: targetTime / steps };
  const initial = createInitialCandidate2AThermalState(configuration);
  const final = runCandidate2AThermalSteps(initial, steps);
  return {
    advance:
      planarInterfaceOffset(final, normal) -
      planarInterfaceOffset(initial, normal),
    timeStep: configuration.timeStep,
  };
}

const planarConfiguration: Candidate2AThermalConfiguration = {
  shape: [65, 33, 3],
  spacing: 0.5,
  timeStep: 0.005,
  thermalDiffusivity: 1,
  undercooling: 1.2,
  interfaceWidth: 1,
  couplingLambda: 2,
  orientation: { x: 0, y: 0, z: 0 },
  initialCondition: {
    kind: 'planar-front',
    normal: [1, 0, 0],
    offset: 12,
  },
  freeSurface: {
    enabled: false,
    biotNumber: 1,
    ambientTemperature: -1.5,
  },
};

function frozenSurfaceTemperatureContrast(
  spacing: number,
  liquidBiotNumber: number,
  solidBiotNumber: number,
): number {
  const width = 32;
  const depth = 16;
  const interfaceOffset = width / 2;
  const base: Candidate2AThermalConfiguration = {
    ...planarConfiguration,
    shape: [
      Math.round(width / spacing) + 1,
      Math.round(depth / spacing) + 1,
      1,
    ],
    spacing,
    timeStep: 1e-6,
    initialCondition: {
      kind: 'planar-front',
      normal: [1, 0, 0],
      offset: interfaceOffset,
    },
    freeSurface: {
      enabled: true,
      biotNumber: liquidBiotNumber,
      solidBiotNumber,
      ambientTemperature: -1.5,
    },
  };
  const stableTimeStep =
    deriveCandidate2AThermalConfiguration(base).maximumStableTimeStep;
  const targetTime = 0.2;
  const steps = Math.ceil(targetTime / (0.5 * stableTimeStep));
  const configuration = { ...base, timeStep: targetTime / steps };
  let state = createInitialCandidate2AThermalState(configuration);
  for (let step = 0; step < steps; step += 1) {
    state = {
      ...state,
      temperature: advanceCandidate2ATemperature(state, state.orderParameter),
      step: state.step + 1,
      simulatedTime: (state.step + 1) * state.config.timeStep,
    };
  }
  const sampleOffset = 2;
  const solidX = Math.round((interfaceOffset - sampleOffset) / spacing);
  const liquidX = Math.round((interfaceOffset + sampleOffset) / spacing);
  return (
    (state.temperature[solidX] ?? Number.NaN) -
    (state.temperature[liquidX] ?? Number.NaN)
  );
}

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

  it('uses the gradient-energy derivative as the complete phase flux', () => {
    const facetNormals = bismuthSlowFacetNormals();
    const gradient: Vec3 = [0.37, -0.61, 1.13];
    const interfaceWidth = 0.8;
    const flux = candidate2APhaseFlux(gradient, interfaceWidth, facetNormals);
    const differenceStep = 1e-6;

    for (let axis = 0; axis < 3; axis += 1) {
      const plus = [...gradient] as [number, number, number];
      const minus = [...gradient] as [number, number, number];
      plus[axis] = (plus[axis] ?? Number.NaN) + differenceStep;
      minus[axis] = (minus[axis] ?? Number.NaN) - differenceStep;
      const derivative =
        (candidate2AGradientEnergyDensity(plus, interfaceWidth, facetNormals) -
          candidate2AGradientEnergyDensity(
            minus,
            interfaceWidth,
            facetNormals,
          )) /
        (2 * differenceStep);
      expect(flux[axis]).toBeCloseTo(derivative, 6);
    }
  });

  it('exposes the exact variational and thermal phase-force decomposition', () => {
    const state = createInitialCandidate2AThermalState(planarConfiguration);
    const decomposition = candidate2APhaseForceDecomposition(state);
    let nonzeroVariationalCount = 0;
    let nonzeroThermalCount = 0;
    for (let index = 0; index < state.config.voxelCount; index += 1) {
      const variational = decomposition.variationalDriving[index] ?? Number.NaN;
      const thermal = decomposition.thermalDriving[index] ?? Number.NaN;
      expect(decomposition.totalDrivingForce[index]).toBeCloseTo(
        variational + thermal,
        14,
      );
      expect(decomposition.relaxationTime[index]).toBeGreaterThan(0);
      if (variational !== 0) nonzeroVariationalCount += 1;
      if (thermal !== 0) nonzeroThermalCount += 1;
    }
    expect(nonzeroVariationalCount).toBeGreaterThan(0);
    expect(nonzeroThermalCount).toBeGreaterThan(0);
  });

  it('reconstructs the production next step bitwise from the decomposition', () => {
    const state = createInitialCandidate2AThermalState(planarConfiguration);
    const decomposition = candidate2APhaseForceDecomposition(state);
    const expectedOrderParameter = new Float32Array(state.config.voxelCount);
    for (let index = 0; index < state.config.voxelCount; index += 1) {
      expectedOrderParameter[index] = Math.fround(
        (state.orderParameter[index] ?? Number.NaN) +
          (state.config.timeStep *
            (decomposition.totalDrivingForce[index] ?? Number.NaN)) /
            (decomposition.relaxationTime[index] ?? Number.NaN),
      );
    }
    const expectedTemperature = advanceCandidate2ATemperature(
      state,
      expectedOrderParameter,
    );
    const actual = stepCandidate2AThermalState(state);
    expect(actual.orderParameter).toEqual(expectedOrderParameter);
    expect(actual.temperature).toEqual(expectedTemperature);
  });

  it('keeps the discrete divergence exactly adjoint at anisotropic boundaries', () => {
    const configuration: Candidate2AThermalConfiguration = {
      ...planarConfiguration,
      shape: [9, 9, 1],
      timeStep: 0.001,
      orientation: { x: 0, y: 0, z: Math.PI / 7 },
      initialCondition: {
        kind: 'planar-front',
        normal: [Math.SQRT1_2, Math.SQRT1_2, 0],
        offset: 2 * Math.SQRT2,
      },
    };
    const base = createInitialCandidate2AThermalState(configuration);
    const field = new Float32Array(base.config.voxelCount);
    const direction = new Float32Array(base.config.voxelCount);
    for (let y = 0; y < base.config.shape[1]; y += 1) {
      for (let x = 0; x < base.config.shape[0]; x += 1) {
        const index = x + base.config.shape[0] * y;
        field[index] = Math.fround(
          0.35 * Math.sin(0.7 * x) +
            0.2 * Math.cos(0.4 * y) +
            0.1 * Math.sin(0.3 * x * y),
        );
        direction[index] = Math.fround(Math.sin(0.37 * x + 0.51 * y));
      }
    }
    const state: Candidate2AThermalState = {
      ...base,
      orderParameter: field,
      temperature: new Float32Array(base.config.voxelCount),
    };
    const force = candidate2APhaseDrivingForce(state, 0);
    const perturbation = 1e-3;
    const plus = new Float32Array(field.length);
    const minus = new Float32Array(field.length);
    let forceContraction = 0;
    for (let index = 0; index < field.length; index += 1) {
      plus[index] = Math.fround(
        (field[index] ?? Number.NaN) +
          perturbation * (direction[index] ?? Number.NaN),
      );
      minus[index] = Math.fround(
        (field[index] ?? Number.NaN) -
          perturbation * (direction[index] ?? Number.NaN),
      );
      forceContraction +=
        (force[index] ?? Number.NaN) * (direction[index] ?? Number.NaN);
    }
    const plusEnergy = candidate2APhaseEnergy({
      ...state,
      orderParameter: plus,
    });
    const minusEnergy = candidate2APhaseEnergy({
      ...state,
      orderParameter: minus,
    });
    const numericalDerivative = (plusEnergy - minusEnergy) / (2 * perturbation);
    const cellMeasure = configuration.spacing ** 2;
    const adjointDerivative = -cellMeasure * forceContraction;
    expect(numericalDerivative).toBeCloseTo(adjointDerivative, 3);
  });

  it('certifies the fixed phase-stiffness envelope over the unit sphere', () => {
    const facetNormals = bismuthSlowFacetNormals();
    const directions: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      ...facetNormals,
    ];
    const sampleCount = 4096;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < sampleCount; index += 1) {
      const z = 1 - (2 * (index + 0.5)) / sampleCount;
      const radius = Math.sqrt(1 - z * z);
      const azimuth = index * goldenAngle;
      directions.push([
        radius * Math.cos(azimuth),
        radius * Math.sin(azimuth),
        z,
      ]);
    }

    const differenceStep = 1e-5;
    let minimumEigenvalue = Number.POSITIVE_INFINITY;
    let maximumEigenvalue = Number.NEGATIVE_INFINITY;
    for (const direction of directions) {
      const jacobian = Array.from({ length: 3 }, () => [0, 0, 0]);
      for (let inputAxis = 0; inputAxis < 3; inputAxis += 1) {
        const plus = [...direction] as [number, number, number];
        const minus = [...direction] as [number, number, number];
        plus[inputAxis] = (plus[inputAxis] ?? Number.NaN) + differenceStep;
        minus[inputAxis] = (minus[inputAxis] ?? Number.NaN) - differenceStep;
        const plusFlux = candidate2APhaseFlux(plus, 1, facetNormals);
        const minusFlux = candidate2APhaseFlux(minus, 1, facetNormals);
        for (let outputAxis = 0; outputAxis < 3; outputAxis += 1) {
          jacobian[outputAxis]![inputAxis] =
            ((plusFlux[outputAxis] ?? Number.NaN) -
              (minusFlux[outputAxis] ?? Number.NaN)) /
            (2 * differenceStep);
        }
      }
      const symmetric = jacobian.map((row, rowIndex) =>
        row.map(
          (value, columnIndex) =>
            0.5 * (value + (jacobian[columnIndex]?.[rowIndex] ?? Number.NaN)),
        ),
      );
      const eigenvalues = symmetricEigenvalues(symmetric);
      minimumEigenvalue = Math.min(minimumEigenvalue, ...eigenvalues);
      maximumEigenvalue = Math.max(maximumEigenvalue, ...eigenvalues);
    }

    expect(minimumEigenvalue).toBeGreaterThan(0);
    expect(maximumEigenvalue).toBeGreaterThan(1.27);
    expect(maximumEigenvalue).toBeLessThanOrEqual(
      CANDIDATE2A_PHASE_STIFFNESS_BOUND,
    );
  });

  it('derives critical Wulff scale and pre-relaxes a volume-preserving surface seed', () => {
    const configuration: Candidate2AThermalConfiguration = {
      ...planarConfiguration,
      shape: [21, 11, 21],
      timeStep: 0.001,
      initialCondition: {
        kind: 'surface-attached-seed',
        center: [5, 0, 5],
        radius: 2,
      },
      freeSurface: { ...planarConfiguration.freeSurface, enabled: true },
    };
    const initial = createInitialCandidate2AThermalState(configuration);
    expect(initial.config.criticalWulffScale).toBeCloseTo(
      (2 * KARMA_RAPPEL_IVF_CONSTANTS.a1 * configuration.interfaceWidth) /
        (configuration.couplingLambda * configuration.undercooling),
      14,
    );

    const initialVolume = candidate2ADiffuseSolidVolume(initial);
    const initialEnergy = candidate2APhaseEnergy(initial);
    const relaxation = preRelaxCandidate2ASurfaceSeed(initial, {
      maximumIterations: 40,
      rateTolerance: 1e-8,
    });

    expect(relaxation.finalEnergy).toBeLessThan(initialEnergy);
    expect(Number.isFinite(relaxation.finalEnergy)).toBe(true);
    expect(candidate2ADiffuseSolidVolume(relaxation.state)).toBeCloseTo(
      initialVolume,
      3,
    );
    expect(relaxation.relativeVolumeDrift).toBeLessThan(1e-4);
  });

  it('rejects unresolved surface seeds and ignores a disabled Robin boundary', () => {
    expect(() =>
      createInitialCandidate2AThermalState({
        ...planarConfiguration,
        shape: [21, 11, 21],
        spacing: 0.5,
        interfaceWidth: 0.5,
        timeStep: 1e-5,
        initialCondition: {
          kind: 'surface-attached-seed',
          center: [5, 0, 5],
          radius: 2,
        },
        freeSurface: { ...planarConfiguration.freeSurface, enabled: true },
      }),
    ).toThrow(/two grid cells per interface width/);

    const baseline = deriveCandidate2AThermalConfiguration({
      ...planarConfiguration,
      timeStep: 1e-6,
      freeSurface: {
        enabled: false,
        biotNumber: 0,
        ambientTemperature: -1.5,
      },
    });
    const dormantRobin = deriveCandidate2AThermalConfiguration({
      ...planarConfiguration,
      timeStep: 1e-6,
      freeSurface: {
        enabled: false,
        biotNumber: 1e9,
        ambientTemperature: -1e9,
      },
    });
    expect(dormantRobin.maximumStableTimeStep).toBe(
      baseline.maximumStableTimeStep,
    );
  });

  it('makes rotated planar-front motion covariant under grid and time refinement', () => {
    const alignedCoarse = runPlanarRefinementCase(0.5, 0, 0.25);
    const rotatedCoarse = runPlanarRefinementCase(0.5, Math.PI / 4, 0.25);
    const alignedFine = runPlanarRefinementCase(0.25, 0, 0.25);
    const rotatedFine = runPlanarRefinementCase(0.25, Math.PI / 4, 0.25);
    const alignedHalfTime = runPlanarRefinementCase(0.25, 0, 0.125);
    const rotatedHalfTime = runPlanarRefinementCase(0.25, Math.PI / 4, 0.125);
    const covarianceGap = (
      left: PlanarRefinementResult,
      right: PlanarRefinementResult,
    ) => Math.abs(left.advance - right.advance);

    for (const result of [
      alignedCoarse,
      rotatedCoarse,
      alignedFine,
      rotatedFine,
      alignedHalfTime,
      rotatedHalfTime,
    ]) {
      expect(result.advance).toBeGreaterThan(0);
      expect(Number.isFinite(result.advance)).toBe(true);
    }
    expect(Math.abs(alignedFine.advance - alignedCoarse.advance)).toBeLessThan(
      0.02 * Math.abs(alignedFine.advance),
    );
    expect(Math.abs(rotatedFine.advance - rotatedCoarse.advance)).toBeLessThan(
      0.02 * Math.abs(rotatedFine.advance),
    );
    expect(covarianceGap(alignedFine, rotatedFine)).toBeLessThan(
      covarianceGap(alignedCoarse, rotatedCoarse),
    );
    expect(covarianceGap(alignedHalfTime, rotatedHalfTime)).toBeLessThan(
      covarianceGap(alignedCoarse, rotatedCoarse),
    );
    expect(
      Math.abs(alignedFine.advance - alignedHalfTime.advance),
    ).toBeLessThan(0.01 * Math.abs(alignedHalfTime.advance));
    expect(
      Math.abs(rotatedFine.advance - rotatedHalfTime.advance),
    ).toBeLessThan(0.01 * Math.abs(rotatedHalfTime.advance));
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

  it('closes enthalpy against a phase-dependent free-surface heat flux', () => {
    const initial = createInitialCandidate2AThermalState({
      ...planarConfiguration,
      freeSurface: {
        enabled: true,
        biotNumber: CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.liquidBiotNumber,
        solidBiotNumber:
          CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.solidBiotNumber,
        ambientTemperature: -1.5,
      },
    });
    expect(
      candidate2AFreeSurfaceBiotNumber(-1, initial.config.freeSurface),
    ).toBe(CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.liquidBiotNumber);
    expect(
      candidate2AFreeSurfaceBiotNumber(1, initial.config.freeSurface),
    ).toBe(CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.solidBiotNumber);
    const expectedChange =
      initial.config.timeStep * candidate2AFreeSurfaceHeatRate(initial);
    const final = stepCandidate2AThermalState(initial);
    expect(
      totalDimensionlessEnthalpy(final) - totalDimensionlessEnthalpy(initial),
    ).toBeCloseTo(expectedChange, 4);
  });

  it('keeps the normalized surface heat-flux sign and equal-phase null explicit', () => {
    const equalBoundary = {
      enabled: true,
      biotNumber: 0.5,
      solidBiotNumber: 0.5,
      ambientTemperature: -1.5,
    };
    expect(candidate2AFreeSurfaceHeatFlux(-1, -1, equalBoundary)).toBe(0.25);
    expect(candidate2AFreeSurfaceHeatFlux(1, -1, equalBoundary)).toBe(0.25);
    expect(candidate2AFreeSurfaceHeatFlux(0, -2, equalBoundary)).toBe(-0.25);
    expect(candidate2AFreeSurfaceHeatFlux(0, -1.5, equalBoundary)).toBe(0);
  });

  it('isolates and refines the solid-liquid free-surface flux jump', () => {
    const { liquidBiotNumber, solidBiotNumber } =
      CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION;
    const equal = frozenSurfaceTemperatureContrast(0.5, 1, 1);
    const forwardCoarse = frozenSurfaceTemperatureContrast(
      0.5,
      liquidBiotNumber,
      solidBiotNumber,
    );
    const forwardFine = frozenSurfaceTemperatureContrast(
      0.25,
      liquidBiotNumber,
      solidBiotNumber,
    );
    const reversed = frozenSurfaceTemperatureContrast(
      0.5,
      solidBiotNumber,
      liquidBiotNumber,
    );

    expect(Math.abs(equal)).toBeLessThan(1e-7);
    expect(forwardCoarse).toBeLessThan(0);
    expect(reversed).toBeGreaterThan(0);
    expect(
      Math.abs(forwardCoarse - forwardFine) / Math.abs(forwardFine),
    ).toBeLessThanOrEqual(
      CANDIDATE2A_FREE_SURFACE_FLUX_ISOLATION.maximumRefinementDifference,
    );
  });

  it('preserves the legacy Robin result when solid and liquid coefficients match', () => {
    const legacy = createInitialCandidate2AThermalState({
      ...planarConfiguration,
      freeSurface: { ...planarConfiguration.freeSurface, enabled: true },
    });
    const explicitEqual = createInitialCandidate2AThermalState({
      ...planarConfiguration,
      freeSurface: {
        ...planarConfiguration.freeSurface,
        enabled: true,
        solidBiotNumber: planarConfiguration.freeSurface.biotNumber,
      },
    });
    const legacyNext = stepCandidate2AThermalState(legacy);
    const explicitNext = stepCandidate2AThermalState(explicitEqual);
    expect(explicitNext.orderParameter).toEqual(legacyNext.orderParameter);
    expect(explicitNext.temperature).toEqual(legacyNext.temperature);
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
