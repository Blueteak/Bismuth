import type { GenerationStep } from './types';

export const stepWeights: Record<GenerationStep, number> = {
  seed: 0.03,
  nucleation: 0.08,
  'edge-growth': 0.42,
  'face-fill': 0.16,
  terrace: 0.1,
  branch: 0.07,
  oxidation: 0.08,
  'mesh-build': 0.04,
  complete: 0.02,
};

export const qualityPlan = {
  preview: { layers: 25, maxRadius: 16, chunkSize: 140, minDisplayMs: 2600 },
  standard: { layers: 38, maxRadius: 22, chunkSize: 220, minDisplayMs: 4200 },
  high: { layers: 50, maxRadius: 29, chunkSize: 280, minDisplayMs: 5600 },
} as const;

