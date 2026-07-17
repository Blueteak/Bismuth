import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_2E_GEOMETRY_TEST_1,
  CANDIDATE_2E_GEOMETRY_TEST_2,
  CANDIDATE_2E_GEOMETRY_TEST_3,
  CANDIDATE_2E_GEOMETRY_TEST_4,
  CANDIDATE_2E_GEOMETRY_TEST_5,
  CANDIDATE_2E_GEOMETRY_TEST_6,
  CANDIDATE_2E_GEOMETRY_TEST_7,
  CANDIDATE_2E_GEOMETRY_TEST_8,
  CANDIDATE_2E_GEOMETRY_TEST_9,
  CANDIDATE_2E_GEOMETRY_TEST_10,
  CANDIDATE_2E_GEOMETRY_TEST_11,
  CANDIDATE_2E_GEOMETRY_TEST_12,
  CANDIDATE_2E_FACET_FRONT_TEST_1,
  CANDIDATE_2E_FACET_HANDOFF_TEST_2,
  CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1,
  CANDIDATE_2E_SURFACE_ADSORPTION_TEST_1,
  advanceCandidate2eCellularState,
  candidate2eOpeningDirection,
  createCandidate2eCellularState,
  isCandidate2eSurfaceAttachmentStable,
  summarizeCandidate2eCellularState,
  type Candidate2eCellularConfiguration,
} from './candidate2e-cellular';

const TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_1,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const DIRECTIONAL_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_2,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const SUPPORT_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_3,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const HISTORY_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_4,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const BOUNDED_PATCH_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_5,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const DIRECTIONAL_BODY_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_6,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const FACET_BODY_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_7,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const GRADIENT_BODY_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_8,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const EXPOSURE_BODY_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_9,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const TRANSPORT_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_10,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const PROPAGATED_FACET_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_11,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const SINGULAR_FACET_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_GEOMETRY_TEST_12,
  shape: [15, 15, 15],
  seedHalfExtent: 1,
  boundaryPadding: 1,
  checkpointSteps: [2, 4, 6],
};

const SURFACE_ADSORPTION_TEST_CONFIGURATION: Candidate2eCellularConfiguration =
  {
    ...CANDIDATE_2E_SURFACE_ADSORPTION_TEST_1,
    shape: [15, 15, 15],
    seedHalfExtent: 1,
    boundaryPadding: 1,
    checkpointSteps: [6, 18, 36],
  };

const FACET_FRONT_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_FACET_FRONT_TEST_1,
  shape: [21, 21, 21],
  seedHalfExtent: 2,
  boundaryPadding: 1,
  checkpointSteps: [12, 36, 72],
};

const FACET_HANDOFF_TEST_CONFIGURATION: Candidate2eCellularConfiguration = {
  ...CANDIDATE_2E_FACET_HANDOFF_TEST_2,
  shape: [41, 41, 41],
  seedHalfExtent: 2,
  boundaryPadding: 2,
  checkpointSteps: [12, 36, 72],
};

const SPARSE_EDGE_SOURCE_TEST_CONFIGURATION: Candidate2eCellularConfiguration =
  {
    ...CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1,
    shape: [41, 41, 41],
    seedHalfExtent: 2,
    boundaryPadding: 2,
    checkpointSteps: [24, 60, 96],
  };

function run(
  configuration: Candidate2eCellularConfiguration,
  order: 'forward' | 'reverse' = 'forward',
) {
  let state = createCandidate2eCellularState(configuration);
  for (let step = 0; step < configuration.checkpointSteps[2]; step += 1) {
    state = advanceCandidate2eCellularState(state, order);
  }
  return state;
}

