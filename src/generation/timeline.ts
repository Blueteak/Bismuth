import { stepWeights } from './constants';
import type { CrystalBlock, CrystalBlockStage, GenerationEvent, GenerationStep } from './types';

export function chooseChunkStep(chunk: CrystalBlock[]): GenerationStep {
  const counts = new Map<CrystalBlockStage, number>();
  for (const block of chunk) {
    counts.set(block.stage, (counts.get(block.stage) ?? 0) + 1);
  }

  const topStage = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topStage === 'branch') {
    return 'branch';
  }
  if (topStage === 'face') {
    return 'face-fill';
  }
  if (topStage === 'terrace') {
    return 'terrace';
  }

  return 'edge-growth';
}

export function getChunkProgressDelta(
  step: GenerationStep,
  totalBlockCount: number,
  chunkBlockCount: number,
) {
  const blockShare = chunkBlockCount / Math.max(1, totalBlockCount);
  const growthBudget =
    stepWeights['edge-growth'] +
    stepWeights['face-fill'] +
    stepWeights.terrace +
    stepWeights.branch;
  const stepBias = stepWeights[step] / growthBudget;

  return blockShare * growthBudget * (0.72 + stepBias * 0.28);
}

export function applyDisplayTiming(events: GenerationEvent[], minDisplayMs: number) {
  const totalWeight = events.reduce((sum, event) => sum + stepWeights[event.step], 0);
  let elapsed = 0;

  for (const event of events) {
    const weight = stepWeights[event.step] / totalWeight;
    elapsed += Math.max(24, minDisplayMs * weight);
    event.displayTimeMs = Math.round(Math.min(minDisplayMs, elapsed));
  }

  events[events.length - 1].displayTimeMs = minDisplayMs;
}
