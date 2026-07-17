import type { GridShape } from './config';
import type { ScalarFieldSnapshot } from './scalar-field-snapshot';

export type Candidate2eScanOrder = 'forward' | 'reverse';
export type Candidate2eGrowthCarrier =
  'legacy-interface' | 'surface-adsorption' | 'facet-local-front' | 'disabled';

export const CANDIDATE_2E_SURFACE_CLASS = Object.freeze({
  NONE: 0,
  TERRACE: 1,
  LEDGE: 2,
  KINK: 3,
} as const);

export interface Candidate2eCellularConfiguration {
  readonly shape: GridShape;
  readonly seedHalfExtent: number;
  readonly seedFrameQuaternion: readonly [number, number, number, number];
  readonly openingAxisLocal: readonly [number, number, number];
  readonly directionalExpansion: boolean;
  readonly openingAlignmentMode: 'summed-normal' | 'maximum-support';
  readonly openingInheritance: number;
  readonly boundedOpeningPatch: boolean;
  readonly directionalBodyExpansion: boolean;
  readonly bodyFacetExpansion: boolean;
  readonly bodyNormalMode: 'face-support' | 'moore-gradient';
  readonly propagatedFacetState: boolean;
  readonly singularFacetKinetics: boolean;
  readonly bodyExposureScreening: boolean;
  readonly transportedSupply: boolean;
  readonly growthCarrier: Candidate2eGrowthCarrier;
  readonly facetFrontLateralFamilies: boolean;
  readonly facetFrontHandoff: boolean;
  readonly facetFrontSparseNucleation: boolean;
  readonly facetFrontNucleationPeriod: number;
  readonly facetFrontNucleationProbability: number;
  readonly boundaryPadding: number;
  readonly initialSupplyPerCell: number;
  readonly captureMass: number;
  readonly sparseNeighborMaximum: number;
  readonly rimNeighborMaximum: number;
  readonly sparseTipRate: number;
  readonly rimRate: number;
  readonly broadInterfaceRate: number;
  readonly concaveFillRate: number;
  readonly bodyRate: number;
  readonly bodyFrontRate: number;
  readonly bodyBackRate: number;
  readonly bodyConcaveMultiplier: number;
  readonly bodyFacetRate: number;
  readonly bodyFacetOpeningComponent: number;
  readonly bodyFacetAlignmentFloor: number;
  readonly bodyFacetPower: number;
  readonly bodyFaceScreeningFloor: number;
  readonly bodyExposurePower: number;
  readonly supplyRelaxationRate: number;
  readonly transportCaptureMass: number;
  readonly interfaceUptakeScale: number;
  readonly surfaceArrivalScale: number;
  readonly surfacePacketMass: number;
  readonly surfaceStableMooreMinimum: number;
  readonly surfaceStableMooreMaximum: number;
  readonly surfaceRandomSeed: number;
  readonly checkpointSteps: readonly [number, number, number];
}

export interface Candidate2eCellularState {
  readonly configuration: Candidate2eCellularConfiguration;
  readonly phase: Uint8Array;
  readonly supply: Float64Array;
  readonly interfaceMass: Float64Array;
  readonly attachment: Float32Array;
  readonly solidificationTime: Float32Array;
  readonly openingInfluence: Float32Array;
  readonly facetFamily: Int8Array;
  readonly facetLayer: Int16Array;
  readonly surfaceClass: Uint8Array;
  readonly frontDirection: Int8Array;
  readonly frontAge: Uint16Array;
  readonly frontSource: Uint32Array;
  readonly step: number;
  readonly solidMass: number;
  readonly surfaceExpiredMass: number;
  readonly initialTotalMass: number;
}

export interface Candidate2eCellularSummary {
  readonly step: number;
  readonly solidCellCount: number;
  readonly liquidSupply: number;
  readonly interfaceMass: number;
  readonly surfaceExpiredMass: number;
  readonly trappedSupply: number;
  readonly minimumSupply: number;
  readonly totalMass: number;
  readonly ledgerError: number;
  readonly boundaryTouched: boolean;
  readonly faceConnected: boolean;
  readonly frontSolidCellCount: number;
  readonly frontSourceCount: number;
  readonly frontLayerCount: number;
  readonly largestFrontLayerCellCount: number;
  readonly occupiedBounds: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
}

export interface Candidate2eGeometryCheckpoint {
  readonly state: Candidate2eCellularState;
  readonly snapshot: ScalarFieldSnapshot;
  readonly summary: Candidate2eCellularSummary;
}

export interface Candidate2eGeometryRun {
  readonly configuration: Candidate2eCellularConfiguration;
  readonly checkpoints: readonly Candidate2eGeometryCheckpoint[];
  readonly finalState: Candidate2eCellularState;
}

/**
 * Frozen before geometry test 1. Rates are photo-constrained phenomenology,
 * not measured bismuth parameters. The identity seed frame is deliberate for
 * the one-seed discriminator; rotation tests follow only if morphology merits
 * promotion.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_1: Candidate2eCellularConfiguration =
  Object.freeze({
    shape: [41, 41, 41] as const,
    seedHalfExtent: 3,
    seedFrameQuaternion: [0, 0, 0, 1] as const,
    openingAxisLocal: [0, 1, 0] as const,
    directionalExpansion: false,
    openingAlignmentMode: 'summed-normal',
    openingInheritance: 0,
    boundedOpeningPatch: false,
    directionalBodyExpansion: false,
    bodyFacetExpansion: false,
    bodyNormalMode: 'face-support',
    propagatedFacetState: false,
    singularFacetKinetics: false,
    bodyExposureScreening: false,
    transportedSupply: false,
    growthCarrier: 'legacy-interface',
    facetFrontLateralFamilies: false,
    facetFrontHandoff: false,
    facetFrontSparseNucleation: false,
    facetFrontNucleationPeriod: 12,
    facetFrontNucleationProbability: 0.25,
    boundaryPadding: 2,
    initialSupplyPerCell: 1,
    captureMass: 1,
    sparseNeighborMaximum: 2,
    rimNeighborMaximum: 6,
    sparseTipRate: 0.18,
    rimRate: 0.52,
    broadInterfaceRate: 0.11,
    concaveFillRate: 0.68,
    bodyRate: 0.28,
    bodyFrontRate: 0.28,
    bodyBackRate: 0.28,
    bodyConcaveMultiplier: 1,
    bodyFacetRate: 0.28,
    bodyFacetOpeningComponent: Math.SQRT1_2,
    bodyFacetAlignmentFloor: 0.85,
    bodyFacetPower: 8,
    bodyFaceScreeningFloor: 1,
    bodyExposurePower: 1,
    supplyRelaxationRate: 0,
    transportCaptureMass: 1,
    interfaceUptakeScale: 1,
    surfaceArrivalScale: 1,
    surfacePacketMass: 0.25,
    surfaceStableMooreMinimum: 4,
    surfaceStableMooreMaximum: 6,
    surfaceRandomSeed: 0x2e13,
    checkpointSteps: [4, 12, 24] as const,
  });

/**
 * Frozen before geometry test 2. The same neighbor rule is blended only on
 * interface motion aligned with the seed-local opening axis. Body/back motion
 * uses one bulk rate; no cell is reserved as a cavity or target mask.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_2: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_1,
    directionalExpansion: true,
  });

/**
 * Frozen after test 2 showed concave/support cancellation closing the opening.
 * Any opening-aligned supporting face now preserves opening kinetics; slower
 * bulk motion limits lateral bridging. The rule still uses local neighbors
 * only and reserves no cavity cells.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_3: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_2,
    openingAlignmentMode: 'maximum-support',
    bodyRate: 0.2,
  });

/**
 * Frozen after test 3 showed lateral body motion still bridging the aperture.
 * Opening-facing seed state propagates locally. Descendants distinguish
 * outward radial rim motion from inward bridging; no coordinate is reserved.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_4: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_3,
    openingInheritance: 0.85,
  });

/**
 * Frozen after test 4 let every upward-facing body cell acquire opening state.
 * The opening patch is now lineage-only and transfers through non-receding
 * support. Rates and seed boundary remain unchanged.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_5: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_4,
    boundedOpeningPatch: true,
  });

/**
 * Frozen after test 5 passed bounded hopper topology but left an isotropic
 * bulb. Body capture now distinguishes front, lateral, and back motion in the
 * seed frame. Opening-patch rules and inheritance are unchanged.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_6: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_5,
    directionalBodyExpansion: true,
    bodyRate: 0.22,
    bodyFrontRate: 0.1,
    bodyBackRate: 0.34,
    bodyConcaveMultiplier: 1.4,
  });

/**
 * Frozen after test 6 elongated the bounded hopper into a stacked barrel.
 * Four seed-local, 45-degree side-normal families now slow body capture. This
 * tests visible pyramidal faceting only; the normals claim no Bi facet index.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_7: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_6,
    bodyFacetExpansion: true,
    bodyFacetRate: 0.07,
    bodyFacetOpeningComponent: Math.SQRT1_2,
    bodyFacetAlignmentFloor: 0.85,
  });

/**
 * Frozen after test 7's six-face normal changed only isolated corner cells.
 * Body anisotropy now reads a weighted 3x3x3 local phase gradient. Opening
 * inheritance and all rates remain test 7 values.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_8: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_7,
    bodyNormalMode: 'moore-gradient',
  });

/**
 * Frozen Test 8 refinement diagnostic. Grid, seed, boundary padding, and
 * checkpoints scale together by 65/41; every attachment rule stays unchanged.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_8_REFINEMENT: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_8,
    shape: [65, 65, 65] as const,
    seedHalfExtent: 5,
    boundaryPadding: 3,
    checkpointSteps: [6, 19, 38] as const,
  });

/**
 * Frozen Test 9 discriminator. A liquid cell outside a broad face sees more
 * occupied Moore neighbors than one outside an exposed edge or tip, so only
 * body capture is screened by that local exposure proxy. This imports no
 * cubic target geometry, defect noise, or physical transport claim from the
 * source rule; disabling screening must recover the Test 8 refinement exactly.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_9: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_8_REFINEMENT,
    bodyExposureScreening: true,
    bodyFaceScreeningFloor: 0.2,
    bodyExposurePower: 2,
  });

/**
 * Frozen Test 10 discriminator. Test 8 morphology now gates conservative
 * closed-boundary liquid relaxation and interface mass capture. The 1/8 face
 * flux is below the explicit 3D stability limit; four initial-cell masses per
 * capture forces neighboring interface cells to compete for replenishment.
 * Disabling transport must recover the Test 8 refinement exactly.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_10: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_8_REFINEMENT,
    transportedSupply: true,
    supplyRelaxationRate: 1 / 8,
    transportCaptureMass: 4,
    interfaceUptakeScale: 4,
  });

/** Test 10 time-horizon diagnostic; no rule, grid, or seed change. */
export const CANDIDATE_2E_GEOMETRY_TEST_10_MATURITY: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_10,
    checkpointSteps: [38, 76, 152] as const,
  });

