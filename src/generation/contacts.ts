import { dotVector, getMisorientation, normalizeVector } from './math';
import { cellKey } from './spatial';
import type { CandidateBlock, NucleusPlan } from './internalTypes';
import type { CrystalBlock, CrystalGrowthFrame, GenerationSettings } from './types';

export interface DirectionalContact {
  block: CrystalBlock;
  offset: [number, number, number];
  misorientation: number;
}

export interface ContactBarrier {
  otherNucleusId: number;
  anchor: [number, number, number];
  normal: [number, number, number];
}

export interface ContactBarrierState {
  barriersByLayer: Map<string, ContactBarrier[]>;
}

const horizontalSupportOffsets = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const contactBarrierLayerReach = 3;
const contactBarrierClearance = 0.55;

export function createContactBarrierState(): ContactBarrierState {
  return {
    barriersByLayer: new Map(),
  };
}

export function findDirectionalContacts(
  candidate: CandidateBlock,
  occupied: Map<string, CrystalBlock>,
) {
  const contacts: DirectionalContact[] = [];
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

    if (!block || block.nucleusId === candidate.nucleusId) {
      continue;
    }

    const misorientation = getMisorientation(candidate.growth.direction, block.growth.direction);
    if (misorientation > 0.08) {
      contacts.push({ block, offset: [offsetX, offsetY, offsetZ], misorientation });
    }
  }

  contacts.sort(
    (a, b) =>
      b.misorientation - a.misorientation ||
      Math.abs(a.offset[1]) - Math.abs(b.offset[1]) ||
      a.block.id - b.block.id,
  );

  return contacts;
}

// Approximate impingement as a weighted front boundary between active nuclei.
export function isOccludedByCompetingFront(
  candidate: CandidateBlock,
  nucleus: NucleusPlan,
  nuclei: readonly NucleusPlan[],
  settings: GenerationSettings,
) {
  for (const competingNucleus of nuclei) {
    if (competingNucleus.id === nucleus.id) {
      continue;
    }

    if (!isWithinVerticalGrowthBand(candidate, competingNucleus, settings)) {
      continue;
    }

    const pairX = competingNucleus.origin[0] - nucleus.origin[0];
    const pairZ = competingNucleus.origin[2] - nucleus.origin[2];
    const pairDistance = Math.hypot(pairX, pairZ);
    if (pairDistance < 1) {
      continue;
    }

    const axisX = pairX / pairDistance;
    const axisZ = pairZ / pairDistance;
    const candidateX = candidate.x - nucleus.origin[0];
    const candidateZ = candidate.z - nucleus.origin[2];
    const towardCompetitor = candidateX * axisX + candidateZ * axisZ;
    if (towardCompetitor <= 0) {
      continue;
    }

    const ownSpeed = estimateNucleusFrontSpeed(nucleus, settings);
    const competitorSpeed = estimateNucleusFrontSpeed(competingNucleus, settings);
    const speedBoundary = ownSpeed / Math.max(0.0001, ownSpeed + competitorSpeed);
    const delayShift = (competingNucleus.startDelay - nucleus.startDelay) / Math.max(240, pairDistance * 54);
    const boundaryFraction = clamp(speedBoundary + delayShift, 0.28, 0.72);
    const boundaryDistance = pairDistance * boundaryFraction;
    const contactAllowance = 1.05 + settings.faceFillRate * 0.55 + settings.impurity * 0.2;

    if (towardCompetitor > boundaryDistance + contactAllowance) {
      return true;
    }
  }

  return false;
}

