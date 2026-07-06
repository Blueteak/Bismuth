export type QualityLevel = 'preview' | 'standard' | 'high';

export type GenerationStep =
  | 'seed'
  | 'nucleation'
  | 'edge-growth'
  | 'face-fill'
  | 'terrace'
  | 'branch'
  | 'oxidation'
  | 'mesh-build'
  | 'complete';

export interface GenerationSettings {
  version: number;
  seed: string;
  nucleationCount: number;
  nucleusStartDelay: number;
  nucleiVerticalSpread: number;
  initialSeedSize: number;
  crystalScale: number;
  symmetryBias: number;
  coolingRate: number;
  edgeGrowthBias: number;
  faceFillRate: number;
  terraceHeight: number;
  hopperDepth: number;
  branchingProbability: number;
  impurity: number;
  gravitySagBias: number;
  oxidationExposure: number;
  quality: QualityLevel;
}

export interface Bounds3 {
  min: [number, number, number];
  max: [number, number, number];
}

export type CrystalBlockStage =
  | 'seed'
  | 'edge'
  | 'face'
  | 'terrace'
  | 'branch';

export interface CrystalBlock {
  id: number;
  nucleusId: number;
  x: number;
  y: number;
  z: number;
  size: number;
  stage: CrystalBlockStage;
  age: number;
  oxideThickness: number;
}

export interface CrystalFacet {
  id: number;
  blockId: number;
  normal: [number, number, number];
  center: [number, number, number];
  oxideThickness: number;
  area: number;
}

export interface PackedMesh {
  positions: number[];
  normals: number[];
  indices: number[];
  oxideThickness: number[];
}

export interface CrystalModel {
  settingsHash: string;
  bounds: Bounds3;
  facets: CrystalFacet[];
  blocks: CrystalBlock[];
  mesh?: PackedMesh;
  oxideRange: [number, number];
  stats: {
    generationMs: number;
    blockCount: number;
    facetCount: number;
    triangleCountEstimate: number;
  };
}

export interface CrystalChunkPayload {
  blocks: CrystalBlock[];
}

export interface CrystalPreviewPayload {
  blockCount: number;
  bounds: Bounds3;
}

export interface GenerationEvent {
  step: GenerationStep;
  progress: number;
  message?: string;
  preview?: CrystalPreviewPayload;
  chunk?: CrystalChunkPayload;
  displayTimeMs?: number;
}

export interface GenerationResult {
  model: CrystalModel;
  events: GenerationEvent[];
}