/**
 * Frozen Test 11 discriminator. Four seed-local side-facet labels initialize
 * by lateral seed sector, then each capture inherits the majority face-support
 * family; local-normal alignment and lower family ID break ties. The inherited
 * family alone selects body-facet kinetics. Transport and exposure screening
 * remain disabled; disabling propagation must recover refined Test 8 exactly.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_11: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_8_REFINEMENT,
    propagatedFacetState: true,
  });

/**
 * Frozen Test 12 discriminator. Test 8's maximum seed-local facet alignment
 * now uses alignment^8 as the slow-growth interpolation weight. The exponent
 * is the inspected source's numerical cusp order only; its cubic directions,
 * mobility scale, defects, and physical claims are not imported. Disabling
 * the kernel must recover refined Test 8 exactly.
 */
export const CANDIDATE_2E_GEOMETRY_TEST_12: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_8_REFINEMENT,
    singularFacetKinetics: true,
    bodyFacetPower: 8,
  });

/**
 * Frozen 2E.1 reset discriminator. Broad-interface accumulation is removed.
 * Deterministic quarter-mass arrivals persist only at concave support or at a
 * locally exposed seed edge/corner (4..6 occupied Moore neighbors). Terrace
 * arrivals and isolated tips expire back into local supply before the next
 * arrival. Captured cells can therefore propagate a laterally supported step;
 * disabling the carrier must leave the seed honestly stalled.
 */
export const CANDIDATE_2E_SURFACE_ADSORPTION_TEST_1: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_GEOMETRY_TEST_8_REFINEMENT,
    growthCarrier: 'surface-adsorption',
    bodyFacetExpansion: false,
    surfaceArrivalScale: 2,
    surfacePacketMass: 0.25,
    surfaceStableMooreMinimum: 4,
    surfaceStableMooreMaximum: 6,
    surfaceRandomSeed: 0x2e13,
    checkpointSteps: [12, 36, 72] as const,
  });

/**
 * Frozen 2E.1 facet-local-front discriminator. One deterministic candidate is
 * selected from the seed boundary by the local morphology frame. Arrivals on
 * terraces expire; only the source or a same-layer ledge/kink can accumulate
 * enough mass to capture. No coordinate route, recurring source, or mask.
 */
export const CANDIDATE_2E_FACET_FRONT_TEST_1: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_SURFACE_ADSORPTION_TEST_1,
    growthCarrier: 'facet-local-front',
    checkpointSteps: [12, 36, 72] as const,
  });

/**
 * Frozen 2E.1 lateral-facet handoff discriminator. Facet identity is derived
 * only in the seed-local plane perpendicular to the opening axis. The same
 * source may cross a perpendicular facet boundary at the same layer; no source
 * is created and no layer advance, route, mask, transport, or rate changes.
 */
export const CANDIDATE_2E_FACET_HANDOFF_TEST_2: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_FACET_FRONT_TEST_1,
    facetFrontLateralFamilies: true,
    facetFrontHandoff: true,
  });

/**
 * Frozen 2E.2 sparse-source discriminator. Test 2 fronts remain unchanged.
 * Every 12 steps, locally exposed outer lateral edges independently attempt a
 * deterministic source birth with probability 1/4. This is a numerical source
 * schedule, not a measured Bi recurrence law or target-authored layer clock.
 */
export const CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1: Candidate2eCellularConfiguration =
  Object.freeze({
    ...CANDIDATE_2E_FACET_HANDOFF_TEST_2,
    facetFrontSparseNucleation: true,
    facetFrontNucleationPeriod: 12,
    facetFrontNucleationProbability: 0.25,
    checkpointSteps: [24, 60, 96] as const,
  });

const FACE_OFFSETS = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
] as const;

