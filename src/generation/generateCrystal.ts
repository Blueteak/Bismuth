import { createSeededPrng, hashString, type SeededPrng } from './prng';
import { normalizeGenerationSettings, stableSettingsString } from './settings';
import type {
  Bounds3,
  CrystalBlock,
  CrystalBlockStage,
  CrystalFacet,
  GenerationEvent,
  GenerationResult,
  GenerationSettings,
  GenerationStep,
} from './types';

interface NucleusPlan {
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

interface CandidateBlock {
  plannedOrder: number;
  nucleusId: number;
  x: number;
  y: number;
  z: number;
  size: number;
  stage: CrystalBlockStage;
  age: number;
}

interface SpiralSource {
  offset: [number, number];
  handedness: -1 | 1;
  phase: number;
  spacing: number;
  layerDrift: number;
  strength: number;
}

type CollisionAxis = 'x' | 'z';

interface CollisionBoundary {
  axis: CollisionAxis;
  sign: -1 | 1;
  value: number;
}

const stepWeights: Record<GenerationStep, number> = {
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

const qualityPlan = {
  preview: { layers: 25, maxRadius: 16, chunkSize: 140, minDisplayMs: 2600 },
  standard: { layers: 38, maxRadius: 22, chunkSize: 220, minDisplayMs: 4200 },
  high: { layers: 50, maxRadius: 29, chunkSize: 280, minDisplayMs: 5600 },
} as const;

export function generateCrystal(settings: GenerationSettings): GenerationResult {
  const normalized = normalizeGenerationSettings(settings);
  const settingsKey = stableSettingsString(normalized);
  const settingsHash = hashString(settingsKey);
  const prng = createSeededPrng(settingsKey);
  const plan = qualityPlan[normalized.quality];
  const events: GenerationEvent[] = [];
  const blocks: CrystalBlock[] = [];
  let occupied = new Map<string, CrystalBlock>();
  const collisionBoundaries = new Map<number, CollisionBoundary[]>();
  let eventProgress = 0;
  let blockId = 1;

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
    if (!nucleus || isPastCollisionBoundary(candidate, collisionBoundaries.get(candidate.nucleusId))) {
      continue;
    }

    const key = cellKey(candidate.x, candidate.y, candidate.z);
    const occupyingBlock = occupied.get(key);
    if (occupyingBlock) {
      if (occupyingBlock.nucleusId !== candidate.nucleusId) {
        registerCollisionBoundary(collisionBoundaries, nucleus, candidate);

        const otherNucleus = nucleiById.get(occupyingBlock.nucleusId);
        if (otherNucleus) {
          registerCollisionBoundary(collisionBoundaries, otherNucleus, occupyingBlock);
        }
      }

      continue;
    }

    const collision = findCollision(candidate, occupied);
    if (collision) {
      registerCollisionBoundary(collisionBoundaries, nucleus, candidate);

      const otherNucleus = nucleiById.get(collision.nucleusId);
      if (otherNucleus) {
        registerCollisionBoundary(collisionBoundaries, otherNucleus, collision);
      }
    }

    const block = {
      id: blockId++,
      nucleusId: candidate.nucleusId,
      x: candidate.x,
      y: candidate.y,
      z: candidate.z,
      size: candidate.size,
      stage: candidate.stage,
      age: candidate.age,
      oxideThickness: 0,
    };

    occupied.set(key, block);
    stagedBlocks.push(block);
  }

  stagedBlocks = pruneUnsupportedBlocks(stagedBlocks);
  occupied = new Map(stagedBlocks.map((block) => [cellKey(block.x, block.y, block.z), block]));

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

  const occupiedCells = new Set(occupied.keys());
  const facets = buildFacets(blocks, occupiedCells);
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

function findCollision(candidate: CandidateBlock, occupied: Map<string, CrystalBlock>) {
  const offsets: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
    [1, 1, 0],
    [-1, 1, 0],
    [0, 1, 1],
    [0, 1, -1],
    [1, -1, 0],
    [-1, -1, 0],
    [0, -1, 1],
    [0, -1, -1],
  ];

  for (const [offsetX, offsetY, offsetZ] of offsets) {
    const block = occupied.get(
      cellKey(candidate.x + offsetX, candidate.y + offsetY, candidate.z + offsetZ),
    );

    if (block && block.nucleusId !== candidate.nucleusId) {
      return block;
    }
  }

  return null;
}

function registerCollisionBoundary(
  boundaries: Map<number, CollisionBoundary[]>,
  nucleus: NucleusPlan,
  block: Pick<CandidateBlock | CrystalBlock, 'nucleusId' | 'x' | 'z'>,
) {
  const deltaX = block.x - nucleus.origin[0];
  const deltaZ = block.z - nucleus.origin[2];
  const axis: CollisionAxis = Math.abs(deltaX) >= Math.abs(deltaZ) ? 'x' : 'z';
  const sign: -1 | 1 = (axis === 'x' ? deltaX : deltaZ) < 0 ? -1 : 1;
  const value = axis === 'x' ? block.x : block.z;
  const nucleusBoundaries = boundaries.get(block.nucleusId) ?? [];
  const matchingBoundary = nucleusBoundaries.find(
    (boundary) => boundary.axis === axis && boundary.sign === sign,
  );

  if (matchingBoundary) {
    matchingBoundary.value =
      sign > 0
        ? Math.min(matchingBoundary.value, value)
        : Math.max(matchingBoundary.value, value);
  } else {
    nucleusBoundaries.push({ axis, sign, value });
  }

  boundaries.set(block.nucleusId, nucleusBoundaries);
}

function isPastCollisionBoundary(
  candidate: CandidateBlock,
  boundaries: CollisionBoundary[] | undefined,
) {
  if (!boundaries) {
    return false;
  }

  return boundaries.some((boundary) => {
    const value = boundary.axis === 'x' ? candidate.x : candidate.z;

    return boundary.sign > 0 ? value > boundary.value : value < boundary.value;
  });
}

function pruneUnsupportedBlocks(blocks: CrystalBlock[]) {
  let keptBlocks = blocks;

  for (let pass = 0; pass < 96; pass += 1) {
    const occupied = new Map(keptBlocks.map((block) => [cellKey(block.x, block.y, block.z), block]));
    const maxYByNucleus = getMaxYByNucleus(keptBlocks);
    const nextBlocks = keptBlocks.filter((block) => {
      if (block.stage === 'seed') {
        return true;
      }

      const support = getSupportCounts(block, occupied);
      const isTerminalTop =
        block.y >= (maxYByNucleus.get(block.nucleusId) ?? block.y) - 2 && support.above === 0;

      if (support.total === 0) {
        return false;
      }

      if (support.horizontal === 0 && support.below === 0) {
        return false;
      }

      if (isTerminalTop && support.horizontal < 2) {
        return false;
      }

      return true;
    });

    if (nextBlocks.length === keptBlocks.length) {
      return keptBlocks;
    }

    keptBlocks = nextBlocks;
  }

  return keptBlocks;
}

function getMaxYByNucleus(blocks: CrystalBlock[]) {
  const maxYByNucleus = new Map<number, number>();

  for (const block of blocks) {
    maxYByNucleus.set(
      block.nucleusId,
      Math.max(maxYByNucleus.get(block.nucleusId) ?? Number.NEGATIVE_INFINITY, block.y),
    );
  }

  return maxYByNucleus;
}

function getSupportCounts(block: CrystalBlock, occupied: Map<string, CrystalBlock>) {
  const horizontalOffsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  let horizontal = 0;

  for (const [offsetX, offsetZ] of horizontalOffsets) {
    if (occupied.has(cellKey(block.x + offsetX, block.y, block.z + offsetZ))) {
      horizontal += 1;
    }
  }

  const below = occupied.has(cellKey(block.x, block.y - 1, block.z)) ? 1 : 0;
  const above = occupied.has(cellKey(block.x, block.y + 1, block.z)) ? 1 : 0;

  return {
    above,
    below,
    horizontal,
    total: above + below + horizontal,
  };
}

function createNuclei(
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

function planNucleusGrowth({
  nucleus,
  settings,
  prng,
  nextCandidateOrder,
}: {
  nucleus: NucleusPlan;
  settings: GenerationSettings;
  prng: SeededPrng;
  nextCandidateOrder: () => number;
}) {
  const blocks: CandidateBlock[] = [];

  for (let layer = 0; layer < nucleus.layers; layer += 1) {
    const layerRatio = layer / Math.max(1, nucleus.layers - 1);
    const terraceWave = Math.sin(
      (layer * (0.72 + settings.terraceHeight * 0.62) + nucleus.impurityOffset * 3) *
        Math.PI *
        0.5,
    );
    const terraceOffset = Math.round(terraceWave * settings.impurity * 2.15);
    const coolingExpansion = settings.coolingRate * layerRatio * 1.45;
    const growthRatio = Math.pow(layerRatio, 0.72 + settings.coolingRate * 0.18);
    const rawRadius =
      nucleus.baseRadius +
      growthRatio * (nucleus.maxRadius - nucleus.baseRadius) +
      coolingExpansion +
      terraceOffset;
    const outer = Math.max(1, Math.round(rawRadius));
    const layerStep = Math.floor(layer * (0.58 + settings.terraceHeight * 1.85));
    const terraceWidth = Math.max(
      1,
      Math.round(
        1 +
          settings.terraceHeight * 2 +
          settings.edgeGrowthBias * 1.5 +
          Math.abs(terraceWave) * settings.impurity,
      ),
    );
    const hollowRadius = Math.max(
      0,
      Math.floor(
        outer *
          (0.18 + settings.hopperDepth * 0.72) *
          (1 - settings.faceFillRate * 0.58) *
          (0.7 + layerRatio * 0.52),
      ),
    );
    const y = nucleus.origin[1] + layer;
    const sagShift = Math.round(settings.gravitySagBias * layerRatio * layer * 0.18);
    const spiralOffset = getSpiralOffset(nucleus, layer, layerRatio, settings);
    const centerDrift = getHopperCenterDrift(nucleus, layer, layerRatio, settings);
    const extents = getLayerExtents(outer, nucleus, layer, layerRatio, settings);

    for (let x = -extents.negX; x <= extents.posX; x += 1) {
      for (let z = -extents.negZ; z <= extents.posZ; z += 1) {
        const rotated = rotateCell(x, z, nucleus.orientation);
        const worldX = nucleus.origin[0] + rotated[0] + spiralOffset[0];
        const worldZ = nucleus.origin[2] + rotated[1] + sagShift + spiralOffset[1];
        const edgeDistance = getEdgeDistance(x, z, extents);
        const isEdge = edgeDistance < terraceWidth;
        const centerX = x - centerDrift[0];
        const centerZ = z - centerDrift[1];
        const isCenter = Math.abs(centerX) <= hollowRadius && Math.abs(centerZ) <= hollowRadius;
        const dislocationSpiral = getSquareSpiralInfluence(x, z, layer, nucleus, settings);
        const spiralBand = Math.max(getSpiralBand(x, z, layer, nucleus) * 0.28, dislocationSpiral.band);
        const radiusFromCenter = Math.max(Math.abs(centerX), Math.abs(centerZ));
        const cavityBias = 1 - Math.min(1, radiusFromCenter / Math.max(1, hollowRadius + 1));
        const terraceModulo = Math.max(2, Math.round(2 + settings.terraceHeight * 4));
        const edgeTerraceLead =
          !isCenter &&
          (edgeDistance % terraceModulo === 0 ||
            Math.abs((edgeDistance + layer) % terraceModulo) === 1);
        const isTerraceLead =
          edgeTerraceLead ||
          dislocationSpiral.isStep ||
          spiralBand > 0.78;
        const centerFillChance =
          settings.faceFillRate * (0.26 + layerRatio * 0.34) -
          settings.hopperDepth * (0.28 + cavityBias * 0.32) +
          spiralBand * 0.08 -
          dislocationSpiral.coreRecess * settings.hopperDepth * 0.24 +
          settings.impurity * (prng.next() - 0.5) * 0.2;
        const terraceChance = isTerraceLead
          ? 0.74 +
            settings.terraceHeight * 0.14 +
            settings.edgeGrowthBias * 0.08 +
            spiralBand * 0.16 +
            dislocationSpiral.band * dislocationSpiral.strength * 0.16 -
            (isCenter ? settings.hopperDepth * 0.18 : 0)
          : settings.faceFillRate * 0.06 + spiralBand * 0.02 - settings.hopperDepth * 0.1;
        const wallBreakChance =
          (1 - settings.symmetryBias) * 0.08 +
          settings.impurity * 0.12 +
          settings.coolingRate * 0.05 +
          (spiralBand < 0.24 ? 0.08 : 0) +
          layerRatio * 0.06;
        const outerRimBreakChance =
          edgeDistance === 0 && spiralBand < 0.36 && !isCornerCell(x, z, extents)
            ? (1 - settings.symmetryBias) * 0.14 + settings.impurity * 0.1
            : 0;

        if (!isEdge && isCenter && prng.next() > centerFillChance) {
          continue;
        }

        if (!isEdge && !isTerraceLead && prng.next() > terraceChance) {
          continue;
        }

        if (!isEdge && isTerraceLead && prng.next() > terraceChance) {
          continue;
        }

        if (isEdge && edgeDistance > 0 && prng.next() < wallBreakChance) {
          continue;
        }

        if (outerRimBreakChance > 0 && prng.next() < outerRimBreakChance) {
          continue;
        }

        const stage = getBlockStage({ isEdge, isCenter, nucleus, settings, layerRatio });
        const angularAge = Math.round(spiralBand * 44);
        const incompleteWallAge = isEdge ? Math.round(prng.next() * 18) : Math.round(prng.next() * 38);
        blocks.push({
          plannedOrder: nextCandidateOrder(),
          nucleusId: nucleus.id,
          x: worldX,
          y,
          z: worldZ,
          size: Number((0.22 + settings.crystalScale * 0.08).toFixed(4)),
          stage,
          age:
            nucleus.startDelay +
            layer * Math.round(72 - settings.coolingRate * 14) +
            edgeDistance * 9 +
            layerStep +
            angularAge +
            incompleteWallAge,
        });
      }
    }
  }

  return blocks;
}

function isCornerCell(
  x: number,
  z: number,
  extents: { posX: number; negX: number; posZ: number; negZ: number },
) {
  const nearX = x <= -extents.negX + 1 || x >= extents.posX - 1;
  const nearZ = z <= -extents.negZ + 1 || z >= extents.posZ - 1;

  return nearX && nearZ;
}

function getLayerExtents(
  outer: number,
  nucleus: NucleusPlan,
  layer: number,
  layerRatio: number,
  settings: GenerationSettings,
) {
  const terracePulse = Math.sin(layer * 0.92 + nucleus.impurityOffset * 6.28);
  const asymmetryScale =
    (1 - settings.symmetryBias) * (0.9 + layerRatio * 1.2) + settings.impurity * 0.65;
  const pulse = Math.round(terracePulse * settings.impurity * 2);

  return {
    posX: Math.max(1, outer + Math.round(nucleus.asymmetry[0] * asymmetryScale) + pulse),
    negX: Math.max(1, outer + Math.round(nucleus.asymmetry[1] * asymmetryScale) - pulse),
    posZ: Math.max(1, outer + Math.round(nucleus.asymmetry[2] * asymmetryScale)),
    negZ: Math.max(1, outer + Math.round(nucleus.asymmetry[3] * asymmetryScale)),
  };
}

function getEdgeDistance(
  x: number,
  z: number,
  extents: { posX: number; negX: number; posZ: number; negZ: number },
) {
  return Math.min(x + extents.negX, extents.posX - x, z + extents.negZ, extents.posZ - z);
}

function getSpiralOffset(
  nucleus: NucleusPlan,
  layer: number,
  layerRatio: number,
  settings: GenerationSettings,
) {
  const magnitude = settings.impurity * 1.35 + (1 - settings.symmetryBias) * 1.15;
  const angle = nucleus.handedness * (layer * nucleus.spiralPitch + nucleus.impurityOffset * Math.PI * 2);

  return [
    Math.round(Math.cos(angle) * magnitude * layerRatio + nucleus.lateralDrift[0] * layerRatio),
    Math.round(Math.sin(angle) * magnitude * layerRatio + nucleus.lateralDrift[1] * layerRatio),
  ] as const;
}

function getHopperCenterDrift(
  nucleus: NucleusPlan,
  layer: number,
  layerRatio: number,
  settings: GenerationSettings,
) {
  const wobble = settings.impurity * 2.4 + (1 - settings.symmetryBias) * 1.6;
  const angle =
    nucleus.handedness * (layer * nucleus.spiralPitch * 1.6 + nucleus.impurityOffset * Math.PI * 2);

  return [
    Math.round(Math.cos(angle) * wobble * layerRatio),
    Math.round(Math.sin(angle) * wobble * layerRatio),
  ] as const;
}

function getSquareSpiralInfluence(
  x: number,
  z: number,
  layer: number,
  nucleus: NucleusPlan,
  settings: GenerationSettings,
) {
  let band = 0;
  let coreRecess = 0;
  let strength = 0;

  for (const source of nucleus.spiralSources) {
    const localX = x - source.offset[0];
    const localZ = z - source.offset[1];
    const ring = Math.max(Math.abs(localX), Math.abs(localZ));

    if (ring === 0) {
      coreRecess = Math.max(coreRecess, source.strength);
      continue;
    }

    const progress = getSquareRingProgress(localX, localZ, ring, source.handedness);
    const layerAdvance = layer * source.layerDrift * source.spacing;
    const spiralCoordinate =
      ring +
      progress * source.spacing +
      source.phase * source.spacing +
      layerAdvance;
    const spiralDistance = getModuloDistance(spiralCoordinate, source.spacing);
    const ringDistance = getModuloDistance(
      ring + source.phase * source.spacing * 0.5 + layerAdvance * 0.7,
      source.spacing,
    );
    const stepWidth = 0.96 + settings.terraceHeight * 0.78 + settings.edgeGrowthBias * 0.28;
    const ringWidth = 0.48 + settings.terraceHeight * 0.42;
    const spiralBand = clamp01(1 - spiralDistance / stepWidth);
    const terraceRingBand = clamp01(1 - ringDistance / ringWidth) * 0.18;
    const sourceBand = Math.max(spiralBand, terraceRingBand) * source.strength;

    band = Math.max(band, sourceBand);
    strength = Math.max(strength, source.strength);

    if (ring <= Math.max(2, Math.round(source.spacing * 0.42))) {
      coreRecess = Math.max(coreRecess, (1 - ring / Math.max(1, source.spacing)) * source.strength);
    }
  }

  return {
    band: clamp01(band),
    coreRecess: clamp01(coreRecess),
    isStep: band > 0.36,
    strength,
  };
}

function getSquareRingProgress(
  x: number,
  z: number,
  ring: number,
  handedness: -1 | 1,
) {
  const sideLength = ring * 2;
  let position = 0;

  if (z === -ring) {
    position = x + ring;
  } else if (x === ring) {
    position = sideLength + z + ring;
  } else if (z === ring) {
    position = sideLength * 2 + (ring - x);
  } else {
    position = sideLength * 3 + (ring - z);
  }

  const perimeter = Math.max(1, sideLength * 4);
  const progress = position / perimeter;

  return handedness > 0 ? progress : 1 - progress;
}

function getModuloDistance(value: number, period: number) {
  const wrapped = ((value % period) + period) % period;

  return Math.min(wrapped, period - wrapped);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getSpiralBand(x: number, z: number, layer: number, nucleus: NucleusPlan) {
  const angle = Math.atan2(z || 0.0001, x || 0.0001);
  const normalizedAngle = (angle + Math.PI) / (Math.PI * 2);
  const radius = Math.max(Math.abs(x), Math.abs(z));
  const turn =
    normalizedAngle * 4 * nucleus.handedness +
    layer * nucleus.spiralPitch +
    radius * 0.115 +
    nucleus.impurityOffset;
  const phase = turn - Math.floor(turn);

  return 1 - Math.abs(phase - 0.5) * 2;
}

function getBlockStage({
  isEdge,
  isCenter,
  nucleus,
  settings,
  layerRatio,
}: {
  isEdge: boolean;
  isCenter: boolean;
  nucleus: NucleusPlan;
  settings: GenerationSettings;
  layerRatio: number;
}): CrystalBlockStage {
  if (layerRatio < 0.08) {
    return 'seed';
  }

  if (nucleus.isBranch) {
    return 'branch';
  }

  if (isEdge) {
    return 'edge';
  }

  if (isCenter && settings.faceFillRate > 0.24) {
    return 'face';
  }

  return 'terrace';
}

function chooseChunkStep(chunk: CrystalBlock[]): GenerationStep {
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

function getChunkProgressDelta(
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

function assignOxide(
  blocks: CrystalBlock[],
  settings: GenerationSettings,
  prng: SeededPrng,
) {
  const maxY = blocks.reduce((max, block) => Math.max(max, block.y), 0);

  for (const block of blocks) {
    const heightFactor = block.y / Math.max(1, maxY);
    const recessFactor = block.stage === 'face' ? 0.85 : block.stage === 'terrace' ? 1.05 : 1.18;
    const noise = prng.signed(settings.impurity * 38);
    block.oxideThickness = Number(
      (
        90 +
        settings.oxidationExposure * 520 +
        heightFactor * 120 +
        recessFactor * 42 +
        noise
      ).toFixed(3),
    );
  }
}

function buildFacets(blocks: CrystalBlock[], occupied: Set<string>) {
  const facets: CrystalFacet[] = [];
  const normals: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  for (const block of blocks) {
    for (const normal of normals) {
      const neighborKey = cellKey(
        block.x + normal[0],
        block.y + normal[1],
        block.z + normal[2],
      );
      if (occupied.has(neighborKey)) {
        continue;
      }

      facets.push({
        id: facets.length + 1,
        blockId: block.id,
        normal,
        center: [
          Number((block.x + normal[0] * 0.5).toFixed(4)),
          Number((block.y + normal[1] * 0.5).toFixed(4)),
          Number((block.z + normal[2] * 0.5).toFixed(4)),
        ],
        oxideThickness: block.oxideThickness,
        area: Number((block.size * block.size).toFixed(4)),
      });
    }
  }

  return facets;
}

function getOxideRange(blocks: CrystalBlock[]): [number, number] {
  if (blocks.length === 0) {
    return [0, 0];
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const block of blocks) {
    min = Math.min(min, block.oxideThickness);
    max = Math.max(max, block.oxideThickness);
  }

  return [Number(min.toFixed(3)), Number(max.toFixed(3))];
}

function applyDisplayTiming(events: GenerationEvent[], minDisplayMs: number) {
  const totalWeight = events.reduce((sum, event) => sum + stepWeights[event.step], 0);
  let elapsed = 0;

  for (const event of events) {
    const weight = stepWeights[event.step] / totalWeight;
    elapsed += Math.max(24, minDisplayMs * weight);
    event.displayTimeMs = Math.round(Math.min(minDisplayMs, elapsed));
  }

  events[events.length - 1].displayTimeMs = minDisplayMs;
}

function chunkBlocks(blocks: CrystalBlock[], chunkSize: number) {
  const chunks: CrystalBlock[][] = [];
  for (let index = 0; index < blocks.length; index += chunkSize) {
    chunks.push(blocks.slice(index, index + chunkSize));
  }

  return chunks;
}

function rotateCell(x: number, z: number, orientation: 0 | 1 | 2 | 3) {
  if (orientation === 1) {
    return [-z, x] as const;
  }
  if (orientation === 2) {
    return [-x, -z] as const;
  }
  if (orientation === 3) {
    return [z, -x] as const;
  }

  return [x, z] as const;
}

function createEmptyBounds(): Bounds3 {
  return {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  };
}

function extendBounds(bounds: Bounds3, block: CrystalBlock) {
  const half = block.size / 2;
  bounds.min[0] = Math.min(bounds.min[0], block.x - half);
  bounds.min[1] = Math.min(bounds.min[1], block.y - half);
  bounds.min[2] = Math.min(bounds.min[2], block.z - half);
  bounds.max[0] = Math.max(bounds.max[0], block.x + half);
  bounds.max[1] = Math.max(bounds.max[1], block.y + half);
  bounds.max[2] = Math.max(bounds.max[2], block.z + half);
}

function cloneBounds(bounds: Bounds3): Bounds3 {
  return {
    min: bounds.min.map((value) => Number(value.toFixed(4))) as [number, number, number],
    max: bounds.max.map((value) => Number(value.toFixed(4))) as [number, number, number],
  };
}

function cellKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}
