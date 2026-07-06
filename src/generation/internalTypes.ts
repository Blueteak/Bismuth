import type { CrystalBlockStage, CrystalGrowthFrame } from './types';

export interface SpiralSource {
  offset: [number, number];
  handedness: -1 | 1;
  phase: number;
  spacing: number;
  layerDrift: number;
  strength: number;
}

export interface NucleusPlan {
  id: number;
  origin: [number, number, number];
  orientation: 0 | 1 | 2 | 3;
  layers: number;
  baseRadius: number;
  maxRadius: number;
  isBranch: boolean;
  impurityOffset: number;
  startDelay: number;
  handedness: -1 | 1;
  spiralPitch: number;
  lateralDrift: [number, number];
  asymmetry: [number, number, number, number];
  spiralSources: SpiralSource[];
}

export interface CandidateBlock {
  plannedOrder: number;
  nucleusId: number;
  x: number;
  y: number;
  z: number;
  size: number;
  stage: CrystalBlockStage;
  age: number;
  growth: CrystalGrowthFrame;
}

export interface LayerExtents {
  posX: number;
  negX: number;
  posZ: number;
  negZ: number;
}

export interface SquareSpiralInfluence {
  band: number;
  coreRecess: number;
  phase: number;
  isStep: boolean;
  strength: number;
}