function assertConfiguration(
  configuration: Candidate2eCellularConfiguration,
): void {
  const [width, height, depth] = configuration.shape;
  if (
    configuration.shape.length !== 3 ||
    configuration.shape.some(
      (size) => !Number.isSafeInteger(size) || size < 9 || size % 2 === 0,
    )
  ) {
    throw new RangeError('Candidate 2E grid dimensions must be odd and >= 9.');
  }
  if (
    !Number.isSafeInteger(configuration.facetFrontNucleationPeriod) ||
    configuration.facetFrontNucleationPeriod < 1 ||
    !Number.isFinite(configuration.facetFrontNucleationProbability) ||
    configuration.facetFrontNucleationProbability < 0 ||
    configuration.facetFrontNucleationProbability > 1
  ) {
    throw new RangeError(
      'Candidate 2E facet-front nucleation schedule is invalid.',
    );
  }
  if (
    !Number.isFinite(configuration.surfaceArrivalScale) ||
    configuration.surfaceArrivalScale <= 0 ||
    configuration.surfaceArrivalScale > 8 ||
    !Number.isFinite(configuration.surfacePacketMass) ||
    configuration.surfacePacketMass <= 0 ||
    configuration.surfacePacketMass > configuration.captureMass ||
    !Number.isSafeInteger(configuration.surfaceStableMooreMinimum) ||
    !Number.isSafeInteger(configuration.surfaceStableMooreMaximum) ||
    configuration.surfaceStableMooreMinimum < 1 ||
    configuration.surfaceStableMooreMaximum > 26 ||
    configuration.surfaceStableMooreMinimum >
      configuration.surfaceStableMooreMaximum ||
    !Number.isSafeInteger(configuration.surfaceRandomSeed)
  ) {
    throw new RangeError(
      'Candidate 2E surface adsorption parameters are invalid.',
    );
  }
  if (
    !Number.isFinite(configuration.openingInheritance) ||
    configuration.openingInheritance < 0 ||
    configuration.openingInheritance > 1
  ) {
    throw new RangeError('Candidate 2E opening inheritance must be in [0, 1].');
  }
  if (
    !Number.isSafeInteger(configuration.seedHalfExtent) ||
    configuration.seedHalfExtent < 0 ||
    !Number.isSafeInteger(configuration.boundaryPadding) ||
    configuration.boundaryPadding < 1 ||
    configuration.seedHalfExtent + configuration.boundaryPadding >=
      Math.min(width, height, depth) / 2
  ) {
    throw new RangeError('Candidate 2E seed or boundary padding is invalid.');
  }
  const rates = [
    configuration.sparseTipRate,
    configuration.rimRate,
    configuration.broadInterfaceRate,
    configuration.concaveFillRate,
    configuration.bodyRate,
    configuration.bodyFrontRate,
    configuration.bodyBackRate,
    configuration.bodyFacetRate,
  ];
  if (rates.some((rate) => !Number.isFinite(rate) || rate <= 0 || rate > 1)) {
    throw new RangeError('Candidate 2E attachment rates must be in (0, 1].');
  }
  if (
    !Number.isFinite(configuration.bodyConcaveMultiplier) ||
    configuration.bodyConcaveMultiplier < 1 ||
    configuration.bodyConcaveMultiplier > 4
  ) {
    throw new RangeError(
      'Candidate 2E body concave multiplier must be in [1, 4].',
    );
  }
  if (
    !Number.isFinite(configuration.bodyFacetOpeningComponent) ||
    configuration.bodyFacetOpeningComponent <= 0 ||
    configuration.bodyFacetOpeningComponent >= 1 ||
    !Number.isFinite(configuration.bodyFacetAlignmentFloor) ||
    configuration.bodyFacetAlignmentFloor < 0 ||
    configuration.bodyFacetAlignmentFloor >= 1
  ) {
    throw new RangeError(
      'Candidate 2E body facet components must be inside their unit ranges.',
    );
  }
  if (
    !Number.isSafeInteger(configuration.bodyFacetPower) ||
    configuration.bodyFacetPower < 2 ||
    configuration.bodyFacetPower > 32
  ) {
    throw new RangeError(
      'Candidate 2E singular facet power must be an integer in [2, 32].',
    );
  }
  if (
    !Number.isFinite(configuration.bodyFaceScreeningFloor) ||
    configuration.bodyFaceScreeningFloor <= 0 ||
    configuration.bodyFaceScreeningFloor > 1 ||
    !Number.isFinite(configuration.bodyExposurePower) ||
    configuration.bodyExposurePower <= 0 ||
    configuration.bodyExposurePower > 8
  ) {
    throw new RangeError(
      'Candidate 2E body exposure screening must use a floor in (0, 1] and power in (0, 8].',
    );
  }
  if (
    !Number.isFinite(configuration.supplyRelaxationRate) ||
    configuration.supplyRelaxationRate < 0 ||
    configuration.supplyRelaxationRate > 1 / 6 ||
    !Number.isFinite(configuration.transportCaptureMass) ||
    configuration.transportCaptureMass <= 0 ||
    !Number.isFinite(configuration.interfaceUptakeScale) ||
    configuration.interfaceUptakeScale <= 0
  ) {
    throw new RangeError(
      'Candidate 2E transport requires stable nonnegative relaxation and positive capture scales.',
    );
  }
  const quaternionLength = Math.hypot(...configuration.seedFrameQuaternion);
  const openingAxisLength = Math.hypot(...configuration.openingAxisLocal);
  if (
    !Number.isFinite(quaternionLength) ||
    Math.abs(quaternionLength - 1) > 1e-6 ||
    !Number.isFinite(openingAxisLength) ||
    Math.abs(openingAxisLength - 1) > 1e-6
  ) {
    throw new RangeError(
      'Candidate 2E seed quaternion and opening axis must be normalized.',
    );
  }
  if (
    !Number.isFinite(configuration.initialSupplyPerCell) ||
    !Number.isFinite(configuration.captureMass) ||
    configuration.captureMass <= 0 ||
    configuration.initialSupplyPerCell < configuration.captureMass
  ) {
    throw new RangeError('Candidate 2E supply/capture mass is invalid.');
  }
  const [early, middle, final] = configuration.checkpointSteps;
  if (
    !Number.isSafeInteger(early) ||
    !Number.isSafeInteger(middle) ||
    !Number.isSafeInteger(final) ||
    early <= 0 ||
    early >= middle ||
    middle >= final
  ) {
    throw new RangeError('Candidate 2E checkpoints must increase from > 0.');
  }
}

function indexOf(x: number, y: number, z: number, shape: GridShape): number {
  return x + shape[0] * (y + shape[1] * z);
}

function coordinatesOf(
  index: number,
  shape: GridShape,
): [number, number, number] {
  const x = index % shape[0];
  const y = Math.floor(index / shape[0]) % shape[1];
  const z = Math.floor(index / (shape[0] * shape[1]));
  return [x, y, z];
}

function isInterior(
  x: number,
  y: number,
  z: number,
  configuration: Candidate2eCellularConfiguration,
): boolean {
  const [width, height, depth] = configuration.shape;
  const padding = configuration.boundaryPadding;
  return (
    x >= padding &&
    y >= padding &&
    z >= padding &&
    x < width - padding &&
    y < height - padding &&
    z < depth - padding
  );
}

function neighborCounts(
  phase: Uint8Array,
  openingInfluence: Float32Array,
  x: number,
  y: number,
  z: number,
  configuration: Candidate2eCellularConfiguration,
): {
  readonly face: number;
  readonly moore: number;
  readonly outwardFaceVector: readonly [number, number, number];
  readonly outwardMooreVector: readonly [number, number, number];
  readonly faceSupportMask: number;
  readonly maximumSupportOpeningInfluence: number;
  readonly maximumNonRecedingOpeningInfluence: number;
} {
  const { shape } = configuration;
  let face = 0;
  let faceSupportMask = 0;
  const outwardFaceVector = [0, 0, 0];
  let maximumSupportOpeningInfluence = 0;
  let maximumNonRecedingOpeningInfluence = 0;
  const openingDirection = candidate2eOpeningDirection(configuration);
  for (
    let offsetIndex = 0;
    offsetIndex < FACE_OFFSETS.length;
    offsetIndex += 1
  ) {
    const [dx, dy, dz] = FACE_OFFSETS[offsetIndex]!;
    const solid = phase[indexOf(x + dx, y + dy, z + dz, shape)] ?? 0;
    face += solid;
    if (solid === 1) {
      faceSupportMask |= 1 << offsetIndex;
      outwardFaceVector[0] = outwardFaceVector[0]! - dx;
      outwardFaceVector[1] = outwardFaceVector[1]! - dy;
      outwardFaceVector[2] = outwardFaceVector[2]! - dz;
      maximumSupportOpeningInfluence = Math.max(
        maximumSupportOpeningInfluence,
        openingInfluence[indexOf(x + dx, y + dy, z + dz, shape)] ?? 0,
      );
      const supportInfluence =
        openingInfluence[indexOf(x + dx, y + dy, z + dz, shape)] ?? 0;
      const axialAdvance =
        -dx * openingDirection[0] -
        dy * openingDirection[1] -
        dz * openingDirection[2];
      if (axialAdvance >= -1e-6) {
        maximumNonRecedingOpeningInfluence = Math.max(
          maximumNonRecedingOpeningInfluence,
          supportInfluence,
        );
      }
    }
  }
  let moore = 0;
  const outwardMooreVector = [0, 0, 0];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const solid = phase[indexOf(x + dx, y + dy, z + dz, shape)] ?? 0;
        moore += solid;
        if (solid === 1) {
          const distance = Math.hypot(dx, dy, dz);
          outwardMooreVector[0] = outwardMooreVector[0]! - dx / distance;
          outwardMooreVector[1] = outwardMooreVector[1]! - dy / distance;
          outwardMooreVector[2] = outwardMooreVector[2]! - dz / distance;
        }
      }
    }
  }
  return {
    face,
    moore,
    outwardFaceVector: [
      outwardFaceVector[0]!,
      outwardFaceVector[1]!,
      outwardFaceVector[2]!,
    ],
    outwardMooreVector: [
      outwardMooreVector[0]!,
      outwardMooreVector[1]!,
      outwardMooreVector[2]!,
    ],
    faceSupportMask,
    maximumSupportOpeningInfluence,
    maximumNonRecedingOpeningInfluence,
  };
}

function neighborClassRate(
  mooreNeighbors: number,
  configuration: Candidate2eCellularConfiguration,
): number {
  if (mooreNeighbors <= configuration.sparseNeighborMaximum) {
    return configuration.sparseTipRate;
  }
  if (mooreNeighbors <= configuration.rimNeighborMaximum) {
    return configuration.rimRate;
  }
  return configuration.broadInterfaceRate;
}

export function isCandidate2eSurfaceAttachmentStable(
  faceNeighbors: number,
  mooreNeighbors: number,
  configuration: Candidate2eCellularConfiguration,
): boolean {
  return (
    faceNeighbors >= 2 ||
    (faceNeighbors === 1 &&
      mooreNeighbors >= configuration.surfaceStableMooreMinimum &&
      mooreNeighbors <= configuration.surfaceStableMooreMaximum)
  );
}

