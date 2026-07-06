import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import { createSpatialIndex, getNearbyBlocks, localCellKey } from './spatial';
import { baseGenerationSettings } from './testSettings';
import type { CrystalBlock } from './types';

describe('generateCrystal multi-nucleus growth', () => {
  it('co-grows multiple spatially distributed nuclei on one timeline', () => {
    const { model } = generateCrystal({
      ...baseGenerationSettings,
      nucleationCount: 4,
      nucleusStartDelay: 0,
      nucleiVerticalSpread: 1,
      branchingProbability: 0,
    });

    const firstGrowthNuclei = new Set(model.blocks.slice(0, 160).map((block) => block.nucleusId));
    const basisDirections = new Map<number, [number, number, number]>();
    const occupied = new Set<string>();

    for (const block of model.blocks) {
      basisDirections.set(block.nucleusId, block.basis.up);

      const key = localCellKey(block.nucleusId, block.local);
      expect(occupied.has(key)).toBe(false);
      occupied.add(key);
    }

    expect(firstGrowthNuclei.size).toBeGreaterThan(1);
    expect(
      [...basisDirections.values()].some((direction) => Math.hypot(direction[0], direction[2]) > 0.05),
    ).toBe(true);
  });

  it('stops growth fronts instead of letting nuclei pass through each other', () => {
    const { model } = generateCrystal({
      ...baseGenerationSettings,
      nucleationCount: 4,
      nucleusStartDelay: 0,
      nucleiVerticalSpread: 0,
      branchingProbability: 0,
      symmetryBias: 0.85,
      impurity: 0.08,
    });
    expectNoDirectionalPassThrough(model.blocks);
  });

  it('merges colliding nuclei at face-adjacent contact cells', () => {
    const { model } = generateCrystal({
      ...baseGenerationSettings,
      nucleationCount: 4,
      nucleusStartDelay: 0,
      nucleiVerticalSpread: 0,
      branchingProbability: 0,
      symmetryBias: 0.85,
      impurity: 0.08,
    });
    const occupied = createSpatialIndex(model.blocks);
    let contactCount = 0;

    for (const block of model.blocks) {
      for (const neighbor of getNearbyBlocks(occupied, [block.x, block.y, block.z], 1.18)) {
        if (neighbor.id !== block.id && neighbor.nucleusId !== block.nucleusId) {
          contactCount += 1;
        }
      }
    }

    expect(contactCount).toBeGreaterThan(0);
  });
});

function expectNoDirectionalPassThrough(blocks: CrystalBlock[]) {
  const occupied = createSpatialIndex(blocks);

  for (const block of blocks) {
    for (const neighbor of getNearbyBlocks(occupied, [block.x, block.y, block.z], 1.18)) {
      if (neighbor.id === block.id || neighbor.nucleusId === block.nucleusId) {
        continue;
      }

      const normal = normalize([
        neighbor.x - block.x,
        neighbor.y - block.y,
        neighbor.z - block.z,
      ]);
      const neighborDistance = Math.hypot(
        neighbor.x - block.x,
        neighbor.y - block.y,
        neighbor.z - block.z,
      );

      for (const beyond of getNearbyBlocks(
        occupied,
        [
          block.x + normal[0] * (neighborDistance + 1),
          block.y + normal[1] * (neighborDistance + 1),
          block.z + normal[2] * (neighborDistance + 1),
        ],
        1.05,
      )) {
        if (beyond.id === block.id || beyond.nucleusId !== block.nucleusId) {
          continue;
        }

        const vector = [beyond.x - block.x, beyond.y - block.y, beyond.z - block.z];
        const along = vector[0] * normal[0] + vector[1] * normal[1] + vector[2] * normal[2];
        const lateral = Math.hypot(
          vector[0] - normal[0] * along,
          vector[1] - normal[1] * along,
          vector[2] - normal[2] * along,
        );

        expect(along > neighborDistance + 0.42 && along < neighborDistance + 1.7 && lateral < 0.72).toBe(false);
      }
    }
  }
}

function normalize(vector: readonly number[]): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
