import {
  createCandidate2CFacetedThermalState,
  measureCandidate2CFacetedThermalCheckpoint,
  runCandidate2CFacetedThermalSteps,
  type Candidate2CFacetedThermalArmResult,
  type Candidate2CFacetedThermalCheckpoint,
  type Candidate2CFacetedThermalConfiguration,
  type Candidate2CFacetedThermalState,
} from './candidate2c-faceted-thermal';
import {
  CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN,
  createCandidate2CFacetedMorphologyScreenConfiguration,
  projectCandidate2CFacetedMorphologyState,
  type Candidate2CFacetedMorphologyState,
} from './candidate2c-morphology';

export type Candidate2CFacetedMorphologyClassification =
  'invalid' | 'non-hopper' | 'hopper-mechanism-candidate';

export interface Candidate2CFacetedMorphologyRefinementPlan {
  readonly evaluationTime: number;
  readonly totalSteps: number;
  readonly timeStep: number;
  readonly checkpointInterval: number;
  readonly checkpointSteps: readonly number[];
  readonly checkpointTimes: readonly number[];
}

export interface Candidate2CFacetedMorphologyRefinementCheckpoint {
  readonly index: number;
  readonly physicalTime: number;
  readonly base: Candidate2CFacetedThermalCheckpoint;
  readonly refined: Candidate2CFacetedThermalCheckpoint;
  readonly timeDifference: number;
  readonly emittedLayerDifference: number;
  readonly completedLayerDifference: number;
  readonly activeTerraceDifference: number;
  readonly resolvedTerraceDifference: number;
  readonly openingDepthDifference: number;
  readonly layerPhaseDifference: number;
  readonly matchedLoopOffsetDifference: number;
  readonly contactLineTemperatureDifference: number;
  readonly surfaceFluxJumpDifference: number;
  readonly externalHeatDifference: number;
  readonly analyticVolumeDifference: number;
  readonly rasterizedVolumeDifference: number;
  readonly latentHeatDifference: number;
  readonly maximumContinuousDifference: number;
  readonly maximumLedgerResidual: number;
}

export interface Candidate2CFacetedMorphologyRefinementGates {
  readonly configurationFrozen: boolean;
  readonly alignedPhysicalTimes: boolean;
  readonly finite: boolean;
  readonly strictTopology: boolean;
  readonly birthOrderingMatches: boolean;
  readonly completionOrderingMatches: boolean;
  readonly discreteCheckpointsMatch: boolean;
  readonly finalTopologyMatches: boolean;
  readonly layerPhasePasses: boolean;
  readonly birthTimesPass: boolean;
  readonly loopOffsetsPass: boolean;
  readonly continuousStatePasses: boolean;
  readonly ledgersClose: boolean;
  readonly classificationsHold: boolean;
}

export interface Candidate2CFacetedMorphologyRefinementComparison {
  readonly passes: boolean;
  readonly baseClassification: Candidate2CFacetedMorphologyClassification;
  readonly refinedClassification: Candidate2CFacetedMorphologyClassification;
  readonly checkpoints: readonly Candidate2CFacetedMorphologyRefinementCheckpoint[];
  readonly maximumTimeDifference: number;
  readonly maximumLayerPhaseDifference: number;
  readonly maximumBirthTimeDifference: number;
  readonly maximumMatchedLoopOffsetDifference: number;
  readonly maximumContinuousDifference: number;
  readonly maximumLedgerResidual: number;
  readonly firstFailedCheckpointIndex: number | null;
  readonly gates: Candidate2CFacetedMorphologyRefinementGates;
}

export interface Candidate2CFacetedMorphologyRefinementExecution {
  readonly comparison: Candidate2CFacetedMorphologyRefinementComparison;
  readonly baseResult: Candidate2CFacetedThermalArmResult;
  readonly refinedResult: Candidate2CFacetedThermalArmResult;
  readonly refinedCarrierStates: readonly Candidate2CFacetedMorphologyState[];
}

export interface Candidate2CFacetedMorphologySpaceRefinementGates {
  readonly configurationFrozen: boolean;
  readonly physicalDomainPreserved: boolean;
  readonly sourceGeometryRefined: boolean;
  readonly alignedPhysicalTimes: boolean;
  readonly finite: boolean;
  readonly strictTopology: boolean;
  readonly birthOrderingMatches: boolean;
  readonly completionOrderingMatches: boolean;
  readonly discreteCheckpointsPass: boolean;
  readonly finalTopologyMatches: boolean;
  readonly layerPhasePasses: boolean;
  readonly birthTimesPass: boolean;
  readonly loopOffsetsPass: boolean;
  readonly continuousStatePasses: boolean;
  readonly ledgersClose: boolean;
  readonly classificationsHold: boolean;
}

export interface Candidate2CFacetedMorphologySpaceRefinementComparison {
  readonly passes: boolean;
  readonly baseClassification: Candidate2CFacetedMorphologyClassification;
  readonly refinedClassification: Candidate2CFacetedMorphologyClassification;
  readonly checkpoints: readonly Candidate2CFacetedMorphologyRefinementCheckpoint[];
  readonly maximumTimeDifference: number;
  readonly maximumLayerPhaseDifference: number;
  readonly maximumBirthTimeDifference: number;
  readonly maximumMatchedLoopOffsetDifference: number;
  readonly maximumContinuousDifference: number;
  readonly maximumLedgerResidual: number;
  readonly firstFailedCheckpointIndex: number | null;
  readonly gates: Candidate2CFacetedMorphologySpaceRefinementGates;
}