function deterministicSurfaceHash(
  index: number,
  step: number,
  seed: number,
): number {
  let hash =
    (Math.imul(index + 1, 0x9e3779b1) ^
      Math.imul(step + 1, 0x85ebca6b) ^
      seed) >>>
    0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function hasDeterministicSurfaceArrival(
  index: number,
  step: number,
  probability: number,
  seed: number,
): boolean {
  return (
    deterministicSurfaceHash(index, step, seed) / 0x1_0000_0000 <
    Math.max(0, Math.min(1, probability))
  );
}

export function candidate2eOpeningDirection(
  configuration: Candidate2eCellularConfiguration,
): readonly [number, number, number] {
  return rotateSeedLocalVector(
    configuration.openingAxisLocal,
    configuration.seedFrameQuaternion,
  );
}

function rotateSeedLocalVector(
  vector: readonly [number, number, number],
  quaternion: readonly [number, number, number, number],
): readonly [number, number, number] {
  const [vx, vy, vz] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

function rotateWorldToSeedLocalVector(
  vector: readonly [number, number, number],
  quaternion: readonly [number, number, number, number],
): readonly [number, number, number] {
  return rotateSeedLocalVector(vector, [
    -quaternion[0],
    -quaternion[1],
    -quaternion[2],
    quaternion[3],
  ]);
}

function facetLateralAxesLocal(
  openingLocal: readonly [number, number, number],
): readonly [
  readonly [number, number, number],
  readonly [number, number, number],
] {
  const reference: readonly [number, number, number] =
    Math.abs(openingLocal[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const referenceProjection =
    reference[0] * openingLocal[0] +
    reference[1] * openingLocal[1] +
    reference[2] * openingLocal[2];
  const tangentUnnormalized = [
    reference[0] - openingLocal[0] * referenceProjection,
    reference[1] - openingLocal[1] * referenceProjection,
    reference[2] - openingLocal[2] * referenceProjection,
  ] as const;
  const tangentLength = Math.hypot(...tangentUnnormalized);
  const tangent = tangentUnnormalized.map(
    (component) => component / tangentLength,
  ) as [number, number, number];
  return [
    tangent,
    [
      openingLocal[1] * tangent[2] - openingLocal[2] * tangent[1],
      openingLocal[2] * tangent[0] - openingLocal[0] * tangent[2],
      openingLocal[0] * tangent[1] - openingLocal[1] * tangent[0],
    ],
  ];
}

function facetFamilyDirection(
  family: number,
  configuration: Candidate2eCellularConfiguration,
): readonly [number, number, number] {
  const [tangentLocal, bitangentLocal] = facetLateralAxesLocal(
    configuration.openingAxisLocal,
  );
  const lateralLocal = family < 2 ? tangentLocal : bitangentLocal;
  const sign = family % 2 === 0 ? 1 : -1;
  const openingComponent = configuration.bodyFacetOpeningComponent;
  const lateralComponent = Math.sqrt(1 - openingComponent * openingComponent);
  return rotateSeedLocalVector(
    [
      openingComponent * configuration.openingAxisLocal[0] +
        sign * lateralComponent * lateralLocal[0],
      openingComponent * configuration.openingAxisLocal[1] +
        sign * lateralComponent * lateralLocal[1],
      openingComponent * configuration.openingAxisLocal[2] +
        sign * lateralComponent * lateralLocal[2],
    ],
    configuration.seedFrameQuaternion,
  );
}

function bodyFacetFamilyAlignment(
  outwardVector: readonly [number, number, number],
  family: number,
  configuration: Candidate2eCellularConfiguration,
): number {
  const outwardLength = Math.hypot(...outwardVector);
  if (outwardLength === 0 || family < 0 || family > 3) return 0;
  const direction = facetFamilyDirection(family, configuration);
  return (
    (outwardVector[0] * direction[0] +
      outwardVector[1] * direction[1] +
      outwardVector[2] * direction[2]) /
    outwardLength
  );
}

function seedFacetFamily(
  relativeWorld: readonly [number, number, number],
  configuration: Candidate2eCellularConfiguration,
): number {
  const relativeLocal = rotateWorldToSeedLocalVector(
    relativeWorld,
    configuration.seedFrameQuaternion,
  );
  const opening = configuration.openingAxisLocal;
  const axial =
    relativeLocal[0] * opening[0] +
    relativeLocal[1] * opening[1] +
    relativeLocal[2] * opening[2];
  const radial = [
    relativeLocal[0] - axial * opening[0],
    relativeLocal[1] - axial * opening[1],
    relativeLocal[2] - axial * opening[2],
  ] as const;
  const [tangent, bitangent] = facetLateralAxesLocal(opening);
  const tangentProjection =
    radial[0] * tangent[0] + radial[1] * tangent[1] + radial[2] * tangent[2];
  const bitangentProjection =
    radial[0] * bitangent[0] +
    radial[1] * bitangent[1] +
    radial[2] * bitangent[2];
  const scores = [
    tangentProjection,
    -tangentProjection,
    bitangentProjection,
    -bitangentProjection,
  ];
  let selected = 0;
  for (let family = 1; family < scores.length; family += 1) {
    if (scores[family]! > scores[selected]!) selected = family;
  }
  return selected;
}

const UNASSIGNED_FACET_LAYER = -32_768;

function relativeToGridCenter(
  position: readonly [number, number, number],
  shape: GridShape,
): readonly [number, number, number] {
  return [
    position[0] - (shape[0] - 1) / 2,
    position[1] - (shape[1] - 1) / 2,
    position[2] - (shape[2] - 1) / 2,
  ];
}

function frontFacetFamily(
  relativeWorld: readonly [number, number, number],
  configuration: Candidate2eCellularConfiguration,
): number {
  const relativeLocal = rotateWorldToSeedLocalVector(
    relativeWorld,
    configuration.seedFrameQuaternion,
  );
  const familyVector = configuration.facetFrontLateralFamilies
    ? (() => {
        const opening = configuration.openingAxisLocal;
        const axial =
          relativeLocal[0] * opening[0] +
          relativeLocal[1] * opening[1] +
          relativeLocal[2] * opening[2];
        return [
          relativeLocal[0] - axial * opening[0],
          relativeLocal[1] - axial * opening[1],
          relativeLocal[2] - axial * opening[2],
        ] as const;
      })()
    : relativeLocal;
  let axis = 0;
  for (let candidateAxis = 1; candidateAxis < 3; candidateAxis += 1) {
    if (
      Math.abs(familyVector[candidateAxis]!) > Math.abs(familyVector[axis]!)
    ) {
      axis = candidateAxis;
    }
  }
  return axis * 2 + (familyVector[axis]! < 0 ? 1 : 0);
}

function areFrontFacetFamiliesAdjacent(
  first: number,
  second: number,
  configuration: Candidate2eCellularConfiguration,
): boolean {
  if (first < 0 || second < 0 || first === second) return false;
  const firstNormal = frontFacetNormalWorld(first, configuration);
  const secondNormal = frontFacetNormalWorld(second, configuration);
  return (
    Math.abs(
      firstNormal[0] * secondNormal[0] +
        firstNormal[1] * secondNormal[1] +
        firstNormal[2] * secondNormal[2],
    ) < 1e-6
  );
}

function frontFacetNormalWorld(
  family: number,
  configuration: Candidate2eCellularConfiguration,
): readonly [number, number, number] {
  const axis = Math.floor(family / 2);
  const normalLocal = [0, 0, 0] as [number, number, number];
  normalLocal[axis] = family % 2 === 0 ? 1 : -1;
  return rotateSeedLocalVector(normalLocal, configuration.seedFrameQuaternion);
}

function facetLayerCoordinate(
  relativeWorld: readonly [number, number, number],
  family: number,
  configuration: Candidate2eCellularConfiguration,
): number {
  const normal = frontFacetNormalWorld(family, configuration);
  return Math.round(
    relativeWorld[0] * normal[0] +
      relativeWorld[1] * normal[1] +
      relativeWorld[2] * normal[2],
  );
}

function facetFrontDirectionWorld(
  family: number,
  configuration: Candidate2eCellularConfiguration,
): readonly [number, number, number] {
  const normal = frontFacetNormalWorld(family, configuration);
  const opening = candidate2eOpeningDirection(configuration);
  const normalProjection =
    opening[0] * normal[0] + opening[1] * normal[1] + opening[2] * normal[2];
  const tangent = [
    opening[0] - normalProjection * normal[0],
    opening[1] - normalProjection * normal[1],
    opening[2] - normalProjection * normal[2],
  ] as const;
  const length = Math.hypot(...tangent);
  if (length <= 1e-9) {
    const [fallback] = facetLateralAxesLocal(configuration.openingAxisLocal);
    return rotateSeedLocalVector(fallback, configuration.seedFrameQuaternion);
  }
  return [tangent[0] / length, tangent[1] / length, tangent[2] / length];
}

interface Candidate2eFacetFrontSite {
  readonly active: boolean;
  readonly surfaceClass: number;
  readonly family: number;
  readonly layer: number;
  readonly direction: number;
  readonly age: number;
  readonly source: number;
}

function candidate2eFacetFrontSite(
  state: Candidate2eCellularState,
  index: number,
  position: readonly [number, number, number],
  support: {
    readonly face: number;
    readonly moore: number;
    readonly outwardFaceVector: readonly [number, number, number];
  },
): Candidate2eFacetFrontSite {
  const { configuration } = state;
  const relative = relativeToGridCenter(position, configuration.shape);
  const family = frontFacetFamily(relative, configuration);
  const layer = facetLayerCoordinate(relative, family, configuration);
  const directionWorld = facetFrontDirectionWorld(family, configuration);
  let supportCount = 0;
  let source = 0;
  let maximumAge = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const neighbor = indexOf(
          position[0] + dx,
          position[1] + dy,
          position[2] + dz,
          configuration.shape,
        );
        const neighborFamily = state.facetFamily[neighbor]!;
        const sameFacet = neighborFamily === family;
        const adjacentFacet =
          configuration.facetFrontHandoff &&
          areFrontFacetFamiliesAdjacent(neighborFamily, family, configuration);
        if (
          state.phase[neighbor] !== 1 ||
          state.frontSource[neighbor] === 0 ||
          state.facetLayer[neighbor] !== layer ||
          (!sameFacet && !adjacentFacet)
        ) {
          continue;
        }
        const advance =
          -dx * directionWorld[0] -
          dy * directionWorld[1] -
          dz * directionWorld[2];
        if (advance < -0.25) continue;
        supportCount += 1;
        const neighborSource = state.frontSource[neighbor]!;
        if (source === 0 || neighborSource < source) source = neighborSource;
        maximumAge = Math.max(maximumAge, state.frontAge[neighbor]!);
      }
    }
  }
  const existingSource = state.frontSource[index]!;
  if (existingSource > 0) {
    return {
      active: true,
      surfaceClass: CANDIDATE_2E_SURFACE_CLASS.KINK,
      family: state.facetFamily[index]!,
      layer: state.facetLayer[index]!,
      direction: state.frontDirection[index]!,
      age: Math.min(65_535, state.frontAge[index]! + 1),
      source: existingSource,
    };
  }
  const normal = frontFacetNormalWorld(family, configuration);
  const supportLength = Math.hypot(...support.outwardFaceVector);
  const supportAlignment =
    supportLength > 0
      ? (normal[0] * support.outwardFaceVector[0] +
          normal[1] * support.outwardFaceVector[1] +
          normal[2] * support.outwardFaceVector[2]) /
        supportLength
      : 0;
  const sparseSourceBirth =
    configuration.facetFrontSparseNucleation &&
    supportCount === 0 &&
    state.step > 0 &&
    state.step % configuration.facetFrontNucleationPeriod === 0 &&
    support.face === 1 &&
    support.moore >= configuration.surfaceStableMooreMinimum &&
    support.moore <= configuration.surfaceStableMooreMaximum &&
    supportAlignment >= 0.5 &&
    hasDeterministicSurfaceArrival(
      index,
      state.step,
      configuration.facetFrontNucleationProbability,
      configuration.surfaceRandomSeed ^ 0x2e21,
    );
  if (sparseSourceBirth) {
    return {
      active: true,
      surfaceClass: CANDIDATE_2E_SURFACE_CLASS.KINK,
      family,
      layer,
      direction: family + 1,
      age: 1,
      source: index + 1,
    };
  }
  return {
    active: supportCount > 0,
    surfaceClass:
      supportCount === 0
        ? CANDIDATE_2E_SURFACE_CLASS.TERRACE
        : supportCount === 1
          ? CANDIDATE_2E_SURFACE_CLASS.LEDGE
          : CANDIDATE_2E_SURFACE_CLASS.KINK,
    family,
    layer,
    direction: family + 1,
    age: supportCount > 0 ? Math.min(65_535, maximumAge + 1) : 0,
    source,
  };
}

function initializeCandidate2eFacetFrontSource(
  phase: Uint8Array,
  openingInfluence: Float32Array,
  facetFamily: Int8Array,
  facetLayer: Int16Array,
  surfaceClass: Uint8Array,
  frontDirection: Int8Array,
  frontAge: Uint16Array,
  frontSource: Uint32Array,
  configuration: Candidate2eCellularConfiguration,
): void {
  const [width, height, depth] = configuration.shape;
  let selectedIndex = -1;
  let selectedFamily = -1;
  let selectedLayer = UNASSIGNED_FACET_LAYER;
  let selectedProjection = Infinity;
  let selectedHash = Infinity;
  for (let z = 1; z < depth - 1; z += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = indexOf(x, y, z, configuration.shape);
        if (phase[index] === 1 || !isInterior(x, y, z, configuration)) {
          continue;
        }
        const counts = neighborCounts(
          phase,
          openingInfluence,
          x,
          y,
          z,
          configuration,
        );
        if (
          counts.face !== 1 ||
          counts.moore < configuration.surfaceStableMooreMinimum ||
          counts.moore > configuration.surfaceStableMooreMaximum
        ) {
          continue;
        }
        const relative = relativeToGridCenter([x, y, z], configuration.shape);
        const family = frontFacetFamily(relative, configuration);
        if (configuration.facetFrontLateralFamilies) {
          const normal = frontFacetNormalWorld(family, configuration);
          const supportLength = Math.hypot(...counts.outwardFaceVector);
          const supportAlignment =
            supportLength > 0
              ? (normal[0] * counts.outwardFaceVector[0] +
                  normal[1] * counts.outwardFaceVector[1] +
                  normal[2] * counts.outwardFaceVector[2]) /
                supportLength
              : 0;
          if (supportAlignment < 0.5) continue;
        }
        const direction = facetFrontDirectionWorld(family, configuration);
        const opening = candidate2eOpeningDirection(configuration);
        const normal = frontFacetNormalWorld(family, configuration);
        const openingAlignment = Math.abs(
          opening[0] * normal[0] +
            opening[1] * normal[1] +
            opening[2] * normal[2],
        );
        if (openingAlignment > 0.5) continue;
        const projection =
          relative[0] * direction[0] +
          relative[1] * direction[1] +
          relative[2] * direction[2];
        const hash = deterministicSurfaceHash(
          index,
          0,
          configuration.surfaceRandomSeed,
        );
        if (
          projection < selectedProjection - 1e-9 ||
          (Math.abs(projection - selectedProjection) <= 1e-9 &&
            hash < selectedHash)
        ) {
          selectedIndex = index;
          selectedFamily = family;
          selectedLayer = facetLayerCoordinate(relative, family, configuration);
          selectedProjection = projection;
          selectedHash = hash;
        }
      }
    }
  }
  if (selectedIndex < 0) {
    throw new Error(
      'Candidate 2E facet-local front could not derive a seed-boundary source.',
    );
  }
  facetFamily[selectedIndex] = selectedFamily;
  facetLayer[selectedIndex] = selectedLayer;
  surfaceClass[selectedIndex] = CANDIDATE_2E_SURFACE_CLASS.KINK;
  frontDirection[selectedIndex] = selectedFamily + 1;
  frontAge[selectedIndex] = 1;
  frontSource[selectedIndex] = selectedIndex + 1;
}

