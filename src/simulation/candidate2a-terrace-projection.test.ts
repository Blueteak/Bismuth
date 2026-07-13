import { beforeAll, describe, expect, it } from 'vitest';
import {
  runCandidate2AThermalPulseDiagnostic,
  type Candidate2AThermalPulseOddEven,
  type Candidate2AThermalPulseResult,
} from './candidate2a-thermal-pulse';
import {
  CANDIDATE2A_TERRACE_PROJECTION_PARAMETERS,
  candidate2ATerraceCoreSupport,
  candidate2ATerraceRingSupport,
  createCandidate2ATerraceProposal,
  projectCandidate2ATerraceForces,
  type Candidate2ATerraceProjectionResult,
  type Candidate2ATerraceProposal,
} from './candidate2a-terrace-projection';

let proposal: Candidate2ATerraceProposal;
let projection: Omit<Candidate2ATerraceProjectionResult, 'proposal'>;
let pulse: Candidate2AThermalPulseResult;

function expectOddEvenIdentity(
  decomposition: Candidate2AThermalPulseOddEven,
): void {
  expect(
    decomposition.equal + decomposition.even + decomposition.odd,
  ).toBeCloseTo(decomposition.forward, 14);
  expect(
    decomposition.equal + decomposition.even - decomposition.odd,
  ).toBeCloseTo(decomposition.reverse, 14);
}

beforeAll(() => {
  pulse = runCandidate2AThermalPulseDiagnostic();
  proposal = createCandidate2ATerraceProposal(pulse.seed);
  projection = projectCandidate2ATerraceForces(proposal, {
    equal: pulse.arms.equal.finalState,
    forward: pulse.arms.forward.finalState,
    reverse: pulse.arms.reverse.finalState,
  });
}, 30_000);

describe('Candidate 2A injected outer-ring terrace projection', () => {
  it('closes the shared frozen-phase thermal pulse before force projection', () => {
    expect(pulse.preRelaxation.converged).toBe(true);
    expect(pulse.gates.masksResolved).toBe(true);
    expect(pulse.gates.frozenOrderParameter).toBe(true);
    expect(pulse.gates.heatLedgersClose).toBe(true);
    expect(pulse.gates.equalCaseNull).toBe(true);
    for (const arm of Object.values(pulse.arms)) {
      expect(arm.finalState.orderParameter).toBe(pulse.seed.orderParameter);
      expect(arm.checkpoints.map(({ step }) => step)).toEqual([20, 50, 100]);
      expect(arm.heatLedger.initialTemperatureSum).toBe(0);
      expect(Math.abs(arm.heatLedger.normalizedResidual)).toBeLessThanOrEqual(
        5e-5,
      );
    }
    for (const comparison of pulse.comparisons) {
      expectOddEvenIdentity(comparison.outwardFluxJump);
      expectOddEvenIdentity(comparison.theta);
      expectOddEvenIdentity(comparison.rimLocalization);
      expect(Math.abs(comparison.theta.equal)).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(comparison.rimLocalization.equal)).toBeLessThanOrEqual(
        1e-6,
      );
    }
  });

  it('resolves the fixed W/2W/W ring and the volume-balancing core', () => {
    const parameters = CANDIDATE2A_TERRACE_PROJECTION_PARAMETERS;
    const width = parameters.expectedInterfaceWidth;
    const radius = proposal.footprintEquivalentRadius;
    expect(proposal.terraceHeight).toBe(
      parameters.terraceHeightInInterfaceWidths * width,
    );
    expect(proposal.finiteDifferenceAmplitude).toBe(
      parameters.finiteDifferenceAmplitudeInGridCells *
        parameters.expectedSpacing,
    );
    expect(proposal.supportOuterRadius - proposal.supportInnerRadius).toBe(
      4 * width,
    );
    expect(proposal.supportRiseEndRadius - proposal.supportInnerRadius).toBe(
      width,
    );
    expect(
      proposal.supportPlateauEndRadius - proposal.supportRiseEndRadius,
    ).toBe(2 * width);
    expect(proposal.supportOuterRadius - proposal.supportPlateauEndRadius).toBe(
      width,
    );
    expect(2 * (proposal.supportInnerRadius - width)).toBeGreaterThanOrEqual(
      2 * width,
    );
    expect(
      candidate2ATerraceRingSupport(radius - 4 * width, radius, width),
    ).toBe(0);
    expect(
      candidate2ATerraceRingSupport(radius - 3 * width, radius, width),
    ).toBe(1);
    expect(candidate2ATerraceRingSupport(radius - width, radius, width)).toBe(
      1,
    );
    expect(candidate2ATerraceRingSupport(radius, radius, width)).toBe(0);
    expect(
      candidate2ATerraceCoreSupport(
        proposal.supportInnerRadius - width,
        radius,
        width,
      ),
    ).toBe(1);
    expect(
      candidate2ATerraceCoreSupport(proposal.supportInnerRadius, radius, width),
    ).toBe(0);
  });

  it('forms a finite nonzero opening mode with a neutral volume tangent', () => {
    expect(proposal.orderParameter).toBeInstanceOf(Float32Array);
    expect(proposal.amplitudeMode).toBeInstanceOf(Float64Array);
    expect(proposal.modeNormSquared).toBeGreaterThan(0);
    expect(proposal.coreSubtractionScale).toBeGreaterThan(0);
    expect(proposal.normalizedVolumeResidual).toBeLessThanOrEqual(1e-12);
    expect(proposal.amplitudeMode.every(Number.isFinite)).toBe(true);
    expect(proposal.amplitudeMode.some((value) => value > 0)).toBe(true);
    expect(proposal.amplitudeMode.some((value) => value < 0)).toBe(true);
  });

  it('uses one terrace phase and exactly recomposes every projected force', () => {
    const arms = projection.arms;
    expect(arms.equal.variational).toBeCloseTo(arms.forward.variational, 14);
    expect(arms.equal.variational).toBeCloseTo(arms.reverse.variational, 14);
    for (const arm of [arms.equal, arms.forward, arms.reverse]) {
      expect(
        [arm.variational, arm.thermal, arm.total].every(Number.isFinite),
      ).toBe(true);
      expect(arm.total).toBeCloseTo(arm.variational + arm.thermal, 13);
      expect(arm.recompositionError).toBeLessThanOrEqual(
        1e-12 * Math.max(1, Math.abs(arm.total)),
      );
    }
    expect(projection.relativeToEqual.forward.thermalDelta).toBeCloseTo(
      arms.forward.thermal - arms.equal.thermal,
      14,
    );
    expect(projection.relativeToEqual.reverse.totalDelta).toBeCloseTo(
      arms.reverse.total - arms.equal.total,
      14,
    );
    expect(projection.oddEven.thermalOdd).toBeCloseTo(
      0.5 * (arms.forward.thermal - arms.reverse.thermal),
      14,
    );
    expect(projection.oddEven.totalEven).toBeCloseTo(
      0.5 * (arms.forward.total + arms.reverse.total) - arms.equal.total,
      14,
    );
  });
});