export interface Candidate2CFacetedMorphologySpaceRefinementExecution {
  readonly comparison: Candidate2CFacetedMorphologySpaceRefinementComparison;
  readonly refinedResult: Candidate2CFacetedThermalArmResult;
  readonly refinedCarrierStates: readonly Candidate2CFacetedMorphologyState[];
}

const CHECKPOINT_COUNT =
  CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.checkpointSteps.length;
const CHECKPOINT_TIMES = Object.freeze(
  Array.from(
    { length: CHECKPOINT_COUNT },
    (_, index) =>
      (CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.evaluationTime * index) /
      (CHECKPOINT_COUNT - 1),
  ),
);
const REFINED_TOTAL_STEPS =
  CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.totalSteps * 2;
const REFINED_CHECKPOINT_INTERVAL =
  CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.checkpointInterval * 2;

/** Fixed before the screen-level half-time-step result is inspected. */
export const CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT = Object.freeze({
  base: Object.freeze({
    ...CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN,
    checkpointTimes: CHECKPOINT_TIMES,
  }) satisfies Candidate2CFacetedMorphologyRefinementPlan,
  refined: Object.freeze({
    evaluationTime: CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.evaluationTime,
    totalSteps: REFINED_TOTAL_STEPS,
    timeStep:
      CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN.evaluationTime /
      REFINED_TOTAL_STEPS,
    checkpointInterval: REFINED_CHECKPOINT_INTERVAL,
    checkpointSteps: Object.freeze(
      Array.from(
        { length: CHECKPOINT_COUNT },
        (_, index) => index * REFINED_CHECKPOINT_INTERVAL,
      ),
    ),
    checkpointTimes: CHECKPOINT_TIMES,
  }) satisfies Candidate2CFacetedMorphologyRefinementPlan,
  gates: Object.freeze({
    maximumTimeAlignmentError: 1e-12,
    maximumLayerPhaseDifference: 0.15,
    maximumBirthTimeDifference: 0.05,
    maximumMatchedLoopOffsetDifference: 0.05,
    maximumContinuousDifference: 0.05,
    maximumLedgerResidual: 1e-10,
  }),
});

/** Fixed before the screen-level half-spacing result is inspected. */
export const CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT = Object.freeze({
  base: Object.freeze({
    ...CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN,
    checkpointTimes: CHECKPOINT_TIMES,
  }) satisfies Candidate2CFacetedMorphologyRefinementPlan,
  refined: Object.freeze({
    ...CANDIDATE2C_FACETED_MORPHOLOGY_SCREEN,
    checkpointTimes: CHECKPOINT_TIMES,
  }) satisfies Candidate2CFacetedMorphologyRefinementPlan,
  refinedShape: Object.freeze([160, 96, 160] as const),
  refinedSpacing: 0.1875,
  gates: Object.freeze({
    maximumTimeAlignmentError: 1e-12,
    maximumDiscreteTerraceDifference: 1,
    maximumOpeningDepthDifferenceInSteps: 1,
    maximumLayerPhaseDifference: 0.25,
    maximumBirthTimeDifference: 0.1,
    maximumMatchedLoopOffsetDifference: 0.1,
    maximumContinuousDifference: 0.15,
    maximumLedgerResidual: 1e-10,
  }),
});

export function createCandidate2CFacetedMorphologyTimeRefinedConfiguration(): Candidate2CFacetedThermalConfiguration {
  return {
    ...createCandidate2CFacetedMorphologyScreenConfiguration(),
    timeStep: CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT.refined.timeStep,
  };
}

export function createCandidate2CFacetedMorphologySpaceRefinedConfiguration(): Candidate2CFacetedThermalConfiguration {
  return {
    ...createCandidate2CFacetedMorphologyScreenConfiguration(),
    shape: CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT.refinedShape,
    spacing: CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT.refinedSpacing,
  };
}

function normalizedDifference(left: number, right: number): number {
  return Math.abs(left - right) / Math.max(1, Math.abs(left), Math.abs(right));
}

