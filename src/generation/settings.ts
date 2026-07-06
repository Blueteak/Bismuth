import type { GenerationSettings, QualityLevel } from './types';

const qualityValues = new Set<QualityLevel>(['preview', 'standard', 'high']);

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizedUnit(value: number, fallback: number) {
  return Number(clamp(finiteOr(value, fallback), 0, 1).toFixed(4));
}

export function normalizeGenerationSettings(
  settings: GenerationSettings,
): GenerationSettings {
  return {
    version: Math.max(1, Math.round(finiteOr(settings.version, 1))),
    seed: String(settings.seed || 'BI-DEFAULT').slice(0, 96),
    nucleationCount: Math.round(clamp(finiteOr(settings.nucleationCount, 1), 1, 8)),
    nucleusStartDelay: normalizedUnit(settings.nucleusStartDelay, 0.18),
    nucleiVerticalSpread: normalizedUnit(settings.nucleiVerticalSpread, 0.28),
    initialSeedSize: normalizedUnit(settings.initialSeedSize, 0.42),
    crystalScale: Number(clamp(finiteOr(settings.crystalScale, 1), 0.5, 1.6).toFixed(4)),
    symmetryBias: normalizedUnit(settings.symmetryBias, 0.72),
    coolingRate: normalizedUnit(settings.coolingRate, 0.58),
    edgeGrowthBias: normalizedUnit(settings.edgeGrowthBias, 0.74),
    faceFillRate: normalizedUnit(settings.faceFillRate, 0.34),
    terraceHeight: normalizedUnit(settings.terraceHeight, 0.46),
    hopperDepth: normalizedUnit(settings.hopperDepth, 0.68),
    branchingProbability: normalizedUnit(settings.branchingProbability, 0.18),
    impurity: normalizedUnit(settings.impurity, 0.24),
    gravitySagBias: normalizedUnit(settings.gravitySagBias, 0.12),
    oxidationExposure: normalizedUnit(settings.oxidationExposure, 0.82),
    quality: qualityValues.has(settings.quality) ? settings.quality : 'standard',
  };
}

export function stableSettingsString(settings: GenerationSettings) {
  const normalized = normalizeGenerationSettings(settings);

  return [
    `version:${normalized.version}`,
    `seed:${normalized.seed}`,
    `nucleationCount:${normalized.nucleationCount}`,
    `nucleusStartDelay:${normalized.nucleusStartDelay}`,
    `nucleiVerticalSpread:${normalized.nucleiVerticalSpread}`,
    `initialSeedSize:${normalized.initialSeedSize}`,
    `crystalScale:${normalized.crystalScale}`,
    `symmetryBias:${normalized.symmetryBias}`,
    `coolingRate:${normalized.coolingRate}`,
    `edgeGrowthBias:${normalized.edgeGrowthBias}`,
    `faceFillRate:${normalized.faceFillRate}`,
    `terraceHeight:${normalized.terraceHeight}`,
    `hopperDepth:${normalized.hopperDepth}`,
    `branchingProbability:${normalized.branchingProbability}`,
    `impurity:${normalized.impurity}`,
    `gravitySagBias:${normalized.gravitySagBias}`,
    `oxidationExposure:${normalized.oxidationExposure}`,
    `quality:${normalized.quality}`,
  ].join('|');
}
