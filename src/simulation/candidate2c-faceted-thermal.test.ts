import { beforeAll, describe, expect, it } from 'vitest';
import {
  CANDIDATE2C_FACETED_THERMAL_GATES,
  CANDIDATE2C_FACETED_THERMAL_ISOLATION,
  CANDIDATE2C_FACETED_THERMAL_ROBIN_REFINEMENT,
  candidate2CFacetedThermalLedger,
  candidate2CFacetedThermalLinearCellTrace,
  candidate2CFacetedThermalRobinFaceTrace,
  deriveCandidate2CFacetedThermalConfiguration,
  runCandidate2CFacetedThermalDiagnostic,
  runCandidate2CFacetedThermalRobinRefinement,
  type Candidate2CFacetedThermalDiagnosticResult,
} from './candidate2c-faceted-thermal';

let diagnostic: Candidate2CFacetedThermalDiagnosticResult;

describe('Candidate 2C cut-cell thermal trace', () => {
  it('reconstructs manufactured constant and linear fields exactly', () => {
    const shape = [4, 3, 5] as const;
    const spacing = 0.5;
    const linear = (x: number, y: number, z: number) =>
      1.25 + 0.7 * x - 0.35 * y + 1.1 * z;
    const field = new Float64Array(shape[0] * shape[1] * shape[2]);
    const constant = new Float64Array(field.length);
    constant.fill(-2.75);
    for (let z = 0; z < shape[2]; z += 1) {
      for (let y = 0; y < shape[1]; y += 1) {
        for (let x = 0; x < shape[0]; x += 1) {
          field[x + shape[0] * (y + shape[1] * z)] = linear(
            (x + 0.5) * spacing,
            (y + 0.5) * spacing,
            (z + 0.5) * spacing,
          );
        }
      }
    }
    for (const sample of [
      { cell: [0, 0, 0], point: [0.1, 0, 0.4] },
      { cell: [2, 1, 3], point: [1.35, 0.9, 1.8] },
      { cell: [3, 2, 4], point: [1.95, 1.5, 2.1] },
    ] as const) {
      expect(
        candidate2CFacetedThermalLinearCellTrace(
          field,
          shape,
          spacing,
          sample.cell,
          sample.point,
        ),
      ).toBeCloseTo(
        linear(sample.point[0], sample.point[1], sample.point[2]),
        13,
      );
      expect(
        candidate2CFacetedThermalLinearCellTrace(
          constant,
          shape,
          spacing,
          sample.cell,
          sample.point,
        ),
      ).toBeCloseTo(-2.75, 14);
    }
  });
});

describe('Candidate 2C contact-line Robin refinement', () => {
  it('isolates conservative first-order convergence without changing the morphology gate', () => {
    const protocol = CANDIDATE2C_FACETED_THERMAL_ROBIN_REFINEMENT;
    expect(protocol.spacings).toEqual([0.375, 0.1875, 0.09375]);
    expect(protocol.screenMaximumContinuousDifference).toBe(0.15);
    expect(protocol.minimumSuccessiveErrorReductionRatio).toBe(1.5);
    expect(protocol.maximumRefinedPairFluxDifference).toBe(0.1);
    expect(protocol.maximumFineContinuumFluxDifference).toBe(0.1);

    const trace = candidate2CFacetedThermalRobinFaceTrace(0, 0.375, 2, -1.5);
    expect(trace.temperature).toBeCloseTo(-0.4090909090909091, 14);
    expect(trace.outwardHeatFlux).toBeCloseTo(2.1818181818181817, 14);

    const result = runCandidate2CFacetedThermalRobinRefinement();
    expect(result.classification).toBe('passes-first-order-isolation');
    expect(result.coarseToMediumFluxDifference).toBeGreaterThan(
      protocol.screenMaximumContinuousDifference,
    );
    expect(result.mediumToFineFluxDifference).toBeLessThanOrEqual(
      protocol.maximumRefinedPairFluxDifference,
    );
    expect(result.fineContinuumFluxDifference).toBeLessThanOrEqual(
      protocol.maximumFineContinuumFluxDifference,
    );
    expect(
      result.successiveErrorReductionRatios.every((ratio) => ratio >= 1.5),
    ).toBe(true);
    expect(Object.values(result.gates).every(Boolean)).toBe(true);
  });
});