function sameValues(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function configurationMatchesProtocol(
  base: Candidate2CFacetedThermalState,
  refined: Candidate2CFacetedThermalState,
): boolean {
  const left = base.configuration;
  const right = refined.configuration;
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT;
  return (
    left.timeStep === protocol.base.timeStep &&
    right.timeStep === protocol.refined.timeStep &&
    base.step === protocol.base.totalSteps &&
    refined.step === protocol.refined.totalSteps &&
    sameValues(
      [left.orientation.x, left.orientation.y, left.orientation.z],
      [right.orientation.x, right.orientation.y, right.orientation.z],
    ) &&
    left.facetInradius === right.facetInradius &&
    left.stepHeight === right.stepHeight &&
    left.birthInwardOffset === right.birthInwardOffset &&
    left.stepKineticCoefficient === right.stepKineticCoefficient &&
    left.nucleationPrefactor === right.nucleationPrefactor &&
    left.nucleationBarrier === right.nucleationBarrier &&
    left.latentHeatPerVolume === right.latentHeatPerVolume &&
    sameValues(left.shape, right.shape) &&
    left.spacing === right.spacing &&
    left.thermalDiffusivity === right.thermalDiffusivity &&
    left.initialTemperature === right.initialTemperature &&
    left.edgeBandWidth === right.edgeBandWidth &&
    sameValues(left.centerXZ, right.centerXZ) &&
    left.freeSurface.enabled === right.freeSurface.enabled &&
    left.freeSurface.biotNumber === right.freeSurface.biotNumber &&
    left.freeSurface.solidBiotNumber === right.freeSurface.solidBiotNumber &&
    left.freeSurface.ambientTemperature === right.freeSurface.ambientTemperature
  );
}

function configurationEquals(
  actual: Candidate2CFacetedThermalConfiguration,
  expected: Candidate2CFacetedThermalConfiguration,
): boolean {
  return (
    actual.timeStep === expected.timeStep &&
    sameValues(
      [actual.orientation.x, actual.orientation.y, actual.orientation.z],
      [expected.orientation.x, expected.orientation.y, expected.orientation.z],
    ) &&
    actual.facetInradius === expected.facetInradius &&
    actual.stepHeight === expected.stepHeight &&
    actual.birthInwardOffset === expected.birthInwardOffset &&
    actual.stepKineticCoefficient === expected.stepKineticCoefficient &&
    actual.nucleationPrefactor === expected.nucleationPrefactor &&
    actual.nucleationBarrier === expected.nucleationBarrier &&
    actual.latentHeatPerVolume === expected.latentHeatPerVolume &&
    sameValues(actual.shape, expected.shape) &&
    actual.spacing === expected.spacing &&
    actual.thermalDiffusivity === expected.thermalDiffusivity &&
    actual.initialTemperature === expected.initialTemperature &&
    actual.edgeBandWidth === expected.edgeBandWidth &&
    sameValues(actual.centerXZ, expected.centerXZ) &&
    actual.freeSurface.enabled === expected.freeSurface.enabled &&
    actual.freeSurface.biotNumber === expected.freeSurface.biotNumber &&
    actual.freeSurface.solidBiotNumber ===
      expected.freeSurface.solidBiotNumber &&
    actual.freeSurface.ambientTemperature ===
      expected.freeSurface.ambientTemperature
  );
}

function spaceConfigurationMatchesProtocol(
  base: Candidate2CFacetedThermalState,
  refined: Candidate2CFacetedThermalState,
): boolean {
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT;
  return (
    base.step === protocol.base.totalSteps &&
    refined.step === protocol.refined.totalSteps &&
    configurationEquals(
      base.configuration,
      createCandidate2CFacetedMorphologyScreenConfiguration(),
    ) &&
    configurationEquals(
      refined.configuration,
      createCandidate2CFacetedMorphologySpaceRefinedConfiguration(),
    )
  );
}

function spaceGeometryProtocol(
  base: Candidate2CFacetedThermalState,
  refined: Candidate2CFacetedThermalState,
): {
  readonly physicalDomainPreserved: boolean;
  readonly sourceGeometryRefined: boolean;
} {
  const left = base.configuration;
  const right = refined.configuration;
  return {
    physicalDomainPreserved: sameValues(left.domainSize, right.domainSize),
    sourceGeometryRefined:
      right.spacing === left.spacing / 2 &&
      right.shape.every((size, index) => size === 2 * left.shape[index]!) &&
      right.edgeBandCells === 2 * left.edgeBandCells &&
      right.facetInradiusCells === 2 * left.facetInradiusCells &&
      right.surfaceCellCount === 4 * left.surfaceCellCount,
  };
}

function strictlyDescending(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (!((values[index - 1] ?? Number.NaN) > (values[index] ?? Number.NaN))) {
      return false;
    }
  }
  return true;
}

function finiteCheckpoint(
  checkpoint: Candidate2CFacetedThermalCheckpoint,
): boolean {
  return [
    checkpoint.step,
    checkpoint.time,
    checkpoint.solidEdgeTemperature,
    checkpoint.liquidEdgeTemperature,
    checkpoint.edgeContrast,
    checkpoint.contactLineTemperature,
    checkpoint.contactLineUndercooling,
    checkpoint.surfaceFluxJump,
    checkpoint.activeTerraceCount,
    checkpoint.resolvedTerraceCount,
    checkpoint.completedLayers,
    checkpoint.emittedLayers,
    checkpoint.layerPhase,
    checkpoint.openingDepth,
    checkpoint.maximumLocalSolidHeight,
    checkpoint.cumulativeExternalHeat,
    checkpoint.cumulativeLatentHeat,
    checkpoint.ledger.thermalEnergy,
    checkpoint.ledger.expectedThermalEnergy,
    checkpoint.ledger.residual,
    checkpoint.ledger.scale,
    checkpoint.ledger.normalizedResidual,
    checkpoint.ledger.analyticSolidVolume,
    checkpoint.ledger.rasterizedSolidVolume,
    checkpoint.ledger.rasterGeometryRelativeError,
    checkpoint.ledger.expectedLatentHeat,
    checkpoint.ledger.latentResidual,
    ...checkpoint.activeLoopOffsets,
  ].every(Number.isFinite);
}

function finiteState(state: Candidate2CFacetedThermalState): boolean {
  if (
    ![
      state.completedLayers,
      state.nucleationAccumulator,
      state.emittedLayers,
      state.lastLayerBirthRate,
      state.integratedSolidVolume,
      state.rasterizedSolidVolume,
      state.maximumLocalSolidHeight,
      state.cumulativeExternalHeat,
      state.cumulativeLatentHeat,
      state.initialThermalEnergy,
      state.maximumEnergyRelativeResidual,
      state.maximumRasterGeometryRelativeError,
      state.time,
      state.step,
      ...state.activeLoopOffsets,
      ...state.birthEvents.flatMap((event) => [
        event.ordinal,
        event.time,
        event.bracketStart,
        event.bracketEnd,
      ]),
    ].every(Number.isFinite)
  ) {
    return false;
  }
  for (const value of state.temperature) {
    if (!Number.isFinite(value)) return false;
  }
  for (const value of state.solidVolumeByCell) {
    if (!Number.isFinite(value)) return false;
  }
  return true;
}