function inheritedFacetFamily(
  facetFamily: Int8Array,
  faceSupportMask: number,
  position: readonly [number, number, number],
  bodyNormal: readonly [number, number, number],
  configuration: Candidate2eCellularConfiguration,
): number {
  if (!configuration.propagatedFacetState) return -1;
  const supportCounts = [0, 0, 0, 0];
  for (
    let offsetIndex = 0;
    offsetIndex < FACE_OFFSETS.length;
    offsetIndex += 1
  ) {
    if ((faceSupportMask & (1 << offsetIndex)) === 0) continue;
    const [dx, dy, dz] = FACE_OFFSETS[offsetIndex]!;
    const family =
      facetFamily[
        indexOf(
          position[0] + dx,
          position[1] + dy,
          position[2] + dz,
          configuration.shape,
        )
      ] ?? -1;
    if (family >= 0 && family < supportCounts.length) {
      supportCounts[family] = supportCounts[family]! + 1;
    }
  }
  let selected = -1;
  let selectedCount = 0;
  let selectedAlignment = -Infinity;
  for (let family = 0; family < supportCounts.length; family += 1) {
    const count = supportCounts[family]!;
    if (count === 0) continue;
    const alignment = bodyFacetFamilyAlignment(
      bodyNormal,
      family,
      configuration,
    );
    if (
      count > selectedCount ||
      (count === selectedCount && alignment > selectedAlignment)
    ) {
      selected = family;
      selectedCount = count;
      selectedAlignment = alignment;
    }
  }
  return selected;
}

