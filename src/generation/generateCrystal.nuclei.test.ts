import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import { baseGenerationSettings } from './testSettings';

const horizontalDirections = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

describe('generateCrystal multi-nucleus growth', () => {
  it('co-grows multiple vertically distributed nuclei on one timeline', () => {
    const { model } = generateCrystal({
      ...baseGenerationSettings,
      nucleationCount: 4,
      nucleusStartDelay: 0,
      nucleiVerticalSpread: 1,
      branchingProbability: 0,
    });

    const firstGrowthNuclei = new Set(model.blocks.slice(0, 160).map((block) => block.nucleusId));
    const minimumYByNucleus = new Map<number, number>();
    const occupied = new Set<string>();

    for (const block of model.blocks) {
      minimumYByNucleus.set(
        block.nucleusId,
        Math.min(minimumYByNucleus.get(block.nucleusId) ?? Number.POSITIVE_INFINITY, block.y),
      );

      const key = `${block.x},${block.y},${block.z}`;
      expect(occupied.has(key)).toBe(false);
      occupied.add(key);
    }

    expect(firstGrowthNuclei.size).toBeGreaterThan(1);
    expect([...minimumYByNucleus.values()].some((y) => y > 0)).toBe(true);
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
    const occupied = new Map(
      model.blocks.map((block) => [`${block.x},${block.y},${block.z}`, block]),
    );

    for (const block of model.blocks) {
      for (const [offsetX, offsetZ] of horizontalDirections) {
        const neighbor = occupied.get(`${block.x + offsetX},${block.y},${block.z + offsetZ}`);
        if (!neighbor || neighbor.nucleusId === block.nucleusId) {
          continue;
        }

        const beyondNeighbor = occupied.get(
          `${block.x + offsetX * 2},${block.y},${block.z + offsetZ * 2}`,
        );

        expect(beyondNeighbor?.nucleusId).not.toBe(block.nucleusId);
      }
    }
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
    const occupied = new Map(
      model.blocks.map((block) => [`${block.x},${block.y},${block.z}`, block]),
    );
    let contactCount = 0;

    for (const block of model.blocks) {
      for (const [offsetX, offsetZ] of horizontalDirections) {
        const neighbor = occupied.get(`${block.x + offsetX},${block.y},${block.z + offsetZ}`);
        if (neighbor && neighbor.nucleusId !== block.nucleusId) {
          contactCount += 1;
        }
      }
    }

    expect(contactCount).toBeGreaterThan(0);
  });
});