function orderedBirths(state: Candidate2CFacetedThermalState): boolean {
  if (state.birthEvents.length !== state.emittedLayers) return false;
  let previousTime = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < state.birthEvents.length; index += 1) {
    const event = state.birthEvents[index]!;
    if (
      event.ordinal !== index + 1 ||
      event.time < event.bracketStart ||
      event.time > event.bracketEnd ||
      !(event.time > previousTime)
    ) {
      return false;
    }
    previousTime = event.time;
  }
  return true;
}

function monotoneCompletions(
  checkpoints: readonly Candidate2CFacetedThermalCheckpoint[],
): boolean {
  for (let index = 1; index < checkpoints.length; index += 1) {
    if (
      (checkpoints[index]?.completedLayers ?? Number.NaN) <
      (checkpoints[index - 1]?.completedLayers ?? Number.NaN)
    ) {
      return false;
    }
  }
  return true;
}

function strictArmTopology(
  result: Candidate2CFacetedThermalArmResult,
): boolean {
  const finalOffsets = result.finalState.activeLoopOffsets;
  return (
    !result.finalState.loopCrossingDetected &&
    strictlyDescending(finalOffsets) &&
    finalOffsets.every(
      (offset) =>
        offset >= result.finalState.configuration.birthInwardOffset &&
        offset < result.finalState.configuration.facetInradius,
    ) &&
    result.checkpoints.every(
      (checkpoint) =>
        strictlyDescending(checkpoint.activeLoopOffsets) &&
        checkpoint.activeLoopOffsets.every(
          (offset) =>
            offset >= result.finalState.configuration.birthInwardOffset &&
            offset < result.finalState.configuration.facetInradius,
        ),
    )
  );
}

function finalStateMatchesCheckpoint(
  result: Candidate2CFacetedThermalArmResult,
): boolean {
  const final = result.checkpoints.at(-1);
  const state = result.finalState;
  return (
    final !== undefined &&
    state.step === final.step &&
    state.time === final.time &&
    state.emittedLayers === final.emittedLayers &&
    state.completedLayers === final.completedLayers &&
    state.activeLoopOffsets.length === final.activeLoopOffsets.length &&
    state.activeLoopOffsets.every(
      (offset, index) => offset === final.activeLoopOffsets[index],
    ) &&
    state.emittedLayers + state.nucleationAccumulator === final.layerPhase &&
    state.integratedSolidVolume === final.ledger.analyticSolidVolume &&
    state.rasterizedSolidVolume === final.ledger.rasterizedSolidVolume &&
    state.cumulativeLatentHeat === final.cumulativeLatentHeat &&
    state.cumulativeExternalHeat === final.cumulativeExternalHeat
  );
}

function latentResidual(
  checkpoint: Candidate2CFacetedThermalCheckpoint,
): number {
  return (
    Math.abs(checkpoint.ledger.latentResidual) /
    Math.max(
      1,
      Math.abs(checkpoint.cumulativeLatentHeat),
      Math.abs(checkpoint.ledger.expectedLatentHeat),
    )
  );
}

function checkpointLedgerResidual(
  checkpoint: Candidate2CFacetedThermalCheckpoint,
): number {
  return Math.max(
    Math.abs(checkpoint.ledger.normalizedResidual),
    checkpoint.ledger.rasterGeometryRelativeError,
    latentResidual(checkpoint),
  );
}

function classifyArm(
  result: Candidate2CFacetedThermalArmResult,
): Candidate2CFacetedMorphologyClassification {
  const final = result.checkpoints.at(-1);
  if (
    !final ||
    !finiteState(result.finalState) ||
    !result.checkpoints.every(finiteCheckpoint) ||
    !strictArmTopology(result)
  ) {
    return 'invalid';
  }
  if (
    final.resolvedTerraceCount < 2 ||
    final.openingDepth < 2 * result.finalState.configuration.stepHeight
  ) {
    return 'non-hopper';
  }
  return 'hopper-mechanism-candidate';
}