function bodyFacetAlignment(
  outwardFaceVector: readonly [number, number, number],
  openingDirection: readonly [number, number, number],
  configuration: Candidate2eCellularConfiguration,
): number {
  const outwardLength = Math.hypot(...outwardFaceVector);
  if (outwardLength === 0) return 0;
  const openingLocal = configuration.openingAxisLocal;
  const reference: readonly [number, number, number] =
    Math.abs(openingLocal[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const referenceProjection =
    reference[0] * openingLocal[0] +
    reference[1] * openingLocal[1] +
    reference[2] * openingLocal[2];
  const tangentUnnormalized = [
    reference[0] - openingLocal[0] * referenceProjection,
    reference[1] - openingLocal[1] * referenceProjection,
    reference[2] - openingLocal[2] * referenceProjection,
  ] as const;
  const tangentLength = Math.hypot(...tangentUnnormalized);
  const tangentLocal = tangentUnnormalized.map(
    (component) => component / tangentLength,
  ) as [number, number, number];
  const bitangentLocal = [
    openingLocal[1] * tangentLocal[2] - openingLocal[2] * tangentLocal[1],
    openingLocal[2] * tangentLocal[0] - openingLocal[0] * tangentLocal[2],
    openingLocal[0] * tangentLocal[1] - openingLocal[1] * tangentLocal[0],
  ] as const;
  const tangent = rotateSeedLocalVector(
    tangentLocal,
    configuration.seedFrameQuaternion,
  );
  const bitangent = rotateSeedLocalVector(
    bitangentLocal,
    configuration.seedFrameQuaternion,
  );
  const openingComponent = configuration.bodyFacetOpeningComponent;
  const lateralComponent = Math.sqrt(1 - openingComponent * openingComponent);
  let maximum = 0;
  for (const lateral of [tangent, bitangent]) {
    for (const sign of [-1, 1]) {
      maximum = Math.max(
        maximum,
        (outwardFaceVector[0] *
          (openingComponent * openingDirection[0] +
            sign * lateralComponent * lateral[0]) +
          outwardFaceVector[1] *
            (openingComponent * openingDirection[1] +
              sign * lateralComponent * lateral[1]) +
          outwardFaceVector[2] *
            (openingComponent * openingDirection[2] +
              sign * lateralComponent * lateral[2])) /
          outwardLength,
      );
    }
  }
  return maximum;
}

function attachmentRule(
  faceNeighbors: number,
  mooreNeighbors: number,
  outwardFaceVector: readonly [number, number, number],
  outwardMooreVector: readonly [number, number, number],
  faceSupportMask: number,
  maximumSupportOpeningInfluence: number,
  maximumNonRecedingOpeningInfluence: number,
  inheritedFamily: number,
  position: readonly [number, number, number],
  configuration: Candidate2eCellularConfiguration,
): {
  readonly rate: number;
  readonly openingInfluence: number;
  readonly facetFamily: number;
} {
  if (!configuration.directionalExpansion) {
    return {
      rate:
        faceNeighbors >= 2
          ? configuration.concaveFillRate
          : neighborClassRate(mooreNeighbors, configuration),
      openingInfluence: 0,
      facetFamily: inheritedFamily,
    };
  }
  const openingDirection = candidate2eOpeningDirection(configuration);
  const bodyNormal =
    configuration.bodyNormalMode === 'moore-gradient'
      ? outwardMooreVector
      : outwardFaceVector;
  const outwardLength = Math.hypot(...bodyNormal);
  const bodyAlignment =
    configuration.directionalBodyExpansion && outwardLength > 0
      ? (bodyNormal[0] * openingDirection[0] +
          bodyNormal[1] * openingDirection[1] +
          bodyNormal[2] * openingDirection[2]) /
        outwardLength
      : 0;
  let directionalBodyRate = configuration.directionalBodyExpansion
    ? configuration.bodyRate +
      Math.max(0, bodyAlignment) *
        (configuration.bodyFrontRate - configuration.bodyRate) +
      Math.max(0, -bodyAlignment) *
        (configuration.bodyBackRate - configuration.bodyRate)
    : configuration.bodyRate;
  if (configuration.bodyFacetExpansion) {
    const alignment =
      configuration.propagatedFacetState && inheritedFamily >= 0
        ? bodyFacetFamilyAlignment(bodyNormal, inheritedFamily, configuration)
        : bodyFacetAlignment(bodyNormal, openingDirection, configuration);
    const normalizedAlignment = Math.max(0, Math.min(1, alignment));
    const facetWeight = configuration.singularFacetKinetics
      ? normalizedAlignment ** configuration.bodyFacetPower
      : Math.max(
          0,
          Math.min(
            1,
            (alignment - configuration.bodyFacetAlignmentFloor) /
              (1 - configuration.bodyFacetAlignmentFloor),
          ),
        );
    directionalBodyRate +=
      facetWeight * (configuration.bodyFacetRate - directionalBodyRate);
  }
  if (configuration.bodyExposureScreening) {
    const normalizedExposure = Math.max(
      0,
      Math.min(1, (9 - mooreNeighbors) / 8),
    );
    directionalBodyRate *=
      configuration.bodyFaceScreeningFloor +
      (1 - configuration.bodyFaceScreeningFloor) *
        normalizedExposure ** configuration.bodyExposurePower;
  }
  const bodyRate = configuration.directionalBodyExpansion
    ? faceNeighbors >= 2
      ? Math.min(1, directionalBodyRate * configuration.bodyConcaveMultiplier)
      : directionalBodyRate
    : faceNeighbors >= 2
      ? configuration.concaveFillRate
      : configuration.bodyRate;
  let openingAlignment = 0;
  if (configuration.openingAlignmentMode === 'maximum-support') {
    for (
      let offsetIndex = 0;
      offsetIndex < FACE_OFFSETS.length;
      offsetIndex += 1
    ) {
      if ((faceSupportMask & (1 << offsetIndex)) === 0) continue;
      const [dx, dy, dz] = FACE_OFFSETS[offsetIndex]!;
      openingAlignment = Math.max(
        openingAlignment,
        -dx * openingDirection[0] -
          dy * openingDirection[1] -
          dz * openingDirection[2],
      );
    }
  } else {
    const vectorLength = Math.hypot(...outwardFaceVector);
    if (vectorLength > 0) {
      openingAlignment =
        (outwardFaceVector[0] * openingDirection[0] +
          outwardFaceVector[1] * openingDirection[1] +
          outwardFaceVector[2] * openingDirection[2]) /
        vectorLength;
    }
  }
  const directOpeningAlignment = Math.max(0, Math.min(1, openingAlignment));
  const inheritedOpeningInfluence =
    configuration.openingInheritance *
    (configuration.boundedOpeningPatch
      ? maximumNonRecedingOpeningInfluence
      : maximumSupportOpeningInfluence);
  const effectiveOpeningInfluence = configuration.boundedOpeningPatch
    ? inheritedOpeningInfluence
    : Math.max(directOpeningAlignment, inheritedOpeningInfluence);
  let openingRate = neighborClassRate(mooreNeighbors, configuration);
  if (
    inheritedOpeningInfluence > directOpeningAlignment &&
    inheritedOpeningInfluence > 0
  ) {
    const center = configuration.shape.map((size) => (size - 1) / 2);
    const relative = [
      position[0] - center[0]!,
      position[1] - center[1]!,
      position[2] - center[2]!,
    ];
    const axialProjection =
      relative[0]! * openingDirection[0] +
      relative[1]! * openingDirection[1] +
      relative[2]! * openingDirection[2];
    const radial = [
      relative[0]! - openingDirection[0] * axialProjection,
      relative[1]! - openingDirection[1] * axialProjection,
      relative[2]! - openingDirection[2] * axialProjection,
    ];
    const radialLength = Math.hypot(...radial);
    const outwardLength = Math.hypot(...outwardFaceVector);
    const radialAdvance =
      radialLength > 0 && outwardLength > 0
        ? (radial[0]! * outwardFaceVector[0] +
            radial[1]! * outwardFaceVector[1] +
            radial[2]! * outwardFaceVector[2]) /
          (radialLength * outwardLength)
        : 0;
    openingRate =
      radialAdvance > 0
        ? configuration.rimRate
        : configuration.broadInterfaceRate;
  }
  return {
    rate: bodyRate + effectiveOpeningInfluence * (openingRate - bodyRate),
    openingInfluence: effectiveOpeningInfluence,
    facetFamily: inheritedFamily,
  };
}

export function createCandidate2eCellularState(
  configuration: Candidate2eCellularConfiguration = CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1,
): Candidate2eCellularState {
  assertConfiguration(configuration);
  const [width, height, depth] = configuration.shape;
  const voxelCount = width * height * depth;
  const phase = new Uint8Array(voxelCount);
  const supply = new Float64Array(voxelCount);
  supply.fill(configuration.initialSupplyPerCell);
  const interfaceMass = new Float64Array(voxelCount);
  const attachment = new Float32Array(voxelCount);
  const solidificationTime = new Float32Array(voxelCount);
  solidificationTime.fill(-1);
  const openingInfluence = new Float32Array(voxelCount);
  const facetFamily = new Int8Array(voxelCount);
  facetFamily.fill(-1);
  const facetLayer = new Int16Array(voxelCount);
  facetLayer.fill(UNASSIGNED_FACET_LAYER);
  const surfaceClass = new Uint8Array(voxelCount);
  const frontDirection = new Int8Array(voxelCount);
  const frontAge = new Uint16Array(voxelCount);
  const frontSource = new Uint32Array(voxelCount);
  const center = configuration.shape.map((size) => Math.floor(size / 2));
  const openingDirection = candidate2eOpeningDirection(configuration);
  const maximumSeedProjection =
    configuration.seedHalfExtent *
    openingDirection.reduce((sum, component) => sum + Math.abs(component), 0);
  let solidMass = 0;
  for (
    let z = center[2]! - configuration.seedHalfExtent;
    z <= center[2]! + configuration.seedHalfExtent;
    z += 1
  ) {
    for (
      let y = center[1]! - configuration.seedHalfExtent;
      y <= center[1]! + configuration.seedHalfExtent;
      y += 1
    ) {
      for (
        let x = center[0]! - configuration.seedHalfExtent;
        x <= center[0]! + configuration.seedHalfExtent;
        x += 1
      ) {
        const index = indexOf(x, y, z, configuration.shape);
        phase[index] = 1;
        supply[index] = 0;
        solidificationTime[index] = 0;
        const seedProjection =
          (x - center[0]!) * openingDirection[0] +
          (y - center[1]!) * openingDirection[1] +
          (z - center[2]!) * openingDirection[2];
        if (seedProjection >= maximumSeedProjection - 0.75) {
          openingInfluence[index] = 1;
        }
        if (configuration.propagatedFacetState) {
          const relative = [
            x - center[0]!,
            y - center[1]!,
            z - center[2]!,
          ] as const;
          const family = seedFacetFamily(relative, configuration);
          facetFamily[index] = family;
        }
        if (configuration.growthCarrier === 'facet-local-front') {
          const relative = [
            x - center[0]!,
            y - center[1]!,
            z - center[2]!,
          ] as const;
          const family = frontFacetFamily(relative, configuration);
          facetFamily[index] = family;
          facetLayer[index] = facetLayerCoordinate(
            relative,
            family,
            configuration,
          );
        }
        solidMass += configuration.transportedSupply
          ? configuration.transportCaptureMass
          : configuration.captureMass;
      }
    }
  }
  if (configuration.growthCarrier === 'facet-local-front') {
    initializeCandidate2eFacetFrontSource(
      phase,
      openingInfluence,
      facetFamily,
      facetLayer,
      surfaceClass,
      frontDirection,
      frontAge,
      frontSource,
      configuration,
    );
  }
  return {
    configuration,
    phase,
    supply,
    interfaceMass,
    attachment,
    solidificationTime,
    openingInfluence,
    facetFamily,
    facetLayer,
    surfaceClass,
    frontDirection,
    frontAge,
    frontSource,
    step: 0,
    solidMass,
    surfaceExpiredMass: 0,
    initialTotalMass:
      supply.reduce((total, mass) => total + mass, 0) + solidMass,
  };
}

function relaxCandidate2eSupply(state: Candidate2eCellularState): Float64Array {
  const supply = state.supply.slice();
  if (!state.configuration.transportedSupply) return supply;
  const delta = new Float64Array(supply.length);
  const [width, height, depth] = state.configuration.shape;
  const rate = state.configuration.supplyRelaxationRate;
  const transfer = (index: number, neighbor: number) => {
    if (state.phase[neighbor] === 1) return;
    const flux = rate * (state.supply[neighbor]! - state.supply[index]!);
    delta[index] = delta[index]! + flux;
    delta[neighbor] = delta[neighbor]! - flux;
  };
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = indexOf(x, y, z, state.configuration.shape);
        if (state.phase[index] === 1) continue;
        if (x + 1 < width) {
          transfer(index, indexOf(x + 1, y, z, state.configuration.shape));
        }
        if (y + 1 < height) {
          transfer(index, indexOf(x, y + 1, z, state.configuration.shape));
        }
        if (z + 1 < depth) {
          transfer(index, indexOf(x, y, z + 1, state.configuration.shape));
        }
      }
    }
  }
  for (let index = 0; index < supply.length; index += 1) {
    supply[index] = supply[index]! + delta[index]!;
  }
  return supply;
}

