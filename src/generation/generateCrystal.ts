import { stepWeights, qualityPlan } from './constants';
import { createNuclei } from './nuclei';
import { planNucleusGrowth } from './growth';
import {
  createContactBarrierState,
  findDirectionalContacts,
  hasSameNucleusGrowthSupport,
  isBlockedByContactBarrier,
  isOccludedByCompetingFront,
  isOccludedByResolvedContact,
  pruneDirectionalOvergrowth,
  pruneUnsupportedBlocks,
  recordContactBarriers,
  resolveGrowthFrameAtContact,
  resolveOccupiedContact,
} from './contacts';
import { assignOxide, buildFacets, getOxideRange } from './surface';
import { applyDisplayTiming, chooseChunkStep, getChunkProgressDelta } from './timeline';
import { createSeededPrng, hashString } from './prng';
import { normalizeGenerationSettings, stableSettingsString } from './settings';
import {
  addBlockToSpatialIndex,
  chunkBlocks,
  cloneBounds,
  createEmptyBounds,
  createSpatialIndex,
  extendBounds,
  getNearbyBlocks,
  localCellKey,
} from './spatial';
import type { CandidateBlock } from './internalTypes';
import type { CrystalBlock, GenerationEvent, GenerationResult, GenerationSettings, GenerationStep } from './types';

export function generateCrystal(settings: GenerationSettings): GenerationResult {
  const normalized = normalizeGenerationSettings(settings);
  const settingsKey = stableSettingsString(normalized);
  const settingsHash = hashString(settingsKey);
  const prng = createSeededPrng(settingsKey);
  const plan = qualityPlan[normalized.quality];
  const events: GenerationEvent[] = [];
  const blocks: CrystalBlock[] = [];
  const occupied = createSpatialIndex();
  const localOccupied = new Map<string, CrystalBlock>();
  let eventProgress = 0;
  let blockId = 1;
  const contactBarriers = createContactBarrierState();

  const nuclei = createNuclei(normalized, prng, plan.layers, plan.maxRadius);
  const nucleiById = new Map(nuclei.map((nucleus) => [nucleus.id, nucleus]));
  const bounds = createEmptyBounds();

  const emit = (
    step: GenerationStep,
    progressDelta: number,
    message?: string,
    chunk?: CrystalBlock[],
  ) => {
    eventProgress = Math.min(0.995, eventProgress + progressDelta);
    events.push({
      step,
      progress: Number(eventProgress.toFixed(4)),
      message,
      ...(chunk?.length
        ? {
            chunk: { blocks: chunk },
            preview: {
              blockCount: blocks.length,
              bounds: cloneBounds(bounds),
            },
          }
        : {}),
    });
  };

  emit('seed', stepWeights.seed, 'Seeded PRNG initialized');
  emit('nucleation', stepWeights.nucleation, `${nuclei.length} nuclei placed`);

  const candidateBlocks: CandidateBlock[] = [];
  let candidateOrder = 1;
  for (const nucleus of nuclei) {
    const nucleusBlocks = planNucleusGrowth({
      nucleus,
      settings: normalized,
      prng,
      nextCandidateOrder: () => candidateOrder++,
    });

    candidateBlocks.push(...nucleusBlocks);
  }

  candidateBlocks.sort((a, b) => a.age - b.age || a.plannedOrder - b.plannedOrder);

  let stagedBlocks: CrystalBlock[] = [];
  for (const candidate of candidateBlocks) {
    const nucleus = nucleiById.get(candidate.nucleusId);
    if (!nucleus) {
      continue;
    }

    const occupyingBlock = getNearbyBlocks(
      occupied,
      [candidate.x, candidate.y, candidate.z],
      0.62,
    ).sort((a, b) => a.id - b.id)[0];
    if (occupyingBlock) {
      resolveOccupiedContact(occupyingBlock, candidate);
      continue;
    }

    if (isOccludedByCompetingFront(candidate, nucleus, nuclei, normalized)) {
      continue;
    }

    if (isBlockedByContactBarrier(candidate, contactBarriers)) {
      continue;
    }

    if (!hasSameNucleusGrowthSupport(candidate, localOccupied)) {
      continue;
    }

    const contacts = findDirectionalContacts(candidate, occupied);
    if (isOccludedByResolvedContact(candidate, contacts, localOccupied)) {
      continue;
    }
    const growth = resolveGrowthFrameAtContact(candidate, contacts);

    const block = {
      id: blockId++,
      nucleusId: candidate.nucleusId,
      x: candidate.x,
      y: candidate.y,
      z: candidate.z,
      local: candidate.local,
      basis: candidate.basis,
      size: candidate.size,
      stage: candidate.stage,
      age: Math.round(candidate.age + growth.contactStress * 42),
      growth,
      oxideThickness: 0,
    };

    addBlockToSpatialIndex(occupied, block);
    localOccupied.set(localCellKey(block.nucleusId, block.local), block);
    recordContactBarriers(block, contacts, contactBarriers);
    stagedBlocks.push(block);
  }

  stagedBlocks = pruneDirectionalOvergrowth(stagedBlocks);
  stagedBlocks = pruneUnsupportedBlocks(stagedBlocks);

  for (const chunk of chunkBlocks(stagedBlocks, plan.chunkSize)) {
    for (const block of chunk) {
      blocks.push(block);
      extendBounds(bounds, block);
    }

    const stage = chooseChunkStep(chunk);
    const chunkProgress = getChunkProgressDelta(stage, stagedBlocks.length, chunk.length);
    emit(stage, chunkProgress, undefined, chunk);
  }

  assignOxide(blocks, normalized, prng);
  emit('oxidation', stepWeights.oxidation, 'Oxide thickness assigned');

  const facets = buildFacets(blocks);
  emit('mesh-build', stepWeights['mesh-build'], 'Renderable block model built');

  const oxideRange = getOxideRange(blocks);
  const model = {
    settingsHash,
    bounds: cloneBounds(bounds),
    facets,
    blocks,
    oxideRange,
    stats: {
      generationMs: plan.minDisplayMs,
      blockCount: blocks.length,
      facetCount: facets.length,
      triangleCountEstimate: facets.length * 2,
    },
  };

  events.push({
    step: 'complete',
    progress: 1,
    message: 'Crystal model ready',
    preview: {
      blockCount: blocks.length,
      bounds: cloneBounds(bounds),
    },
  });

  applyDisplayTiming(events, plan.minDisplayMs);

  return { model, events };
}