describe('Candidate 2C faceted thermal-prism gate', () => {
  beforeAll(() => {
    diagnostic = runCandidate2CFacetedThermalDiagnostic();
  }, 600_000);

  it('uses the fixed closed 3D capacity and satisfies explicit stability bounds', () => {
    const configuration = deriveCandidate2CFacetedThermalConfiguration(
      CANDIDATE2C_FACETED_THERMAL_ISOLATION,
    );
    expect(configuration.shape).toEqual([80, 48, 80]);
    expect(configuration.domainSize).toEqual([30, 18, 30]);
    expect(configuration.cellVolume).toBe(0.375 ** 3);
    expect(configuration.thermalDomainDepth).toBe(18);
    expect(configuration.timeStep).toBeLessThanOrEqual(
      configuration.maximumStableTimeStep,
    );
    expect(configuration.maximumStepCourant).toBeLessThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.maximumStepCourant,
    );
    expect(configuration.edgeBandCells).toBeGreaterThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumEdgeBandCells,
    );
    expect(configuration.facetInradiusCells).toBeGreaterThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumFacetInradiusCells,
    );
    expect(configuration.promotableResolution).toBe(true);
    expect(
      configuration.surfaceGeometry.maximumCoverageRelativeError,
    ).toBeLessThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.maximumRasterGeometryRelativeError,
    );
    expect(diagnostic.gates.stableAndCourantSafe).toBe(true);
    expect(diagnostic.gates.surfaceGeometryResolved).toBe(true);
    expect(diagnostic.gates.promotableResolution).toBe(true);
  });

  it('removes the step source for equal coefficients and reverses its signed contrast', () => {
    expect(diagnostic.gates.equalSourceNull).toBe(true);
    expect(diagnostic.gates.contrastReverses).toBe(true);
    expect(diagnostic.arms.equal.finalState.emittedLayers).toBe(0);
    expect(diagnostic.arms.equal.finalState.integratedSolidVolume).toBe(0);
    expect(diagnostic.arms.equal.finalState.cumulativeLatentHeat).toBe(0);
    for (const comparison of diagnostic.comparisons) {
      expect(comparison.edgeContrast.forward).toBeGreaterThanOrEqual(
        CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast,
      );
      expect(comparison.edgeContrast.reverse).toBeLessThanOrEqual(
        -CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast,
      );
      expect(comparison.surfaceFluxJump.forward).toBeGreaterThanOrEqual(
        CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast,
      );
      expect(comparison.surfaceFluxJump.reverse).toBeLessThanOrEqual(
        -CANDIDATE2C_FACETED_THERMAL_GATES.minimumReversedContrast,
      );
    }
  });

  it('closes external, latent, raster, and exact geometry ledgers', () => {
    expect(diagnostic.gates.energyLedgersClose).toBe(true);
    expect(diagnostic.gates.rasterAndGeometryLedgersClose).toBe(true);
    for (const result of [
      ...Object.values(diagnostic.arms),
      diagnostic.timeRefinedForward,
      diagnostic.spaceRefinedForward,
    ]) {
      const ledger = candidate2CFacetedThermalLedger(result.finalState);
      expect(Math.abs(ledger.normalizedResidual)).toBeLessThanOrEqual(
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumEnergyRelativeError,
      );
      expect(ledger.rasterGeometryRelativeError).toBeLessThanOrEqual(
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumRasterGeometryRelativeError,
      );
      expect(Math.abs(ledger.latentResidual)).toBeLessThanOrEqual(
        CANDIDATE2C_FACETED_THERMAL_GATES.maximumRasterGeometryRelativeError,
      );
    }
  });

  it('grows resolved, strictly nested six-facet loops without hiding a crossing', () => {
    const state = diagnostic.arms.forward.finalState;
    const final = diagnostic.arms.forward.checkpoints.at(-1)!;
    expect(diagnostic.gates.nestedTopologyPasses).toBe(true);
    expect(state.loopCrossingDetected).toBe(false);
    expect(state.maximumLocalSolidHeight).toBe(
      (state.completedLayers + state.activeLoopOffsets.length) *
        state.configuration.stepHeight,
    );
    expect(state.maximumLocalSolidHeight).toBeLessThanOrEqual(
      state.configuration.thermalDomainDepth,
    );
    if (state.maximumLocalSolidHeight > state.configuration.spacing) {
      const [width, height, depth] = state.configuration.shape;
      let volumeAboveTopCell = 0;
      for (let z = 0; z < depth; z += 1) {
        for (let y = 1; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            volumeAboveTopCell +=
              state.solidVolumeByCell[x + width * (y + height * z)] ?? 0;
          }
        }
      }
      expect(volumeAboveTopCell).toBeGreaterThan(0);
    }
    expect(state.emittedLayers).toBeGreaterThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumActiveTerraces,
    );
    expect(state.birthEvents).toHaveLength(state.emittedLayers);
    expect(final.layerPhase).toBe(
      state.emittedLayers + state.nucleationAccumulator,
    );
    for (let index = 0; index < state.birthEvents.length; index += 1) {
      const event = state.birthEvents[index]!;
      expect(event.ordinal).toBe(index + 1);
      expect(event.time).toBeGreaterThanOrEqual(event.bracketStart);
      expect(event.time).toBeLessThanOrEqual(event.bracketEnd);
      if (index > 0) {
        expect(event.time).toBeGreaterThan(
          state.birthEvents[index - 1]?.time ?? Number.NaN,
        );
      }
    }
    expect(final.resolvedTerraceCount).toBeGreaterThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.minimumResolvedTerraces,
    );
    for (let index = 1; index < state.activeLoopOffsets.length; index += 1) {
      expect(state.activeLoopOffsets[index - 1]).toBeGreaterThan(
        state.activeLoopOffsets[index] ?? Number.NaN,
      );
    }
  });

  it('preserves the coupled outcome under independent time and space refinement', () => {
    expect(diagnostic.timeRefinement.topologyMatches).toBe(true);
    expect(diagnostic.timeRefinement.maximumDifference).toBeLessThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.maximumTimeRefinementDifference,
    );
    expect(
      diagnostic.timeRefinement.maximumLayerPhaseDifference,
    ).toBeLessThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.maximumLayerPhaseDifference,
    );
    expect(diagnostic.spaceRefinement.topologyMatches).toBe(true);
    expect(diagnostic.spaceRefinement.maximumDifference).toBeLessThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.maximumSpaceRefinementDifference,
    );
    expect(
      diagnostic.spaceRefinement.maximumLayerPhaseDifference,
    ).toBeLessThanOrEqual(
      CANDIDATE2C_FACETED_THERMAL_GATES.maximumLayerPhaseDifference,
    );
    expect(diagnostic.gates.timeRefinementPasses).toBe(true);
    expect(diagnostic.gates.spaceRefinementPasses).toBe(true);
    expect(diagnostic.classification).toBe('passes-reduced-coupling');
  });
});