export function advanceCandidate2eCellularState(
  state: Candidate2eCellularState,
  scanOrder: Candidate2eScanOrder = 'forward',
): Candidate2eCellularState {
  const { configuration } = state;
  const voxelCount = state.phase.length;
  const phase = state.phase.slice();
  const supply = relaxCandidate2eSupply(state);
  const interfaceMass = state.interfaceMass.slice();
  const attachment = state.attachment.slice();
  const solidificationTime = state.solidificationTime.slice();
  const openingInfluence = state.openingInfluence.slice();
  const facetFamily = state.facetFamily.slice();
  const facetLayer = state.facetLayer.slice();
  const surfaceClass = state.surfaceClass.slice();
  const frontDirection = state.frontDirection.slice();
  const frontAge = state.frontAge.slice();
  const frontSource = state.frontSource.slice();
  const start = scanOrder === 'forward' ? 0 : voxelCount - 1;
  const end = scanOrder === 'forward' ? voxelCount : -1;
  const increment = scanOrder === 'forward' ? 1 : -1;
  let solidMass = state.solidMass;
  let surfaceExpiredMass = state.surfaceExpiredMass;

  for (let index = start; index !== end; index += increment) {
    if (state.phase[index] === 1) continue;
    const [x, y, z] = coordinatesOf(index, configuration.shape);
    if (!isInterior(x, y, z, configuration)) continue;
    const counts = neighborCounts(
      state.phase,
      state.openingInfluence,
      x,
      y,
      z,
      configuration,
    );
    if (counts.face === 0) continue;
    const bodyNormal =
      configuration.bodyNormalMode === 'moore-gradient'
        ? counts.outwardMooreVector
        : counts.outwardFaceVector;
    const family = inheritedFacetFamily(
      state.facetFamily,
      counts.faceSupportMask,
      [x, y, z],
      bodyNormal,
      configuration,
    );
    const rule = attachmentRule(
      counts.face,
      counts.moore,
      counts.outwardFaceVector,
      counts.outwardMooreVector,
      counts.faceSupportMask,
      counts.maximumSupportOpeningInfluence,
      counts.maximumNonRecedingOpeningInfluence,
      family,
      [x, y, z],
      configuration,
    );
    if (configuration.growthCarrier === 'disabled') continue;
    if (configuration.growthCarrier === 'facet-local-front') {
      const site = candidate2eFacetFrontSite(state, index, [x, y, z], counts);
      facetFamily[index] = site.family;
      facetLayer[index] = site.layer;
      surfaceClass[index] = site.surfaceClass;
      frontDirection[index] = site.active ? site.direction : 0;
      frontAge[index] = site.active ? site.age : 0;
      frontSource[index] = site.active ? site.source : 0;
      let accumulatedMass = site.active ? state.interfaceMass[index]! : 0;
      if (!site.active && state.interfaceMass[index]! > 0) {
        supply[index] = supply[index]! + state.interfaceMass[index]!;
        surfaceExpiredMass += state.interfaceMass[index]!;
      }
      const arrival = hasDeterministicSurfaceArrival(
        index,
        state.step,
        configuration.rimRate * configuration.surfaceArrivalScale,
        configuration.surfaceRandomSeed,
      );
      if (arrival) {
        const uptake = Math.min(
          supply[index]!,
          configuration.surfacePacketMass,
          configuration.captureMass - accumulatedMass,
        );
        supply[index] = supply[index]! - uptake;
        accumulatedMass += uptake;
      }
      interfaceMass[index] = accumulatedMass;
      attachment[index] = Math.min(
        1,
        accumulatedMass / configuration.captureMass,
      );
      if (!site.active || accumulatedMass < configuration.captureMass) {
        continue;
      }
      phase[index] = 1;
      interfaceMass[index] = 0;
      attachment[index] = 0;
      solidificationTime[index] = state.step + 1;
      openingInfluence[index] = rule.openingInfluence;
      solidMass += configuration.captureMass;
      continue;
    }
    if (configuration.growthCarrier === 'surface-adsorption') {
      const stable = isCandidate2eSurfaceAttachmentStable(
        counts.face,
        counts.moore,
        configuration,
      );
      let accumulatedMass = stable ? state.interfaceMass[index]! : 0;
      if (!stable && state.interfaceMass[index]! > 0) {
        supply[index] = supply[index]! + state.interfaceMass[index]!;
        surfaceExpiredMass += state.interfaceMass[index]!;
      }
      const arrival = hasDeterministicSurfaceArrival(
        index,
        state.step,
        rule.rate * configuration.surfaceArrivalScale,
        configuration.surfaceRandomSeed,
      );
      if (arrival) {
        const uptake = Math.min(
          supply[index]!,
          configuration.surfacePacketMass,
          configuration.captureMass - accumulatedMass,
        );
        supply[index] = supply[index]! - uptake;
        accumulatedMass += uptake;
      }
      interfaceMass[index] = accumulatedMass;
      attachment[index] = Math.min(
        1,
        accumulatedMass / configuration.captureMass,
      );
      if (accumulatedMass < configuration.captureMass) continue;
      phase[index] = 1;
      interfaceMass[index] = 0;
      attachment[index] = 0;
      solidificationTime[index] = state.step + 1;
      openingInfluence[index] = rule.openingInfluence;
      facetFamily[index] = rule.facetFamily;
      solidMass += configuration.captureMass;
      continue;
    }
    if (configuration.transportedSupply) {
      const remainingMass =
        configuration.transportCaptureMass - state.interfaceMass[index]!;
      const uptake = Math.min(
        supply[index]!,
        remainingMass,
        rule.rate * configuration.interfaceUptakeScale,
      );
      const accumulatedMass = state.interfaceMass[index]! + uptake;
      supply[index] = supply[index]! - uptake;
      interfaceMass[index] = accumulatedMass;
      attachment[index] = Math.min(
        1,
        accumulatedMass / configuration.transportCaptureMass,
      );
      if (accumulatedMass < configuration.transportCaptureMass) continue;
      phase[index] = 1;
      interfaceMass[index] = 0;
      attachment[index] = 0;
      solidificationTime[index] = state.step + 1;
      openingInfluence[index] = rule.openingInfluence;
      facetFamily[index] = rule.facetFamily;
      solidMass += configuration.transportCaptureMass;
      continue;
    }
    const progress = Math.min(1, state.attachment[index]! + rule.rate);
    attachment[index] = progress;
    if (progress < 1 || state.supply[index]! < configuration.captureMass)
      continue;
    phase[index] = 1;
    supply[index] = supply[index]! - configuration.captureMass;
    attachment[index] = 0;
    solidificationTime[index] = state.step + 1;
    openingInfluence[index] = rule.openingInfluence;
    facetFamily[index] = rule.facetFamily;
    solidMass += configuration.captureMass;
  }

  return {
    configuration,
    phase,
    supply,
    interfaceMass,
    attachment,
    solidificationTime,
    openingInfluence,
    facetFamily,
    facetLayer,
    surfaceClass,
    frontDirection,
    frontAge,
    frontSource,
    step: state.step + 1,
    solidMass,
    surfaceExpiredMass,
    initialTotalMass: state.initialTotalMass,
  };
}