export function hasSameNucleusGrowthSupport(
  candidate: CandidateBlock,
  occupied: Map<string, CrystalBlock>,
) {
  if (candidate.stage === 'seed') {
    return true;
  }

  const supportOffsets = [
    [0, -1, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
    [1, -1, 0],
    [-1, -1, 0],
    [0, -1, 1],
    [0, -1, -1],
  ] as const;

  for (const [offsetX, offsetY, offsetZ] of supportOffsets) {
    const support = occupied.get(cellKey(candidate.x + offsetX, candidate.y + offsetY, candidate.z + offsetZ));
    if (support?.nucleusId === candidate.nucleusId) {
      return true;
    }
  }

  return false;
}

export function isBlockedByContactBarrier(
  candidate: CandidateBlock,
  barriers: ContactBarrierState,
) {
  const layerBarriers = barriers.barriersByLayer.get(contactBarrierLayerKey(candidate.nucleusId, candidate.y));
  if (!layerBarriers) {
    return false;
  }

  for (const barrier of layerBarriers) {
    const signedDistance =
      (candidate.x - barrier.anchor[0]) * barrier.normal[0] +
      (candidate.y - barrier.anchor[1]) * barrier.normal[1] +
      (candidate.z - barrier.anchor[2]) * barrier.normal[2];

    if (signedDistance > contactBarrierClearance) {
      return true;
    }
  }

  return false;
}

export function recordContactBarriers(
  block: CrystalBlock,
  contacts: DirectionalContact[],
  barriers: ContactBarrierState,
) {
  for (const contact of contacts) {
    if (contact.offset[1] !== 0) {
      continue;
    }

    const normal = normalizeVector(contact.offset);
    const anchor = [
      block.x + contact.offset[0] * 0.5,
      block.y,
      block.z + contact.offset[2] * 0.5,
    ] as [number, number, number];

    addContactBarrier(block.nucleusId, contact.block.nucleusId, block.y, anchor, normal, barriers);
    addContactBarrier(
      contact.block.nucleusId,
      block.nucleusId,
      contact.block.y,
      anchor,
      [-normal[0], -normal[1], -normal[2]],
      barriers,
    );
  }
}

export function resolveOccupiedContact(occupyingBlock: CrystalBlock, candidate: CandidateBlock) {
  if (occupyingBlock.nucleusId === candidate.nucleusId) {
    return;
  }

  const misorientation = getMisorientation(occupyingBlock.growth.direction, candidate.growth.direction);
  if (misorientation <= 0.08) {
    return;
  }

  const offset = normalizeVector([
    occupyingBlock.x - candidate.x,
    occupyingBlock.y - candidate.y,
    occupyingBlock.z - candidate.z,
  ]);
  occupyingBlock.growth = chooseContactGrowthDirection(
    occupyingBlock.growth,
    candidate.growth,
    offset,
    misorientation,
  );
  occupyingBlock.age = Math.round(occupyingBlock.age + misorientation * 12);
}

export function isOccludedByResolvedContact(
  candidate: CandidateBlock,
  contacts: DirectionalContact[],
  occupied: Map<string, CrystalBlock>,
) {
  if (contacts.length === 0) {
    return false;
  }

  const blockingContacts = contacts.filter((contact) => {
    const towardContact = normalizeVector(contact.offset);
    const incomingAlignment = dotVector(candidate.growth.direction, towardContact);

    return contact.misorientation > 0.28 && incomingAlignment > 0.24;
  });

  if (blockingContacts.length === 0) {
    return false;
  }

  const sameNucleusSupport = getSameNucleusHorizontalSupport(candidate, occupied);
  const hasFaceContact = blockingContacts.some((contact) => contact.offset[1] === 0);
  const hasMultipleBlockingContacts = blockingContacts.length > 1;

  return hasMultipleBlockingContacts || (!hasFaceContact && sameNucleusSupport < 2);
}

export function resolveGrowthFrameAtContact(
  candidate: CandidateBlock,
  contacts: DirectionalContact[],
): CrystalGrowthFrame {
  if (contacts.length === 0) {
    return candidate.growth;
  }

  const aggregate = contacts.reduce<[number, number, number]>(
    (sum, contact) => [
      sum[0] + contact.offset[0] * contact.misorientation,
      sum[1] + contact.offset[1] * contact.misorientation,
      sum[2] + contact.offset[2] * contact.misorientation,
    ],
    [0, 0, 0],
  );
  const contactNormal = normalizeVector(aggregate);
  const strongest = contacts[0];
  const growth = chooseContactGrowthDirection(
    candidate.growth,
    strongest.block.growth,
    contactNormal,
    strongest.misorientation,
  );

  for (const contact of contacts) {
    contact.block.growth = chooseContactGrowthDirection(
      contact.block.growth,
      candidate.growth,
      [-contact.offset[0], -contact.offset[1], -contact.offset[2]],
      contact.misorientation,
    );
  }

  return growth;
}

function chooseContactGrowthDirection(
  growth: CrystalGrowthFrame,
  neighborGrowth: CrystalGrowthFrame,
  contactNormal: [number, number, number],
  misorientation: number,
): CrystalGrowthFrame {
  const normal = normalizeVector(contactNormal);
  const incoming = normalizeVector(growth.direction);
  const intoContact = Math.max(0, dotVector(incoming, normal));
  const reflected = normalizeVector([
    incoming[0] - normal[0] * 2 * intoContact,
    incoming[1] - normal[1] * 2 * intoContact,
    incoming[2] - normal[2] * 2 * intoContact,
  ]);
  const tangent = normalizeVector([
    incoming[0] - normal[0] * dotVector(incoming, normal),
    incoming[1] - normal[1] * dotVector(incoming, normal),
    incoming[2] - normal[2] * dotVector(incoming, normal),
  ]);
  const neighborTangent = normalizeVector([
    neighborGrowth.direction[0] - normal[0] * dotVector(neighborGrowth.direction, normal),
    neighborGrowth.direction[1] - normal[1] * dotVector(neighborGrowth.direction, normal),
    neighborGrowth.direction[2] - normal[2] * dotVector(neighborGrowth.direction, normal),
  ]);
  const tangentWeight = 0.35 + Math.min(0.35, misorientation * 0.28);
  const neighborWeight = Math.min(0.25, misorientation * 0.18);
  const direction = normalizeVector([
    reflected[0] * (1 - tangentWeight) + tangent[0] * tangentWeight + neighborTangent[0] * neighborWeight,
    reflected[1] * (1 - tangentWeight) + tangent[1] * tangentWeight + neighborTangent[1] * neighborWeight + 0.04,
    reflected[2] * (1 - tangentWeight) + tangent[2] * tangentWeight + neighborTangent[2] * neighborWeight,
  ]);

  return {
    ...growth,
    direction,
    contactStress: Number(Math.min(1, growth.contactStress + misorientation * 0.5 + intoContact * 0.35).toFixed(4)),
    misorientation: Number(Math.max(growth.misorientation, misorientation).toFixed(4)),
  };
}

function getSameNucleusHorizontalSupport(
  candidate: CandidateBlock,
  occupied: Map<string, CrystalBlock>,
) {
  let support = 0;

  for (const [offsetX, offsetZ] of horizontalSupportOffsets) {
    const neighbor = occupied.get(cellKey(candidate.x + offsetX, candidate.y, candidate.z + offsetZ));
    if (neighbor?.nucleusId === candidate.nucleusId) {
      support += 1;
    }
  }

  return support;
}

export function pruneDirectionalOvergrowth(blocks: CrystalBlock[]) {
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  let keptBlocks = blocks;

  for (let pass = 0; pass < 64; pass += 1) {
    const occupied = new Map(keptBlocks.map((block) => [cellKey(block.x, block.y, block.z), block]));
    const removed = new Set<number>();

    for (const block of keptBlocks) {
      if (removed.has(block.id)) {
        continue;
      }

      for (const [offsetX, offsetZ] of directions) {
        const neighbor = occupied.get(cellKey(block.x + offsetX, block.y, block.z + offsetZ));
        if (!neighbor || neighbor.nucleusId === block.nucleusId) {
          continue;
        }

        const beyondNeighbor = occupied.get(
          cellKey(block.x + offsetX * 2, block.y, block.z + offsetZ * 2),
        );
        if (!beyondNeighbor || beyondNeighbor.nucleusId !== block.nucleusId) {
          continue;
        }

        removed.add(beyondNeighbor.id);
      }
    }

    if (removed.size === 0) {
      return keptBlocks;
    }

    keptBlocks = keptBlocks.filter((block) => !removed.has(block.id));
  }

  return keptBlocks;
}

export function pruneUnsupportedBlocks(blocks: CrystalBlock[]) {
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
  let horizontal = 0;

  for (const [offsetX, offsetZ] of horizontalSupportOffsets) {
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

function addContactBarrier(
  nucleusId: number,
  otherNucleusId: number,
  y: number,
  anchor: [number, number, number],
  normal: [number, number, number],
  barriers: ContactBarrierState,
) {
  for (let layer = y - contactBarrierLayerReach; layer <= y + contactBarrierLayerReach; layer += 1) {
    const key = contactBarrierLayerKey(nucleusId, layer);
    const layerBarriers = barriers.barriersByLayer.get(key) ?? [];
    const alreadyTracked = layerBarriers.some(
      (barrier) =>
        barrier.otherNucleusId === otherNucleusId &&
        barrier.anchor[0] === anchor[0] &&
        barrier.anchor[1] === anchor[1] &&
        barrier.anchor[2] === anchor[2] &&
        barrier.normal[0] === normal[0] &&
        barrier.normal[1] === normal[1] &&
        barrier.normal[2] === normal[2],
    );

    if (!alreadyTracked) {
      layerBarriers.push({ otherNucleusId, anchor, normal });
      barriers.barriersByLayer.set(key, layerBarriers);
    }
  }
}

function contactBarrierLayerKey(nucleusId: number, y: number) {
  return `${nucleusId}:${y}`;
}

function isWithinVerticalGrowthBand(
  candidate: CandidateBlock,
  nucleus: NucleusPlan,
  settings: GenerationSettings,
) {
  const verticalPadding = Math.max(2, Math.round(2 + settings.nucleiVerticalSpread * 4));

  return (
    candidate.y >= nucleus.origin[1] - verticalPadding &&
    candidate.y <= nucleus.origin[1] + nucleus.layers + verticalPadding
  );
}

function estimateNucleusFrontSpeed(nucleus: NucleusPlan, settings: GenerationSettings) {
  const horizontalReach = nucleus.maxRadius + settings.edgeGrowthBias * 2.8 + settings.crystalScale * 1.2;
  const verticalCost = Math.max(1, nucleus.layers * (0.84 - settings.coolingRate * 0.12));

  return Math.max(0.05, horizontalReach / verticalCost);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