function compareCheckpoint(
  index: number,
  base: Candidate2CFacetedThermalCheckpoint,
  refined: Candidate2CFacetedThermalCheckpoint,
  facetInradius: number,
): Candidate2CFacetedMorphologyRefinementCheckpoint {
  let matchedLoopOffsetDifference = 0;
  const matchedLoops = Math.min(
    base.activeLoopOffsets.length,
    refined.activeLoopOffsets.length,
  );
  for (let loop = 0; loop < matchedLoops; loop += 1) {
    matchedLoopOffsetDifference = Math.max(
      matchedLoopOffsetDifference,
      Math.abs(
        (base.activeLoopOffsets[loop] ?? Number.NaN) -
          (refined.activeLoopOffsets[loop] ?? Number.NaN),
      ) / facetInradius,
    );
  }
  const contactLineTemperatureDifference = normalizedDifference(
    base.contactLineTemperature,
    refined.contactLineTemperature,
  );
  const surfaceFluxJumpDifference = normalizedDifference(
    base.surfaceFluxJump,
    refined.surfaceFluxJump,
  );
  const externalHeatDifference = normalizedDifference(
    base.cumulativeExternalHeat,
    refined.cumulativeExternalHeat,
  );
  const analyticVolumeDifference = normalizedDifference(
    base.ledger.analyticSolidVolume,
    refined.ledger.analyticSolidVolume,
  );
  const rasterizedVolumeDifference = normalizedDifference(
    base.ledger.rasterizedSolidVolume,
    refined.ledger.rasterizedSolidVolume,
  );
  const latentHeatDifference = normalizedDifference(
    base.cumulativeLatentHeat,
    refined.cumulativeLatentHeat,
  );
  return {
    index,
    physicalTime: CHECKPOINT_TIMES[index] ?? Number.NaN,
    base,
    refined,
    timeDifference: Math.max(
      Math.abs(base.time - (CHECKPOINT_TIMES[index] ?? Number.NaN)),
      Math.abs(refined.time - (CHECKPOINT_TIMES[index] ?? Number.NaN)),
      Math.abs(base.time - refined.time),
    ),
    emittedLayerDifference: Math.abs(
      base.emittedLayers - refined.emittedLayers,
    ),
    completedLayerDifference: Math.abs(
      base.completedLayers - refined.completedLayers,
    ),
    activeTerraceDifference: Math.abs(
      base.activeTerraceCount - refined.activeTerraceCount,
    ),
    resolvedTerraceDifference: Math.abs(
      base.resolvedTerraceCount - refined.resolvedTerraceCount,
    ),
    openingDepthDifference: Math.abs(base.openingDepth - refined.openingDepth),
    layerPhaseDifference: Math.abs(base.layerPhase - refined.layerPhase),
    matchedLoopOffsetDifference,
    contactLineTemperatureDifference,
    surfaceFluxJumpDifference,
    externalHeatDifference,
    analyticVolumeDifference,
    rasterizedVolumeDifference,
    latentHeatDifference,
    maximumContinuousDifference: Math.max(
      contactLineTemperatureDifference,
      surfaceFluxJumpDifference,
      externalHeatDifference,
      analyticVolumeDifference,
      rasterizedVolumeDifference,
      latentHeatDifference,
    ),
    maximumLedgerResidual: Math.max(
      checkpointLedgerResidual(base),
      checkpointLedgerResidual(refined),
    ),
  };
}

export function compareCandidate2CFacetedMorphologyTimeRefinement(
  base: Candidate2CFacetedThermalArmResult,
  refined: Candidate2CFacetedThermalArmResult,
): Candidate2CFacetedMorphologyRefinementComparison {
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT;
  const pairedCheckpointCount = Math.min(
    base.checkpoints.length,
    refined.checkpoints.length,
    CHECKPOINT_COUNT,
  );
  const checkpoints = Array.from(
    { length: pairedCheckpointCount },
    (_, index) =>
      compareCheckpoint(
        index,
        base.checkpoints[index]!,
        refined.checkpoints[index]!,
        base.finalState.configuration.facetInradius,
      ),
  );
  const baseClassification = classifyArm(base);
  const refinedClassification = classifyArm(refined);
  const maximumTimeDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.timeDifference),
  );
  const maximumLayerPhaseDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.layerPhaseDifference),
  );
  let maximumBirthTimeDifference = 0;
  const birthCountsMatch =
    base.finalState.birthEvents.length ===
    refined.finalState.birthEvents.length;
  const commonBirths = Math.min(
    base.finalState.birthEvents.length,
    refined.finalState.birthEvents.length,
  );
  let birthOrdinalsMatch = birthCountsMatch;
  for (let index = 0; index < commonBirths; index += 1) {
    const baseEvent = base.finalState.birthEvents[index]!;
    const refinedEvent = refined.finalState.birthEvents[index]!;
    birthOrdinalsMatch &&= baseEvent.ordinal === refinedEvent.ordinal;
    maximumBirthTimeDifference = Math.max(
      maximumBirthTimeDifference,
      Math.abs(baseEvent.time - refinedEvent.time),
    );
  }
  const maximumMatchedLoopOffsetDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.matchedLoopOffsetDifference),
  );
  const maximumContinuousDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.maximumContinuousDifference),
  );
  const maximumLedgerResidual = Math.max(
    base.finalState.maximumEnergyRelativeResidual,
    refined.finalState.maximumEnergyRelativeResidual,
    base.finalState.maximumRasterGeometryRelativeError,
    refined.finalState.maximumRasterGeometryRelativeError,
    ...checkpoints.map((checkpoint) => checkpoint.maximumLedgerResidual),
  );
  const alignedPhysicalTimes =
    checkpoints.length === CHECKPOINT_COUNT &&
    base.checkpoints.length === CHECKPOINT_COUNT &&
    refined.checkpoints.length === CHECKPOINT_COUNT &&
    checkpoints.every(
      (checkpoint, index) =>
        checkpoint.base.step === protocol.base.checkpointSteps[index] &&
        checkpoint.refined.step === protocol.refined.checkpointSteps[index] &&
        checkpoint.timeDifference <= protocol.gates.maximumTimeAlignmentError,
    );
  const finite =
    finiteState(base.finalState) &&
    finiteState(refined.finalState) &&
    base.checkpoints.every(finiteCheckpoint) &&
    refined.checkpoints.every(finiteCheckpoint);
  const strictTopology = strictArmTopology(base) && strictArmTopology(refined);
  const birthOrderingMatches =
    orderedBirths(base.finalState) &&
    orderedBirths(refined.finalState) &&
    birthOrdinalsMatch;
  const completionOrderingMatches =
    monotoneCompletions(base.checkpoints) &&
    monotoneCompletions(refined.checkpoints);
  const discreteCheckpointsMatch = checkpoints.every(
    (checkpoint) =>
      checkpoint.emittedLayerDifference === 0 &&
      checkpoint.completedLayerDifference === 0 &&
      checkpoint.activeTerraceDifference === 0 &&
      checkpoint.resolvedTerraceDifference === 0 &&
      checkpoint.openingDepthDifference === 0,
  );
  const finalTopologyMatches =
    finalStateMatchesCheckpoint(base) &&
    finalStateMatchesCheckpoint(refined) &&
    base.finalState.emittedLayers === refined.finalState.emittedLayers &&
    base.finalState.completedLayers === refined.finalState.completedLayers &&
    base.finalState.activeLoopOffsets.length ===
      refined.finalState.activeLoopOffsets.length;
  const gates: Candidate2CFacetedMorphologyRefinementGates = {
    configurationFrozen: configurationMatchesProtocol(
      base.finalState,
      refined.finalState,
    ),
    alignedPhysicalTimes,
    finite,
    strictTopology,
    birthOrderingMatches,
    completionOrderingMatches,
    discreteCheckpointsMatch,
    finalTopologyMatches,
    layerPhasePasses:
      maximumLayerPhaseDifference <= protocol.gates.maximumLayerPhaseDifference,
    birthTimesPass:
      maximumBirthTimeDifference <= protocol.gates.maximumBirthTimeDifference,
    loopOffsetsPass:
      maximumMatchedLoopOffsetDifference <=
      protocol.gates.maximumMatchedLoopOffsetDifference,
    continuousStatePasses:
      maximumContinuousDifference <= protocol.gates.maximumContinuousDifference,
    ledgersClose: maximumLedgerResidual <= protocol.gates.maximumLedgerResidual,
    classificationsHold:
      baseClassification === 'hopper-mechanism-candidate' &&
      refinedClassification === 'hopper-mechanism-candidate',
  };
  const passes = Object.values(gates).every(Boolean);
  const firstFailedCheckpoint = checkpoints.find(
    (checkpoint) =>
      checkpoint.timeDifference > protocol.gates.maximumTimeAlignmentError ||
      checkpoint.emittedLayerDifference !== 0 ||
      checkpoint.completedLayerDifference !== 0 ||
      checkpoint.activeTerraceDifference !== 0 ||
      checkpoint.resolvedTerraceDifference !== 0 ||
      checkpoint.openingDepthDifference !== 0 ||
      checkpoint.layerPhaseDifference >
        protocol.gates.maximumLayerPhaseDifference ||
      checkpoint.matchedLoopOffsetDifference >
        protocol.gates.maximumMatchedLoopOffsetDifference ||
      checkpoint.maximumContinuousDifference >
        protocol.gates.maximumContinuousDifference ||
      checkpoint.maximumLedgerResidual > protocol.gates.maximumLedgerResidual,
  );
  return {
    passes,
    baseClassification,
    refinedClassification,
    checkpoints,
    maximumTimeDifference,
    maximumLayerPhaseDifference,
    maximumBirthTimeDifference,
    maximumMatchedLoopOffsetDifference,
    maximumContinuousDifference,
    maximumLedgerResidual,
    firstFailedCheckpointIndex: firstFailedCheckpoint?.index ?? null,
    gates,
  };
}