export function createCandidate2eScalarSnapshot(
  state: Candidate2eCellularState,
): ScalarFieldSnapshot {
  const orderParameter = new Float32Array(state.phase.length);
  for (let index = 0; index < state.phase.length; index += 1) {
    orderParameter[index] = state.phase[index] === 1 ? 1 : -1;
  }
  return {
    shape: state.configuration.shape,
    voxelCount: state.phase.length,
    orderParameter,
    solidificationTime: state.solidificationTime.slice(),
    step: state.step,
    simulatedTime: state.step,
  };
}

function isFaceConnected(
  phase: Uint8Array,
  shape: GridShape,
  expectedCount: number,
): boolean {
  const first = phase.indexOf(1);
  if (first < 0) return expectedCount === 0;
  const visited = new Uint8Array(phase.length);
  const queue = new Uint32Array(expectedCount);
  let head = 0;
  let tail = 1;
  queue[0] = first;
  visited[first] = 1;
  while (head < tail) {
    const index = queue[head++]!;
    const [x, y, z] = coordinatesOf(index, shape);
    for (const [dx, dy, dz] of FACE_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (
        nx < 0 ||
        ny < 0 ||
        nz < 0 ||
        nx >= shape[0] ||
        ny >= shape[1] ||
        nz >= shape[2]
      ) {
        continue;
      }
      const neighbor = indexOf(nx, ny, nz, shape);
      if (phase[neighbor] !== 1 || visited[neighbor] === 1) continue;
      visited[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }
  return tail === expectedCount;
}

export function summarizeCandidate2eCellularState(
  state: Candidate2eCellularState,
): Candidate2eCellularSummary {
  let liquidSupply = 0;
  let interfaceMass = 0;
  let trappedSupply = 0;
  let minimumSupply = Infinity;
  let solidCellCount = 0;
  let frontSolidCellCount = 0;
  const frontLayerCounts = new Map<string, number>();
  const frontSources = new Set<number>();
  let boundaryTouched = false;
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < state.phase.length; index += 1) {
    minimumSupply = Math.min(minimumSupply, state.supply[index]!);
    interfaceMass += state.interfaceMass[index]!;
    if (state.phase[index] !== 1) {
      liquidSupply += state.supply[index]!;
      continue;
    }
    trappedSupply += state.supply[index]!;
    solidCellCount += 1;
    if (state.frontSource[index]! > 0) {
      frontSolidCellCount += 1;
      frontSources.add(state.frontSource[index]!);
      const key = `${state.frontSource[index]}:${state.facetFamily[index]}:${state.facetLayer[index]}`;
      frontLayerCounts.set(key, (frontLayerCounts.get(key) ?? 0) + 1);
    }
    const [x, y, z] = coordinatesOf(index, state.configuration.shape);
    const coordinate = [x, y, z];
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis]!, coordinate[axis]!);
      maximum[axis] = Math.max(maximum[axis]!, coordinate[axis]!);
    }
    if (!isInterior(x, y, z, state.configuration)) boundaryTouched = true;
  }
  const totalMass =
    liquidSupply + trappedSupply + interfaceMass + state.solidMass;
  let largestFrontLayerCellCount = 0;
  for (const count of frontLayerCounts.values()) {
    largestFrontLayerCellCount = Math.max(largestFrontLayerCellCount, count);
  }
  return {
    step: state.step,
    solidCellCount,
    liquidSupply,
    interfaceMass,
    surfaceExpiredMass: state.surfaceExpiredMass,
    trappedSupply,
    minimumSupply,
    totalMass,
    ledgerError: totalMass - state.initialTotalMass,
    boundaryTouched,
    faceConnected: isFaceConnected(
      state.phase,
      state.configuration.shape,
      solidCellCount,
    ),
    frontSolidCellCount,
    frontSourceCount: frontSources.size,
    frontLayerCount: frontLayerCounts.size,
    largestFrontLayerCellCount,
    occupiedBounds: [
      [minimum[0]!, maximum[0]!],
      [minimum[1]!, maximum[1]!],
      [minimum[2]!, maximum[2]!],
    ],
  };
}

export function runCandidate2eGeometryTest(
  configuration: Candidate2eCellularConfiguration = CANDIDATE_2E_SPARSE_EDGE_SOURCE_TEST_1,
): Candidate2eGeometryRun {
  let state = createCandidate2eCellularState(configuration);
  const checkpoints: Candidate2eGeometryCheckpoint[] = [];
  const checkpointSteps = new Set(configuration.checkpointSteps);
  const finalStep = configuration.checkpointSteps[2];
  while (state.step < finalStep) {
    state = advanceCandidate2eCellularState(state);
    if (checkpointSteps.has(state.step)) {
      checkpoints.push({
        state,
        snapshot: createCandidate2eScalarSnapshot(state),
        summary: summarizeCandidate2eCellularState(state),
      });
    }
  }
  return { configuration, checkpoints, finalState: state };
}
