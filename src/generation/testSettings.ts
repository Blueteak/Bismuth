import type { GenerationSettings } from './types';

export const baseGenerationSettings: GenerationSettings = {
  version: 1,
  seed: 'BI-TEST-001',
  nucleationCount: 2,
  nucleusStartDelay: 0.18,
  nucleiVerticalSpread: 0.28,
  initialSeedSize: 0.42,
  crystalScale: 1,
  symmetryBias: 0.72,
  coolingRate: 0.58,
  edgeGrowthBias: 0.74,
  faceFillRate: 0.34,
  terraceHeight: 0.46,
  hopperDepth: 0.68,
  branchingProbability: 0.18,
  impurity: 0.24,
  gravitySagBias: 0.12,
  oxidationExposure: 0.82,
  quality: 'standard',
};
