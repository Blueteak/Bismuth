import { create } from 'zustand';

export type QualityLevel = 'preview' | 'standard' | 'high';

export interface CrystalSettings {
  version: number;
  seed: string;
  nucleationCount: number;
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
  oxideIntensity: number;
  iridescenceThicknessRange: number;
  surfaceRoughness: number;
  scratchDetailStrength: number;
  environmentIntensity: number;
  quality: QualityLevel;
}

export type GenerationStatus = 'idle' | 'preview-ready' | 'generating';

interface AppState {
  settings: CrystalSettings;
  generationStatus: GenerationStatus;
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
  nucleationCount: 1,
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

export const useAppStore = create<AppState>((set) => ({
  settings: defaultSettings,
  generationStatus: 'preview-ready',
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
  regeneratePreview: () =>
    set((state) => ({
      generationStatus: 'preview-ready',
      settings: {
        ...state.settings,
      },
    })),
  setTurntableEnabled: (enabled) => set({ isTurntableEnabled: enabled }),
}));