export function compareCandidate2CFacetedMorphologySpaceRefinement(
  base: Candidate2CFacetedThermalArmResult,
  refined: Candidate2CFacetedThermalArmResult,
): Candidate2CFacetedMorphologySpaceRefinementComparison {
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT;
  const pairedCheckpointCount = Math.min(
    base.checkpoints.length,
    refined.checkpoints.length,
    CHECKPOINT_COUNT,
  );
  const checkpoints = Array.from(
    { length: pairedCheckpointCount },
    (_, index) =>
      compareCheckpoint(
        index,
        base.checkpoints[index]!,
        refined.checkpoints[index]!,
        base.finalState.configuration.facetInradius,
      ),
  );
  const baseClassification = classifyArm(base);
  const refinedClassification = classifyArm(refined);
  const maximumTimeDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.timeDifference),
  );
  const maximumLayerPhaseDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.layerPhaseDifference),
  );
  const birthCountsMatch =
    base.finalState.birthEvents.length ===
    refined.finalState.birthEvents.length;
  const commonBirths = Math.min(
    base.finalState.birthEvents.length,
    refined.finalState.birthEvents.length,
  );
  let birthOrdinalsMatch = birthCountsMatch;
  let maximumBirthTimeDifference = 0;
  for (let index = 0; index < commonBirths; index += 1) {
    const baseEvent = base.finalState.birthEvents[index]!;
    const refinedEvent = refined.finalState.birthEvents[index]!;
    birthOrdinalsMatch &&= baseEvent.ordinal === refinedEvent.ordinal;
    maximumBirthTimeDifference = Math.max(
      maximumBirthTimeDifference,
      Math.abs(baseEvent.time - refinedEvent.time),
    );
  }
  const maximumMatchedLoopOffsetDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.matchedLoopOffsetDifference),
  );
  const maximumContinuousDifference = Math.max(
    0,
    ...checkpoints.map((checkpoint) => checkpoint.maximumContinuousDifference),
  );
  const maximumLedgerResidual = Math.max(
    base.finalState.maximumEnergyRelativeResidual,
    refined.finalState.maximumEnergyRelativeResidual,
    base.finalState.maximumRasterGeometryRelativeError,
    refined.finalState.maximumRasterGeometryRelativeError,
    ...checkpoints.map((checkpoint) => checkpoint.maximumLedgerResidual),
  );
  const alignedPhysicalTimes =
    checkpoints.length === CHECKPOINT_COUNT &&
    base.checkpoints.length === CHECKPOINT_COUNT &&
    refined.checkpoints.length === CHECKPOINT_COUNT &&
    checkpoints.every(
      (checkpoint, index) =>
        checkpoint.base.step === protocol.base.checkpointSteps[index] &&
        checkpoint.refined.step === protocol.refined.checkpointSteps[index] &&
        checkpoint.timeDifference <= protocol.gates.maximumTimeAlignmentError,
    );
  const finite =
    finiteState(base.finalState) &&
    finiteState(refined.finalState) &&
    base.checkpoints.every(finiteCheckpoint) &&
    refined.checkpoints.every(finiteCheckpoint);
  const strictTopology = strictArmTopology(base) && strictArmTopology(refined);
  const birthOrderingMatches =
    orderedBirths(base.finalState) &&
    orderedBirths(refined.finalState) &&
    birthOrdinalsMatch;
  const completionOrderingMatches =
    monotoneCompletions(base.checkpoints) &&
    monotoneCompletions(refined.checkpoints);
  const discreteCheckpointsPass = checkpoints.every(
    (checkpoint) =>
      checkpoint.emittedLayerDifference <=
        protocol.gates.maximumDiscreteTerraceDifference &&
      checkpoint.completedLayerDifference <=
        protocol.gates.maximumDiscreteTerraceDifference &&
      checkpoint.activeTerraceDifference <=
        protocol.gates.maximumDiscreteTerraceDifference &&
      checkpoint.resolvedTerraceDifference <=
        protocol.gates.maximumDiscreteTerraceDifference &&
      checkpoint.openingDepthDifference <=
        protocol.gates.maximumOpeningDepthDifferenceInSteps *
          base.finalState.configuration.stepHeight,
  );
  const finalCheckpoint = checkpoints.at(-1);
  const finalTopologyMatches =
    finalStateMatchesCheckpoint(base) &&
    finalStateMatchesCheckpoint(refined) &&
    base.finalState.emittedLayers === refined.finalState.emittedLayers &&
    base.finalState.completedLayers === refined.finalState.completedLayers &&
    base.finalState.activeLoopOffsets.length ===
      refined.finalState.activeLoopOffsets.length &&
    finalCheckpoint !== undefined &&
    finalCheckpoint.emittedLayerDifference === 0 &&
    finalCheckpoint.completedLayerDifference === 0 &&
    finalCheckpoint.activeTerraceDifference === 0 &&
    finalCheckpoint.resolvedTerraceDifference === 0 &&
    finalCheckpoint.openingDepthDifference === 0;
  const geometry = spaceGeometryProtocol(base.finalState, refined.finalState);
  const gates: Candidate2CFacetedMorphologySpaceRefinementGates = {
    configurationFrozen: spaceConfigurationMatchesProtocol(
      base.finalState,
      refined.finalState,
    ),
    physicalDomainPreserved: geometry.physicalDomainPreserved,
    sourceGeometryRefined: geometry.sourceGeometryRefined,
    alignedPhysicalTimes,
    finite,
    strictTopology,
    birthOrderingMatches,
    completionOrderingMatches,
    discreteCheckpointsPass,
    finalTopologyMatches,
    layerPhasePasses:
      maximumLayerPhaseDifference <= protocol.gates.maximumLayerPhaseDifference,
    birthTimesPass:
      maximumBirthTimeDifference <= protocol.gates.maximumBirthTimeDifference,
    loopOffsetsPass:
      maximumMatchedLoopOffsetDifference <=
      protocol.gates.maximumMatchedLoopOffsetDifference,
    continuousStatePasses:
      maximumContinuousDifference <= protocol.gates.maximumContinuousDifference,
    ledgersClose: maximumLedgerResidual <= protocol.gates.maximumLedgerResidual,
    classificationsHold:
      baseClassification === 'hopper-mechanism-candidate' &&
      refinedClassification === 'hopper-mechanism-candidate',
  };
  const firstFailedCheckpoint = checkpoints.find(
    (checkpoint) =>
      checkpoint.timeDifference > protocol.gates.maximumTimeAlignmentError ||
      checkpoint.emittedLayerDifference >
        protocol.gates.maximumDiscreteTerraceDifference ||
      checkpoint.completedLayerDifference >
        protocol.gates.maximumDiscreteTerraceDifference ||
      checkpoint.activeTerraceDifference >
        protocol.gates.maximumDiscreteTerraceDifference ||
      checkpoint.resolvedTerraceDifference >
        protocol.gates.maximumDiscreteTerraceDifference ||
      checkpoint.openingDepthDifference >
        protocol.gates.maximumOpeningDepthDifferenceInSteps *
          base.finalState.configuration.stepHeight ||
      checkpoint.layerPhaseDifference >
        protocol.gates.maximumLayerPhaseDifference ||
      checkpoint.matchedLoopOffsetDifference >
        protocol.gates.maximumMatchedLoopOffsetDifference ||
      checkpoint.maximumContinuousDifference >
        protocol.gates.maximumContinuousDifference ||
      checkpoint.maximumLedgerResidual > protocol.gates.maximumLedgerResidual,
  );
  return {
    passes: Object.values(gates).every(Boolean),
    baseClassification,
    refinedClassification,
    checkpoints,
    maximumTimeDifference,
    maximumLayerPhaseDifference,
    maximumBirthTimeDifference,
    maximumMatchedLoopOffsetDifference,
    maximumContinuousDifference,
    maximumLedgerResidual,
    firstFailedCheckpointIndex: firstFailedCheckpoint?.index ?? null,
    gates,
  };
}

