import { clamp01, normalizeVector, rotateCell } from './math';
import type { SeededPrng } from './prng';
import type { CrystalBlockStage, CrystalGrowthFrame, GenerationSettings } from './types';
import type { CandidateBlock, LayerExtents, NucleusPlan, SquareSpiralInfluence } from './internalTypes';

export function planNucleusGrowth({
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
        const growth = getCandidateGrowthFrame({
          x,
          z,
          layerRatio,
          extents,
          isEdge,
          isCenter,
          edgeDistance,
          hollowRadius,
          spiralBand,
          dislocationSpiral,
          nucleus,
          settings,
        });
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
          settings.hopperDepth * (0.22 + growth.hopperLag * 0.42) +
          growth.screwStrength * 0.1 -
          dislocationSpiral.coreRecess * settings.hopperDepth * 0.24 +
          settings.impurity * (prng.next() - 0.5) * 0.2;
        const terraceChance = isTerraceLead
          ? 0.74 +
            settings.terraceHeight * 0.14 +
            settings.edgeGrowthBias * (0.04 + growth.edgeExposure * 0.08) +
            growth.screwStrength * 0.2 +
            (isCenter ? settings.hopperDepth * 0.18 : 0)
          : settings.faceFillRate * 0.06 + growth.screwStrength * 0.04 - settings.hopperDepth * 0.1;
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
        const growthLead = Math.round(
          (growth.edgeExposure * settings.edgeGrowthBias - growth.hopperLag * settings.hopperDepth) * 18 -
            growth.screwStrength * 12,
        );
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
            incompleteWallAge -
            growthLead,
          growth,
        });
      }
    }
  }

  return blocks;
}

function isCornerCell(
  x: number,
  z: number,
  extents: LayerExtents,
) {
  const nearX = x <= -extents.negX + 1 || x >= extents.posX - 1;
  const nearZ = z <= -extents.negZ + 1 || z >= extents.posZ - 1;

  return nearX && nearZ;
}

export function getLayerExtents(
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
  extents: LayerExtents,
) {
  return Math.min(x + extents.negX, extents.posX - x, z + extents.negZ, extents.posZ - z);
}

export function getCandidateGrowthFrame({
  x,
  z,
  layerRatio,
  extents,
  isEdge,
  isCenter,
  edgeDistance,
  hollowRadius,
  spiralBand,
  dislocationSpiral,
  nucleus,
  settings,
}: {
  x: number;
  z: number;
  layerRatio: number;
  extents: LayerExtents;
  isEdge: boolean;
  isCenter: boolean;
  edgeDistance: number;
  hollowRadius: number;
  spiralBand: number;
  dislocationSpiral: SquareSpiralInfluence;
  nucleus: NucleusPlan;
  settings: GenerationSettings;
}): CrystalGrowthFrame {
  const edgeExposure = clamp01((2 + settings.edgeGrowthBias * 4 - edgeDistance) / 6);
  const centerDistance = Math.max(Math.abs(x), Math.abs(z));
  const hopperLag = clamp01(
    (isCenter ? 0.52 : 0.08) +
      settings.hopperDepth * (1 - Math.min(1, centerDistance / Math.max(1, hollowRadius + 1))) +
      (1 - edgeExposure) * 0.22,
  );
  const screwStrength = clamp01(Math.max(spiralBand * 0.46, dislocationSpiral.band) * dislocationSpiral.strength);
  const outward = getOutwardDirection(x, z, extents);
  const spiralTangent = getScrewTangentDirection(x, z, nucleus.handedness);
  const verticalLead = 0.08 + layerRatio * 0.16 + screwStrength * 0.12 - hopperLag * 0.08;
  const localDirection = normalizeVector([
    outward[0] * (0.78 + edgeExposure * 0.42) +
      spiralTangent[0] * screwStrength * 0.58 +
      nucleus.lateralDrift[0] * 0.04,
    verticalLead,
    outward[2] * (0.78 + edgeExposure * 0.42) +
      spiralTangent[2] * screwStrength * 0.58 +
      nucleus.lateralDrift[1] * 0.04,
  ]);
  const rotated = rotateCell(localDirection[0], localDirection[2], nucleus.orientation);

  return {
    direction: [
      Number(rotated[0].toFixed(4)),
      Number(localDirection[1].toFixed(4)),
      Number(rotated[1].toFixed(4)),
    ],
    edgeExposure: Number(edgeExposure.toFixed(4)),
    hopperLag: Number(hopperLag.toFixed(4)),
    screwPhase: Number(dislocationSpiral.phase.toFixed(4)),
    screwStrength: Number(screwStrength.toFixed(4)),
    contactStress: 0,
    misorientation: 0,
  };
}

function getOutwardDirection(
  x: number,
  z: number,
  extents: LayerExtents,
): [number, number, number] {
  const distances = [
    { distance: extents.posX - x, vector: [1, 0, 0] as [number, number, number] },
    { distance: x + extents.negX, vector: [-1, 0, 0] as [number, number, number] },
    { distance: extents.posZ - z, vector: [0, 0, 1] as [number, number, number] },
    { distance: z + extents.negZ, vector: [0, 0, -1] as [number, number, number] },
  ].sort((a, b) => a.distance - b.distance);
  const first = distances[0];
  const second = distances[1];

  if (Math.abs(first.distance - second.distance) <= 1) {
    return normalizeVector([
      first.vector[0] + second.vector[0],
      0,
      first.vector[2] + second.vector[2],
    ]);
  }

  return first.vector;
}

function getScrewTangentDirection(
  x: number,
  z: number,
  handedness: -1 | 1,
): [number, number, number] {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax >= az) {
    return normalizeVector([0, 0, handedness * Math.sign(x || 1)]);
  }

  return normalizeVector([-handedness * Math.sign(z || 1), 0, 0]);
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

export function getSquareSpiralInfluence(
  x: number,
  z: number,
  layer: number,
  nucleus: NucleusPlan,
  settings: GenerationSettings,
) {
  let band = 0;
  let coreRecess = 0;
  let phase = 0;
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

    if (sourceBand > band) {
      phase = ((spiralCoordinate / source.spacing) % 1 + 1) % 1;
      band = sourceBand;
    }
    strength = Math.max(strength, source.strength);

    if (ring <= Math.max(2, Math.round(source.spacing * 0.42))) {
      coreRecess = Math.max(coreRecess, (1 - ring / Math.max(1, source.spacing)) * source.strength);
    }
  }

  return {
    band: clamp01(band),
    coreRecess: clamp01(coreRecess),
    phase,
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
