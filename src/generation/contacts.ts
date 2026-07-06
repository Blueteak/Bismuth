import { dotVector, getMisorientation, normalizeVector } from './math';
import { createSpatialIndex, getNearbyBlocks, localCellKey } from './spatial';
import type { CandidateBlock, NucleusPlan } from './internalTypes';
import type { CrystalBlock, CrystalGrowthFrame, GenerationSettings } from './types';

export interface DirectionalContact {
  block: CrystalBlock;
  offset: [number, number, number];
  misorientation: number;
  distance: number;
}

export interface ContactBarrier {
  otherNucleusId: number;
  anchor: [number, number, number];
  normal: [number, number, number];
}

export interface ContactBarrierState {
  barriersByNucleus: Map<number, ContactBarrier[]>;
}

const localHorizontalSupportOffsets = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;
const contactBarrierClearance = 0.55;
const contactReach = 1.18;

export function createContactBarrierState(): ContactBarrierState {
  return {
    barriersByNucleus: new Map(),
  };
}

export function findDirectionalContacts(
  candidate: CandidateBlock,
  occupied: Map<string, CrystalBlock[]>,
) {
  const contacts: DirectionalContact[] = [];

  for (const block of getNearbyBlocks(occupied, [candidate.x, candidate.y, candidate.z], contactReach)) {
    const offset = normalizeVector([
      block.x - candidate.x,
      block.y - candidate.y,
      block.z - candidate.z,
    ]);

    if (block.nucleusId === candidate.nucleusId) {
      continue;
    }

    const misorientation = getMisorientation(candidate.growth.direction, block.growth.direction);
    if (misorientation > 0.08) {
      contacts.push({
        block,
        offset,
        misorientation,
        distance: Math.hypot(block.x - candidate.x, block.y - candidate.y, block.z - candidate.z),
      });
    }
  }

  contacts.sort(
    (a, b) =>
      b.misorientation - a.misorientation ||
      a.distance - b.distance ||
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

    const pair = [
      competingNucleus.origin[0] - nucleus.origin[0],
      competingNucleus.origin[1] - nucleus.origin[1],
      competingNucleus.origin[2] - nucleus.origin[2],
    ] as [number, number, number];
    const pairDistance = Math.hypot(pair[0], pair[1], pair[2]);
    if (pairDistance < 1) {
      continue;
    }

    const pairAxis = [pair[0] / pairDistance, pair[1] / pairDistance, pair[2] / pairDistance];
    const candidateVector = [
      candidate.x - nucleus.origin[0],
      candidate.y - nucleus.origin[1],
      candidate.z - nucleus.origin[2],
    ];
    const towardCompetitor = dotVector(candidateVector, pairAxis);
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
    const support = occupied.get(
      localCellKey(candidate.nucleusId, [
        candidate.local[0] + offsetX,
        candidate.local[1] + offsetY,
        candidate.local[2] + offsetZ,
      ]),
    );
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
  const nucleusBarriers = barriers.barriersByNucleus.get(candidate.nucleusId);
  if (!nucleusBarriers) {
    return false;
  }

  for (const barrier of nucleusBarriers) {
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
    const normal = normalizeVector(contact.offset);
    const anchor = [
      (block.x + contact.block.x) * 0.5,
      (block.y + contact.block.y) * 0.5,
      (block.z + contact.block.z) * 0.5,
    ] as [number, number, number];

    addContactBarrier(block.nucleusId, contact.block.nucleusId, anchor, normal, barriers);
    addContactBarrier(
      contact.block.nucleusId,
      block.nucleusId,
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
  const hasMultipleBlockingContacts = blockingContacts.length > 1;

  return hasMultipleBlockingContacts || sameNucleusSupport < 2;
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

  for (const [offsetX, offsetY, offsetZ] of localHorizontalSupportOffsets) {
    const neighbor = occupied.get(
      localCellKey(candidate.nucleusId, [
        candidate.local[0] + offsetX,
        candidate.local[1] + offsetY,
        candidate.local[2] + offsetZ,
      ]),
    );
    if (neighbor?.nucleusId === candidate.nucleusId) {
      support += 1;
    }
  }

  return support;
}

export function pruneDirectionalOvergrowth(blocks: CrystalBlock[]) {
  let keptBlocks = blocks;

  for (let pass = 0; pass < 64; pass += 1) {
    const occupied = createSpatialIndex(keptBlocks);
    const removed = new Set<number>();

    for (const block of keptBlocks) {
      if (removed.has(block.id)) {
        continue;
      }

      const nearbyContacts = getNearbyBlocks(occupied, [block.x, block.y, block.z], contactReach).filter(
        (neighbor) => neighbor.id !== block.id && neighbor.nucleusId !== block.nucleusId,
      );

      for (const neighbor of nearbyContacts) {
        const normal = normalizeVector([
          neighbor.x - block.x,
          neighbor.y - block.y,
          neighbor.z - block.z,
        ]);
        const neighborDistance = Math.hypot(
          neighbor.x - block.x,
          neighbor.y - block.y,
          neighbor.z - block.z,
        );

        if (neighborDistance < 0.0001) {
          continue;
        }

        const beyondCandidates = getNearbyBlocks(
          occupied,
          [
            block.x + normal[0] * (neighborDistance + 1),
            block.y + normal[1] * (neighborDistance + 1),
            block.z + normal[2] * (neighborDistance + 1),
          ],
          1.05,
        );

        for (const beyondNeighbor of beyondCandidates) {
          if (
            beyondNeighbor.id === block.id ||
            beyondNeighbor.nucleusId !== block.nucleusId ||
            removed.has(beyondNeighbor.id)
          ) {
            continue;
          }

          const beyondVector = [
            beyondNeighbor.x - block.x,
            beyondNeighbor.y - block.y,
            beyondNeighbor.z - block.z,
          ];
          const alongContactNormal = dotVector(beyondVector, normal);
          const lateralDistance = Math.hypot(
            beyondVector[0] - normal[0] * alongContactNormal,
            beyondVector[1] - normal[1] * alongContactNormal,
            beyondVector[2] - normal[2] * alongContactNormal,
          );

          if (
            alongContactNormal > neighborDistance + 0.42 &&
            alongContactNormal < neighborDistance + 1.7 &&
            lateralDistance < 0.72
          ) {
            removed.add(beyondNeighbor.id);
          }
        }
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
    const occupied = new Map(keptBlocks.map((block) => [localCellKey(block.nucleusId, block.local), block]));
    const maxLayerByNucleus = getMaxLayerByNucleus(keptBlocks);
    const nextBlocks = keptBlocks.filter((block) => {
      if (block.stage === 'seed') {
        return true;
      }

      const support = getSupportCounts(block, occupied);
      const isTerminalTop =
        block.local[1] >= (maxLayerByNucleus.get(block.nucleusId) ?? block.local[1]) - 2 &&
        support.above === 0;

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

function getMaxLayerByNucleus(blocks: CrystalBlock[]) {
  const maxLayerByNucleus = new Map<number, number>();

  for (const block of blocks) {
    maxLayerByNucleus.set(
      block.nucleusId,
      Math.max(maxLayerByNucleus.get(block.nucleusId) ?? Number.NEGATIVE_INFINITY, block.local[1]),
    );
  }

  return maxLayerByNucleus;
}

function getSupportCounts(block: CrystalBlock, occupied: Map<string, CrystalBlock>) {
  let horizontal = 0;

  for (const [offsetX, offsetY, offsetZ] of localHorizontalSupportOffsets) {
    if (
      occupied.has(
        localCellKey(block.nucleusId, [
          block.local[0] + offsetX,
          block.local[1] + offsetY,
          block.local[2] + offsetZ,
        ]),
      )
    ) {
      horizontal += 1;
    }
  }

  const below = occupied.has(
    localCellKey(block.nucleusId, [block.local[0], block.local[1] - 1, block.local[2]]),
  )
    ? 1
    : 0;
  const above = occupied.has(
    localCellKey(block.nucleusId, [block.local[0], block.local[1] + 1, block.local[2]]),
  )
    ? 1
    : 0;

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
  anchor: [number, number, number],
  normal: [number, number, number],
  barriers: ContactBarrierState,
) {
  const nucleusBarriers = barriers.barriersByNucleus.get(nucleusId) ?? [];
  const alreadyTracked = nucleusBarriers.some(
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
    nucleusBarriers.push({ otherNucleusId, anchor, normal });
    barriers.barriersByNucleus.set(nucleusId, nucleusBarriers);
  }
}

function estimateNucleusFrontSpeed(nucleus: NucleusPlan, settings: GenerationSettings) {
  const horizontalReach = nucleus.maxRadius + settings.edgeGrowthBias * 2.8 + settings.crystalScale * 1.2;
  const advanceCost = Math.max(1, nucleus.layers * (0.84 - settings.coolingRate * 0.12));

  return Math.max(0.05, horizontalReach / advanceCost);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