function runArm(
  configuration: Candidate2CFacetedThermalConfiguration,
  plan: Candidate2CFacetedMorphologyRefinementPlan,
  retainCarrierStates: boolean,
): {
  readonly result: Candidate2CFacetedThermalArmResult;
  readonly carrierStates: readonly Candidate2CFacetedMorphologyState[];
} {
  let state = createCandidate2CFacetedThermalState(configuration);
  const checkpoints = [measureCandidate2CFacetedThermalCheckpoint(state)];
  const carrierStates = retainCarrierStates
    ? [projectCandidate2CFacetedMorphologyState(state)]
    : [];
  for (let index = 1; index < plan.checkpointSteps.length; index += 1) {
    const targetStep = plan.checkpointSteps[index] ?? Number.NaN;
    state = runCandidate2CFacetedThermalSteps(state, targetStep - state.step);
    checkpoints.push(measureCandidate2CFacetedThermalCheckpoint(state));
    if (retainCarrierStates) {
      carrierStates.push(projectCandidate2CFacetedMorphologyState(state));
    }
  }
  return {
    result: { finalState: state, checkpoints },
    carrierStates,
  };
}

/**
 * Runs both authoritative CPU arms before returning the refined lightweight
 * carrier states that may be submitted to GPU extraction.
 */
