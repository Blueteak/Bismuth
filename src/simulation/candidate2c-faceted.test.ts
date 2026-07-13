import { describe, expect, it } from 'vitest';
import {
  CANDIDATE2C_FACETED_GATES,
  CANDIDATE2C_FACETED_ISOLATION,
  candidate2CFacetedGeometryVolume,
  candidate2CFacetedLevel,
  candidate2CFacetedLoopPolygon,
  createCandidate2CFacetedFrame,
  createCandidate2CFacetedState,
  runCandidate2CFacetedSteps,
} from './candidate2c-faceted';
import { candidate2CNucleationVelocity } from './candidate2c';

const isolation = CANDIDATE2C_FACETED_ISOLATION;
const gates = CANDIDATE2C_FACETED_GATES;

function runToEvaluation(timeStep: number) {
  const configuration = { ...isolation, timeStep };
  return runCandidate2CFacetedSteps(
    createCandidate2CFacetedState(configuration),
    Math.round(gates.evaluationTime / timeStep),
    1,
  );
}

describe('Candidate 2C symmetric faceted-loop isolation', () => {
  it('projects the reciprocal facet family into six covariant support directions', () => {
    for (const orientation of [
      isolation.orientation,
      { x: 0.31, y: -0.27, z: 0.43 },
    ]) {
      const frame = createCandidate2CFacetedFrame({
        ...isolation,
        orientation,
      });
      expect(frame.normals2D).toHaveLength(6);
      expect(frame.normals3D).toHaveLength(6);
      const angles = frame.normals2D.map((normal) =>
        Math.atan2(normal[1], normal[0]),
      );
      for (let index = 0; index < 6; index += 1) {
        const normal2D = frame.normals2D[index] ?? [Number.NaN, Number.NaN];
        const normal3D = frame.normals3D[index] ?? [
          Number.NaN,
          Number.NaN,
          Number.NaN,
        ];
        const opposite = frame.normals2D[(index + 3) % 6] ?? [
          Number.NaN,
          Number.NaN,
        ];
        const nextAngle =
          index + 1 < 6
            ? (angles[index + 1] ?? Number.NaN)
            : (angles[0] ?? Number.NaN) + 2 * Math.PI;
        expect(Math.hypot(...normal2D)).toBeCloseTo(1, 12);
        expect(
          normal3D[0] * frame.planeNormal[0] +
            normal3D[1] * frame.planeNormal[1] +
            normal3D[2] * frame.planeNormal[2],
        ).toBeCloseTo(0, 12);
        expect(normal2D[0] + opposite[0]).toBeCloseTo(0, 12);
        expect(normal2D[1] + opposite[1]).toBeCloseTo(0, 12);
        expect(nextAngle - (angles[index] ?? Number.NaN)).toBeCloseTo(
          Math.PI / 3,
          12,
        );
      }
      const expectedArea = 2 * Math.sqrt(3) * isolation.facetInradius ** 2;
      expect(frame.outerPolygon.area).toBeCloseTo(expectedArea, 11);
      expect(frame.outerPolygon.supportArea).toBeCloseTo(expectedArea, 11);
    }
  });

  it('uses one crystalline level set for exact nested polygon areas', () => {
    const frame = createCandidate2CFacetedFrame(isolation);
    const inwardOffset = 1.25;
    const polygon = candidate2CFacetedLoopPolygon(frame, inwardOffset);
    const remainingInradius = isolation.facetInradius - inwardOffset;
    expect(polygon.area).toBeCloseTo(
      2 * Math.sqrt(3) * remainingInradius ** 2,
      11,
    );
    expect(polygon.supportArea).toBeCloseTo(polygon.area, 11);
    expect(candidate2CFacetedLevel(frame, inwardOffset, [0, 0])).toBeCloseTo(
      -remainingInradius,
      12,
    );
    expect(polygon.area).toBeLessThan(frame.outerPolygon.area);
  });

  it('funds every birth with a finite mesh-independent swept volume', () => {
    const configuration = {
      ...isolation,
      nucleationPrefactor: isolation.stepHeight,
      nucleationBarrier: 0,
      timeStep: 1,
    };
    const state = runCandidate2CFacetedSteps(
      createCandidate2CFacetedState(configuration),
      1,
      1,
    );
    expect(state.emittedLayers).toBe(1);
    expect(state.activeLoopOffsets).toEqual([configuration.birthInwardOffset]);
    const innerArea = candidate2CFacetedLoopPolygon(
      state.frame,
      configuration.birthInwardOffset,
    ).area;
    const expectedBirthVolume =
      configuration.stepHeight * (state.frame.outerPolygon.area - innerArea);
    expect(state.integratedSolidVolume).toBeCloseTo(expectedBirthVolume, 12);
    expect(state.releasedLatentHeat).toBeCloseTo(
      expectedBirthVolume * configuration.latentHeatPerVolume,
      12,
    );
  });

  it('advances nested loops exactly and closes their geometry and latent ledgers', () => {
    const state = runToEvaluation(isolation.timeStep);
    const birthRate =
      candidate2CNucleationVelocity(
        1,
        isolation.nucleationPrefactor,
        isolation.nucleationBarrier,
      ) / isolation.stepHeight;
    const birthPeriod = 1 / birthRate;
    const expectedOffsets = [
      isolation.birthInwardOffset + gates.evaluationTime - birthPeriod,
      isolation.birthInwardOffset + gates.evaluationTime - 2 * birthPeriod,
    ];
    expect(state.activeLoopOffsets).toHaveLength(gates.minimumActiveTerraces);
    for (let index = 0; index < expectedOffsets.length; index += 1) {
      expect(state.activeLoopOffsets[index]).toBeCloseTo(
        expectedOffsets[index] ?? Number.NaN,
        11,
      );
    }
    const geometryVolume = candidate2CFacetedGeometryVolume(state);
    expect(
      Math.abs(state.integratedSolidVolume - geometryVolume) / geometryVolume,
    ).toBeLessThanOrEqual(gates.maximumGeometryRelativeError);
    expect(state.releasedLatentHeat).toBeCloseTo(
      geometryVolume * isolation.latentHeatPerVolume,
      11,
    );

    const coarse = runToEvaluation(0.1);
    const fine = runToEvaluation(0.025);
    for (let index = 0; index < state.activeLoopOffsets.length; index += 1) {
      expect(
        Math.abs(
          (coarse.activeLoopOffsets[index] ?? Number.NaN) -
            (fine.activeLoopOffsets[index] ?? Number.NaN),
        ),
      ).toBeLessThanOrEqual(gates.maximumTimeRefinementError);
    }
  });

  it('converts a collapsed loop into a complete layer without a ledger jump', () => {
    const configuration = {
      ...isolation,
      stepKineticCoefficient: isolation.facetInradius,
      nucleationPrefactor: isolation.stepHeight,
      nucleationBarrier: 0,
      timeStep: 1,
    };
    const state = runCandidate2CFacetedSteps(
      createCandidate2CFacetedState(configuration),
      2,
      1,
    );
    expect(state.emittedLayers).toBe(2);
    expect(state.completedLayers).toBe(1);
    expect(state.activeLoopOffsets).toEqual([configuration.birthInwardOffset]);
    expect(state.integratedSolidVolume).toBeCloseTo(
      candidate2CFacetedGeometryVolume(state),
      12,
    );
    expect(state.releasedLatentHeat).toBeCloseTo(
      state.integratedSolidVolume * configuration.latentHeatPerVolume,
      12,
    );
  });
});