describe('Candidate 2E synchronous cellular reference', () => {
  it('is independent of scan order', () => {
    const forward = run(SURFACE_ADSORPTION_TEST_CONFIGURATION, 'forward');
    const reverse = run(SURFACE_ADSORPTION_TEST_CONFIGURATION, 'reverse');

    expect(forward.phase).toEqual(reverse.phase);
    expect(forward.supply).toEqual(reverse.supply);
    expect(forward.interfaceMass).toEqual(reverse.interfaceMass);
    expect(forward.attachment).toEqual(reverse.attachment);
    expect(forward.solidificationTime).toEqual(reverse.solidificationTime);
    expect(forward.openingInfluence).toEqual(reverse.openingInfluence);
    expect(forward.facetFamily).toEqual(reverse.facetFamily);
    expect(forward.surfaceExpiredMass).toEqual(reverse.surfaceExpiredMass);
  });

  it('distinguishes terraces, supported ledges, and isolated tips', () => {
    expect(
      isCandidate2eSurfaceAttachmentStable(
        1,
        9,
        SURFACE_ADSORPTION_TEST_CONFIGURATION,
      ),
    ).toBe(false);
    expect(
      isCandidate2eSurfaceAttachmentStable(
        1,
        6,
        SURFACE_ADSORPTION_TEST_CONFIGURATION,
      ),
    ).toBe(true);
    expect(
      isCandidate2eSurfaceAttachmentStable(
        1,
        1,
        SURFACE_ADSORPTION_TEST_CONFIGURATION,
      ),
    ).toBe(false);
    expect(
      isCandidate2eSurfaceAttachmentStable(
        2,
        12,
        SURFACE_ADSORPTION_TEST_CONFIGURATION,
      ),
    ).toBe(true);
  });

  it('returns expired terrace mass while supported fronts capture', () => {
    let state = createCandidate2eCellularState(
      SURFACE_ADSORPTION_TEST_CONFIGURATION,
    );
    const initialSolidCount =
      summarizeCandidate2eCellularState(state).solidCellCount;
    const center = 7;
    const broadFace = center + 15 * (center + 2 + 15 * center);
    for (let step = 0; step < 3; step += 1) {
      state = advanceCandidate2eCellularState(state);
      const summary = summarizeCandidate2eCellularState(state);
      expect(summary.ledgerError).toBe(0);
      expect(summary.minimumSupply).toBeGreaterThanOrEqual(0);
      expect(summary.faceConnected).toBe(true);
    }
    expect(state.phase[broadFace]).toBe(0);
    expect(state.interfaceMass[broadFace]).toBeLessThanOrEqual(
      SURFACE_ADSORPTION_TEST_CONFIGURATION.surfacePacketMass,
    );
    for (let step = 3; step < 36; step += 1) {
      state = advanceCandidate2eCellularState(state);
      expect(summarizeCandidate2eCellularState(state).ledgerError).toBe(0);
    }
    expect(state.surfaceExpiredMass).toBeGreaterThan(0);
    expect(
      summarizeCandidate2eCellularState(state).solidCellCount,
    ).toBeGreaterThan(initialSolidCount);
  });

  it('honestly stalls when the surface carrier is disabled', () => {
    const initial = createCandidate2eCellularState(
      SURFACE_ADSORPTION_TEST_CONFIGURATION,
    );
    const disabled = run({
      ...SURFACE_ADSORPTION_TEST_CONFIGURATION,
      growthCarrier: 'disabled',
    });

    expect(disabled.phase).toEqual(initial.phase);
    expect(disabled.supply).toEqual(initial.supply);
    expect(disabled.interfaceMass).toEqual(initial.interfaceMass);
    expect(disabled.attachment).toEqual(initial.attachment);
    expect(disabled.surfaceExpiredMass).toBe(0);
  });

  it('expires terraces while one seed-derived facet front sweeps one layer', () => {
    const initial = createCandidate2eCellularState(
      FACET_FRONT_TEST_CONFIGURATION,
    );
    const forward = run(FACET_FRONT_TEST_CONFIGURATION);
    const reverse = run(FACET_FRONT_TEST_CONFIGURATION, 'reverse');
    const summary = summarizeCandidate2eCellularState(forward);

    expect(initial.frontSource.filter((source) => source > 0)).toHaveLength(1);
    expect(summary.surfaceExpiredMass).toBeGreaterThan(0);
    expect(summary.frontSolidCellCount).toBe(25);
    expect(summary.frontLayerCount).toBe(1);
    expect(summary.largestFrontLayerCellCount).toBe(
      summary.frontSolidCellCount,
    );
    expect(summary.ledgerError).toBe(0);
    expect(summary.faceConnected).toBe(true);
    expect(forward.phase).toEqual(reverse.phase);
    expect(forward.supply).toEqual(reverse.supply);
    expect(forward.interfaceMass).toEqual(reverse.interfaceMass);
    expect(forward.facetFamily).toEqual(reverse.facetFamily);
    expect(forward.facetLayer).toEqual(reverse.facetLayer);
    expect(forward.surfaceClass).toEqual(reverse.surfaceClass);
    expect(forward.frontDirection).toEqual(reverse.frontDirection);
    expect(forward.frontAge).toEqual(reverse.frontAge);
    expect(forward.frontSource).toEqual(reverse.frontSource);
  });

  it('hands one conserved front across lateral facets while leaving the center open', () => {
    const forward = run(FACET_HANDOFF_TEST_CONFIGURATION);
    const reverse = run(FACET_HANDOFF_TEST_CONFIGURATION, 'reverse');
    const summary = summarizeCandidate2eCellularState(forward);
    const sources = new Set(forward.frontSource.filter((source) => source > 0));
    const families = new Set(
      Array.from(forward.facetFamily.entries())
        .filter(([index]) => forward.frontSource[index]! > 0)
        .map(([, family]) => family),
    );
    const center = 20;
    const centerAboveSeed = center + 41 * (center + 3 + 41 * center);

    expect(sources.size).toBe(1);
    expect(families.size).toBe(4);
    expect(summary.frontLayerCount).toBe(4);
    expect(summary.frontSolidCellCount).toBeGreaterThan(400);
    expect(summary.occupiedBounds[1][1]).toBeGreaterThan(center + 10);
    expect(forward.phase[centerAboveSeed]).toBe(0);
    expect(summary.ledgerError).toBe(0);
    expect(summary.faceConnected).toBe(true);
    expect(summary.boundaryTouched).toBe(false);
    expect(forward.phase).toEqual(reverse.phase);
    expect(forward.supply).toEqual(reverse.supply);
    expect(forward.interfaceMass).toEqual(reverse.interfaceMass);
    expect(forward.facetFamily).toEqual(reverse.facetFamily);
    expect(forward.facetLayer).toEqual(reverse.facetLayer);
    expect(forward.frontSource).toEqual(reverse.frontSource);
  });

  it('births sparse outward edge sources that build multiple open layers', () => {
    const forward = run(SPARSE_EDGE_SOURCE_TEST_CONFIGURATION);
    const reverse = run(SPARSE_EDGE_SOURCE_TEST_CONFIGURATION, 'reverse');
    const summary = summarizeCandidate2eCellularState(forward);
    const center = 20;
    const centerAboveSeed = center + 41 * (center + 3 + 41 * center);

    expect(summary.frontSourceCount).toBeGreaterThan(1);
    expect(summary.frontLayerCount).toBeGreaterThan(4);
    expect(summary.frontSolidCellCount).toBeGreaterThan(416);
    expect(summary.occupiedBounds[0][0]).toBeLessThan(center - 3);
    expect(summary.occupiedBounds[0][1]).toBeGreaterThan(center + 3);
    expect(summary.occupiedBounds[2][0]).toBeLessThan(center - 3);
    expect(summary.occupiedBounds[2][1]).toBeGreaterThan(center + 3);
    expect(forward.phase[centerAboveSeed]).toBe(0);
    expect(summary.ledgerError).toBe(0);
    expect(summary.faceConnected).toBe(true);
    expect(summary.boundaryTouched).toBe(false);
    expect(forward.phase).toEqual(reverse.phase);
    expect(forward.supply).toEqual(reverse.supply);
    expect(forward.interfaceMass).toEqual(reverse.interfaceMass);
    expect(forward.facetFamily).toEqual(reverse.facetFamily);
    expect(forward.facetLayer).toEqual(reverse.facetLayer);
    expect(forward.frontSource).toEqual(reverse.frontSource);
  });

  it('conserves shared supply through interface accumulation and capture', () => {
    let state = createCandidate2eCellularState(TRANSPORT_TEST_CONFIGURATION);
    let previousSolidCount = 0;
    for (let step = 0; step < 6; step += 1) {
      state = advanceCandidate2eCellularState(state);
      const summary = summarizeCandidate2eCellularState(state);
      expect(summary.solidCellCount).toBeGreaterThanOrEqual(previousSolidCount);
      expect(summary.ledgerError).toBeCloseTo(0, 9);
      expect(summary.minimumSupply).toBeGreaterThanOrEqual(0);
      expect(summary.interfaceMass).toBeGreaterThanOrEqual(0);
      expect(summary.faceConnected).toBe(true);
      expect(summary.boundaryTouched).toBe(false);
      previousSolidCount = summary.solidCellCount;
    }
  });

  it('preserves the exact ledger and a connected monotonic solid', () => {
    let state = createCandidate2eCellularState(TEST_CONFIGURATION);
    let previousSolidCount = 0;
    for (let step = 0; step < 6; step += 1) {
      state = advanceCandidate2eCellularState(state);
      const summary = summarizeCandidate2eCellularState(state);
      expect(summary.solidCellCount).toBeGreaterThanOrEqual(previousSolidCount);
      expect(summary.ledgerError).toBe(0);
      expect(summary.faceConnected).toBe(true);
      expect(summary.boundaryTouched).toBe(false);
      previousSolidCount = summary.solidCellCount;
    }
  });

  it('recovers geometry test 1 when directional expansion is disabled', () => {
    const testOne = run(TEST_CONFIGURATION);
    const directionalNull = run({
      ...SUPPORT_TEST_CONFIGURATION,
      directionalExpansion: false,
    });

    expect(directionalNull.phase).toEqual(testOne.phase);
    expect(directionalNull.attachment).toEqual(testOne.attachment);
    expect(run(SUPPORT_TEST_CONFIGURATION).phase).not.toEqual(testOne.phase);
  });

  it('changes closure behavior when opening-aligned support cannot cancel', () => {
    expect(run(SUPPORT_TEST_CONFIGURATION).phase).not.toEqual(
      run(DIRECTIONAL_TEST_CONFIGURATION).phase,
    );
  });

  it('propagates opening history beyond the opening-facing seed boundary', () => {
    const history = run(HISTORY_TEST_CONFIGURATION);

    expect(history.phase).not.toEqual(run(SUPPORT_TEST_CONFIGURATION).phase);
    expect(
      history.openingInfluence.filter((influence) => influence > 0).length,
    ).toBeGreaterThan(9);
  });

  it('bounds patch acquisition to inherited non-receding support', () => {
    const bounded = run(BOUNDED_PATCH_TEST_CONFIGURATION);
    const unbounded = run(HISTORY_TEST_CONFIGURATION);
    const nullState = run({
      ...BOUNDED_PATCH_TEST_CONFIGURATION,
      boundedOpeningPatch: false,
    });

    expect(bounded.phase).not.toEqual(unbounded.phase);
    expect(nullState.phase).toEqual(unbounded.phase);
    expect(nullState.openingInfluence).toEqual(unbounded.openingInfluence);
  });

  it('makes body capture directional without changing the bounded-patch null', () => {
    const directional = run(DIRECTIONAL_BODY_TEST_CONFIGURATION);
    const boundedPatch = run(BOUNDED_PATCH_TEST_CONFIGURATION);
    const nullState = run({
      ...GRADIENT_BODY_TEST_CONFIGURATION,
      directionalBodyExpansion: false,
    });

    expect(directional.phase).not.toEqual(boundedPatch.phase);
    expect(nullState.phase).toEqual(boundedPatch.phase);
    expect(nullState.openingInfluence).toEqual(boundedPatch.openingInfluence);
  });

  it('adds seed-frame body facets without changing the directional-body null', () => {
    const faceted = run(FACET_BODY_TEST_CONFIGURATION);
    const directional = run(DIRECTIONAL_BODY_TEST_CONFIGURATION);
    const nullState = run({
      ...FACET_BODY_TEST_CONFIGURATION,
      bodyFacetExpansion: false,
    });

    expect(faceted.attachment).not.toEqual(directional.attachment);
    expect(nullState.phase).toEqual(directional.phase);
    expect(nullState.attachment).toEqual(directional.attachment);
    expect(nullState.openingInfluence).toEqual(directional.openingInfluence);
  });

  it('uses a local phase-gradient body normal with an exact face-normal null', () => {
    const gradient = run(GRADIENT_BODY_TEST_CONFIGURATION);
    const faceNormal = run(FACET_BODY_TEST_CONFIGURATION);
    const nullState = run({
      ...GRADIENT_BODY_TEST_CONFIGURATION,
      bodyNormalMode: 'face-support',
    });

    expect(gradient.attachment).not.toEqual(faceNormal.attachment);
    expect(nullState.phase).toEqual(faceNormal.phase);
    expect(nullState.attachment).toEqual(faceNormal.attachment);
    expect(nullState.openingInfluence).toEqual(faceNormal.openingInfluence);
  });

  it('screens broad-face capture with an exact Test 8 null', () => {
    const screened = run(EXPOSURE_BODY_TEST_CONFIGURATION);
    const gradient = run(GRADIENT_BODY_TEST_CONFIGURATION);
    const nullState = run({
      ...EXPOSURE_BODY_TEST_CONFIGURATION,
      bodyExposureScreening: false,
    });

    expect(screened.attachment).not.toEqual(gradient.attachment);
    expect(nullState.phase).toEqual(gradient.phase);
    expect(nullState.attachment).toEqual(gradient.attachment);
    expect(nullState.openingInfluence).toEqual(gradient.openingInfluence);
  });

  it('transports finite supply with an exact Test 8 disabled null', () => {
    const transported = run(TRANSPORT_TEST_CONFIGURATION);
    const gradient = run(GRADIENT_BODY_TEST_CONFIGURATION);
    const nullState = run({
      ...TRANSPORT_TEST_CONFIGURATION,
      transportedSupply: false,
    });

    expect(transported.supply).not.toEqual(gradient.supply);
    expect(transported.interfaceMass.some((mass) => mass > 0)).toBe(true);
    expect(nullState.phase).toEqual(gradient.phase);
    expect(nullState.supply).toEqual(gradient.supply);
    expect(nullState.interfaceMass).toEqual(gradient.interfaceMass);
    expect(nullState.attachment).toEqual(gradient.attachment);
    expect(nullState.openingInfluence).toEqual(gradient.openingInfluence);
  });

  it('propagates coherent facet families with an exact Test 8 null', () => {
    const propagated = run(PROPAGATED_FACET_TEST_CONFIGURATION);
    const gradient = run(GRADIENT_BODY_TEST_CONFIGURATION);
    const nullState = run({
      ...PROPAGATED_FACET_TEST_CONFIGURATION,
      propagatedFacetState: false,
    });
    const propagatedFamilies = propagated.facetFamily.filter(
      (family) => family >= 0,
    );

    expect(propagatedFamilies.length).toBeGreaterThan(27);
    expect(new Set(propagatedFamilies).size).toBe(4);
    expect(propagated.attachment).not.toEqual(gradient.attachment);
    expect(nullState.phase).toEqual(gradient.phase);
    expect(nullState.supply).toEqual(gradient.supply);
    expect(nullState.attachment).toEqual(gradient.attachment);
    expect(nullState.openingInfluence).toEqual(gradient.openingInfluence);
    expect(nullState.facetFamily).toEqual(gradient.facetFamily);
  });

  it('uses singular facet kinetics with an exact Test 8 null', () => {
    const singular = run(SINGULAR_FACET_TEST_CONFIGURATION);
    const gradient = run(GRADIENT_BODY_TEST_CONFIGURATION);
    const nullState = run({
      ...SINGULAR_FACET_TEST_CONFIGURATION,
      singularFacetKinetics: false,
    });

    expect(singular.attachment).not.toEqual(gradient.attachment);
    expect(nullState.phase).toEqual(gradient.phase);
    expect(nullState.supply).toEqual(gradient.supply);
    expect(nullState.attachment).toEqual(gradient.attachment);
    expect(nullState.openingInfluence).toEqual(gradient.openingInfluence);
    expect(nullState.facetFamily).toEqual(gradient.facetFamily);
  });

  it('rotates the opening influence with an awkward seed frame', () => {
    const angle = (35 * Math.PI) / 180;
    const halfAngle = angle / 2;
    const quaternion = [
      0,
      0,
      Math.sin(halfAngle),
      Math.cos(halfAngle),
    ] as const;
    const awkward: Candidate2eCellularConfiguration = {
      ...SURFACE_ADSORPTION_TEST_CONFIGURATION,
      seedFrameQuaternion: quaternion,
    };
    const equivalent: Candidate2eCellularConfiguration = {
      ...awkward,
      seedFrameQuaternion: quaternion.map((value) => -value) as [
        number,
        number,
        number,
        number,
      ],
    };
    const opening = candidate2eOpeningDirection(awkward);

    expect(opening[0]).toBeCloseTo(-Math.sin(angle), 12);
    expect(opening[1]).toBeCloseTo(Math.cos(angle), 12);
    expect(opening[2]).toBeCloseTo(0, 12);
    expect(run(awkward).attachment).not.toEqual(
      run(SURFACE_ADSORPTION_TEST_CONFIGURATION).attachment,
    );
    expect(run(awkward).phase).toEqual(run(equivalent).phase);
    expect(run(awkward).attachment).toEqual(run(equivalent).attachment);
  });
});