export function runCandidate2CFacetedMorphologyTimeRefinement(): Candidate2CFacetedMorphologyRefinementExecution {
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT;
  const base = runArm(
    createCandidate2CFacetedMorphologyScreenConfiguration(),
    protocol.base,
    false,
  );
  const refined = runArm(
    createCandidate2CFacetedMorphologyTimeRefinedConfiguration(),
    protocol.refined,
    true,
  );
  return {
    comparison: compareCandidate2CFacetedMorphologyTimeRefinement(
      base.result,
      refined.result,
    ),
    baseResult: base.result,
    refinedResult: refined.result,
    refinedCarrierStates: refined.carrierStates,
  };
}

export function runCandidate2CFacetedMorphologySpaceRefinement(
  baseResult?: Candidate2CFacetedThermalArmResult,
): Candidate2CFacetedMorphologySpaceRefinementExecution {
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT;
  const base =
    baseResult ??
    runArm(
      createCandidate2CFacetedMorphologyScreenConfiguration(),
      protocol.base,
      false,
    ).result;
  const refined = runArm(
    createCandidate2CFacetedMorphologySpaceRefinedConfiguration(),
    protocol.refined,
    true,
  );
  return {
    comparison: compareCandidate2CFacetedMorphologySpaceRefinement(
      base,
      refined.result,
    ),
    refinedResult: refined.result,
    refinedCarrierStates: refined.carrierStates,
  };
}

async function runArmYielding(
  configuration: Candidate2CFacetedThermalConfiguration,
  plan: Candidate2CFacetedMorphologyRefinementPlan,
  retainCarrierStates: boolean,
  yieldBetweenCheckpoints: () => Promise<void>,
): Promise<{
  readonly result: Candidate2CFacetedThermalArmResult;
  readonly carrierStates: readonly Candidate2CFacetedMorphologyState[];
}> {
  let state = createCandidate2CFacetedThermalState(configuration);
  const checkpoints = [measureCandidate2CFacetedThermalCheckpoint(state)];
  const carrierStates = retainCarrierStates
    ? [projectCandidate2CFacetedMorphologyState(state)]
    : [];
  for (let index = 1; index < plan.checkpointSteps.length; index += 1) {
    const targetStep = plan.checkpointSteps[index] ?? Number.NaN;
    state = runCandidate2CFacetedThermalSteps(state, targetStep - state.step);
    checkpoints.push(measureCandidate2CFacetedThermalCheckpoint(state));
    if (retainCarrierStates) {
      carrierStates.push(projectCandidate2CFacetedMorphologyState(state));
    }
    await yieldBetweenCheckpoints();
  }
  return {
    result: { finalState: state, checkpoints },
    carrierStates,
  };
}

/** Browser-friendly form of the same fixed run; numerical work is unchanged. */
export async function runCandidate2CFacetedMorphologyTimeRefinementYielding(
  yieldBetweenCheckpoints: () => Promise<void>,
): Promise<Candidate2CFacetedMorphologyRefinementExecution> {
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_TIME_REFINEMENT;
  const base = await runArmYielding(
    createCandidate2CFacetedMorphologyScreenConfiguration(),
    protocol.base,
    false,
    yieldBetweenCheckpoints,
  );
  const refined = await runArmYielding(
    createCandidate2CFacetedMorphologyTimeRefinedConfiguration(),
    protocol.refined,
    true,
    yieldBetweenCheckpoints,
  );
  return {
    comparison: compareCandidate2CFacetedMorphologyTimeRefinement(
      base.result,
      refined.result,
    ),
    baseResult: base.result,
    refinedResult: refined.result,
    refinedCarrierStates: refined.carrierStates,
  };
}

/** Runs the fixed half-spacing arm after the base/time gate has passed. */
export async function runCandidate2CFacetedMorphologySpaceRefinementYielding(
  baseResult: Candidate2CFacetedThermalArmResult,
  yieldBetweenCheckpoints: () => Promise<void>,
): Promise<Candidate2CFacetedMorphologySpaceRefinementExecution> {
  const protocol = CANDIDATE2C_FACETED_MORPHOLOGY_SPACE_REFINEMENT;
  const refined = await runArmYielding(
    createCandidate2CFacetedMorphologySpaceRefinedConfiguration(),
    protocol.refined,
    true,
    yieldBetweenCheckpoints,
  );
  return {
    comparison: compareCandidate2CFacetedMorphologySpaceRefinement(
      baseResult,
      refined.result,
    ),
    refinedResult: refined.result,
    refinedCarrierStates: refined.carrierStates,
  };
}
