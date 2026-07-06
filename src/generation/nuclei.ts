import type { SeededPrng } from './prng';
import type { GenerationSettings } from './types';
import type { NucleusPlan, SpiralSource } from './internalTypes';

export function createNuclei(
  settings: GenerationSettings,
  prng: SeededPrng,
  baseLayers: number,
  maxRadius: number,
) {
  const nuclei: NucleusPlan[] = [];
  const spacing = Math.max(
    5,
    Math.round(maxRadius * (1.25 + (1 - settings.symmetryBias) * 0.42) + settings.crystalScale),
  );
  const verticalRange = Math.round(baseLayers * settings.nucleiVerticalSpread * 0.62);
  const delayRange = Math.round(baseLayers * 74 * settings.nucleusStartDelay);
  const clusterRadiusScale = 1 / (1 + Math.max(0, settings.nucleationCount - 1) * 0.08);

  for (let index = 0; index < settings.nucleationCount; index += 1) {
    const ring = Math.floor(index / 4);
    const axis = index % 4;
    const angle =
      axis * (Math.PI / 2) +
      prng.signed((1 - settings.symmetryBias) * 0.95 + settings.impurity * 0.25);
    const radius =
      index === 0
        ? Math.round(settings.nucleiVerticalSpread * prng.next() * 2)
        : spacing + ring * 2 + Math.round(prng.signed(settings.impurity * 2));
    const x = Math.round(Math.cos(angle) * radius + prng.signed(settings.impurity * 1.5));
    const z = Math.round(Math.sin(angle) * radius + prng.signed(settings.impurity * 1.5));
    const y = Math.round(prng.next() * verticalRange);
    const layers = Math.max(
      4,
      Math.round(baseLayers * (0.82 + settings.coolingRate * 0.35 + prng.signed(0.08))),
    );
    const baseRadius = 1 + Math.round(settings.initialSeedSize * 2);
    const radiusBoost = settings.edgeGrowthBias * 3 + settings.crystalScale * 2;
    const nucleusMaxRadius = Math.round((maxRadius + radiusBoost) * clusterRadiusScale);
    const nucleusHandedness = prng.pickSign();
    const spiralPitch = 0.16 + prng.next() * 0.34 + settings.terraceHeight * 0.18;

    nuclei.push({
      id: index + 1,
      origin: [x, y, z],
      orientation: prng.nextInt(0, 3) as 0 | 1 | 2 | 3,
      layers,
      baseRadius,
      maxRadius: Math.max(baseRadius + 2, nucleusMaxRadius),
      isBranch: false,
      impurityOffset: prng.next(),
      startDelay: Math.round(prng.next() * delayRange),
      handedness: nucleusHandedness,
      spiralPitch,
      lateralDrift: [
        prng.signed((1 - settings.symmetryBias) * 1.7 + settings.impurity),
        prng.signed((1 - settings.symmetryBias) * 1.7 + settings.impurity),
      ],
      asymmetry: [
        prng.signed((1 - settings.symmetryBias) * 1.8 + settings.impurity),
        prng.signed((1 - settings.symmetryBias) * 1.8 + settings.impurity),
        prng.signed((1 - settings.symmetryBias) * 1.8 + settings.impurity),
        prng.signed((1 - settings.symmetryBias) * 1.8 + settings.impurity),
      ],
      spiralSources: createSpiralSources({
        baseRadius,
        handedness: nucleusHandedness,
        maxRadius: Math.max(baseRadius + 2, nucleusMaxRadius),
        prng,
        settings,
        spiralPitch,
      }),
    });
  }

  const branchAttempts = Math.round(
    settings.nucleationCount * settings.branchingProbability * (1 + settings.coolingRate),
  );
  for (let branchIndex = 0; branchIndex < branchAttempts; branchIndex += 1) {
    if (prng.next() > settings.branchingProbability + settings.coolingRate * 0.16) {
      continue;
    }

    const parent = nuclei[prng.nextInt(0, nuclei.length - 1)];
    const directionX = prng.pickSign();
    const directionZ = prng.pickSign();
    const branchRadius = Math.max(3, Math.round(parent.maxRadius * 0.58));

    nuclei.push({
      id: nuclei.length + 1,
      origin: [
        parent.origin[0] + directionX * Math.round(parent.maxRadius * 0.82),
        parent.origin[1] + prng.nextInt(1, Math.max(3, Math.round(verticalRange * 0.5) + 2)),
        parent.origin[2] + directionZ * Math.round(parent.maxRadius * 0.82),
      ],
      orientation: ((parent.orientation + prng.nextInt(1, 3)) % 4) as 0 | 1 | 2 | 3,
      layers: Math.max(4, Math.round(parent.layers * (0.45 + prng.next() * 0.25))),
      baseRadius: Math.max(1, parent.baseRadius - 1),
      maxRadius: branchRadius,
      isBranch: true,
      impurityOffset: prng.next(),
      startDelay:
        parent.startDelay +
        Math.round(parent.layers * (28 + settings.nucleusStartDelay * 48) * (0.35 + prng.next())),
      handedness: prng.pickSign(),
      spiralPitch: parent.spiralPitch * (0.78 + prng.next() * 0.38),
      lateralDrift: [
        parent.lateralDrift[0] + prng.signed(settings.impurity + 0.45),
        parent.lateralDrift[1] + prng.signed(settings.impurity + 0.45),
      ],
      asymmetry: [
        parent.asymmetry[0] + prng.signed(0.75),
        parent.asymmetry[1] + prng.signed(0.75),
        parent.asymmetry[2] + prng.signed(0.75),
        parent.asymmetry[3] + prng.signed(0.75),
      ],
      spiralSources: parent.spiralSources.map((source) => ({
        offset: [
          source.offset[0] + Math.round(prng.signed(2)),
          source.offset[1] + Math.round(prng.signed(2)),
        ],
        handedness: prng.next() < 0.78 ? source.handedness : prng.pickSign(),
        phase: (source.phase + prng.signed(0.18) + 1) % 1,
        spacing: Math.max(3, Math.round(source.spacing * (0.82 + prng.next() * 0.3))),
        layerDrift: source.layerDrift * (0.82 + prng.next() * 0.34),
        strength: source.strength * (0.72 + prng.next() * 0.28),
      })),
    });
  }

  return nuclei;
}

function createSpiralSources({
  baseRadius,
  handedness,
  maxRadius,
  prng,
  settings,
  spiralPitch,
}: {
  baseRadius: number;
  handedness: -1 | 1;
  maxRadius: number;
  prng: SeededPrng;
  settings: GenerationSettings;
  spiralPitch: number;
}) {
  const sourceCount =
    maxRadius > 18 && prng.next() < 0.45 + settings.impurity * 0.2 ? 2 : 1;
  const sources: SpiralSource[] = [];

  for (let index = 0; index < sourceCount; index += 1) {
    const offsetMagnitude = index === 0 ? baseRadius : Math.max(baseRadius + 2, Math.round(maxRadius * 0.32));
    sources.push({
      offset: [
        Math.round(prng.signed(offsetMagnitude)),
        Math.round(prng.signed(offsetMagnitude)),
      ],
      handedness: index === 0 ? handedness : prng.pickSign(),
      phase: prng.next(),
      spacing: Math.max(4, Math.round(4 + settings.terraceHeight * 6 + settings.coolingRate * 3)),
      layerDrift: 0.025 + spiralPitch * 0.065 + settings.coolingRate * 0.018,
      strength: 0.86 + settings.edgeGrowthBias * 0.2 + prng.next() * 0.1,
    });
  }

  return sources;
}

