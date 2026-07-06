import { create } from 'zustand';
import type {
  CrystalBlock,
  CrystalModel,
  GenerationEvent,
  GenerationSettings,
  GenerationStep,
  QualityLevel,
} from '../generation/types';
import { startCrystalGeneration } from '../workers/crystalWorkerClient';

export type { QualityLevel };

export interface CrystalSettings extends GenerationSettings {
  oxideIntensity: number;
  iridescenceThicknessRange: number;
  surfaceRoughness: number;
  scratchDetailStrength: number;
  environmentIntensity: number;
  quality: QualityLevel;
}

export type GenerationStatus = 'idle' | 'preview-ready' | 'generating' | 'error';

interface AppState {
  settings: CrystalSettings;
  generationStatus: GenerationStatus;
  generationProgress: number;
  generationStep: GenerationStep | 'idle';
  generationEvents: GenerationEvent[];
  previewBlocks: CrystalBlock[];
  crystalModel: CrystalModel | null;
  generationError: string | null;
  isTurntableEnabled: boolean;
  setSetting: <K extends keyof CrystalSettings>(
    key: K,
    value: CrystalSettings[K],
  ) => void;
  randomizeSeed: () => void;
  regeneratePreview: () => void;
  setTurntableEnabled: (enabled: boolean) => void;
}

export const defaultSettings: CrystalSettings = {
  version: 1,
  seed: 'BI-2026-0705',
  nucleationCount: 3,
  nucleusStartDelay: 0.12,
  nucleiVerticalSpread: 0.38,
  growthDirectionRandomness: 0.45,
  initialSeedSize: 0.42,
  crystalScale: 1,
  symmetryBias: 0.48,
  coolingRate: 0.58,
  edgeGrowthBias: 0.74,
  faceFillRate: 0.34,
  terraceHeight: 0.46,
  hopperDepth: 0.68,
  branchingProbability: 0.24,
  impurity: 0.34,
  gravitySagBias: 0.12,
  oxidationExposure: 0.82,
  oxideIntensity: 0.76,
  iridescenceThicknessRange: 0.65,
  surfaceRoughness: 0.38,
  scratchDetailStrength: 0.28,
  environmentIntensity: 0.86,
  quality: 'standard',
};

function makeSeed() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);

  const randomPart = (values[0] % 0xfffffff)
    .toString(16)
    .toUpperCase()
    .padStart(7, '0');

  return `BI-${randomPart}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: defaultSettings,
  generationStatus: 'idle',
  generationProgress: 0,
  generationStep: 'idle',
  generationEvents: [],
  previewBlocks: [],
  crystalModel: null,
  generationError: null,
  isTurntableEnabled: true,
  setSetting: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value,
      },
    })),
  randomizeSeed: () =>
    set((state) => ({
      settings: {
        ...state.settings,
        seed: makeSeed(),
      },
    })),
  regeneratePreview: () => {
    startCrystalGeneration(get().settings, {
      onStart: () =>
        set({
          generationStatus: 'generating',
          generationProgress: 0,
          generationStep: 'seed',
          generationEvents: [],
          previewBlocks: [],
          crystalModel: null,
          generationError: null,
        }),
      onEvent: (event) =>
        set((state) => ({
          generationProgress: event.progress,
          generationStep: event.step,
          generationEvents: [...state.generationEvents, event],
          previewBlocks: event.chunk?.blocks.length
            ? [...state.previewBlocks, ...event.chunk.blocks]
            : state.previewBlocks,
        })),
      onComplete: (model) =>
        set({
          generationStatus: 'preview-ready',
          generationProgress: 1,
          generationStep: 'complete',
          crystalModel: model,
        }),
      onError: (message) =>
        set({
          generationStatus: 'error',
          generationError: message,
        }),
    });
  },
  setTurntableEnabled: (enabled) => set({ isTurntableEnabled: enabled }),
}));
