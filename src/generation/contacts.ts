import { dotVector, getMisorientation, normalizeVector } from './math';
import { cellKey } from './spatial';
import type { CandidateBlock } from './internalTypes';
import type { CrystalBlock, CrystalGrowthFrame } from './types';

interface DirectionalContact {
  block: CrystalBlock;
  offset: [number, number, number];
  misorientation: number;
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
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  let support = 0;

  for (const [offsetX, offsetZ] of offsets) {
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

