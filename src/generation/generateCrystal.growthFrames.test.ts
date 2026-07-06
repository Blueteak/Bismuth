import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import { baseGenerationSettings } from './testSettings';

const horizontalDirections = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

describe('generateCrystal growth frames', () => {
  it('stores stable growth frames for hopper, screw, and contact behavior', () => {
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
    let stressedContactCount = 0;

    for (const block of model.blocks) {
      const directionLength = Math.hypot(...block.growth.direction);
      expect(directionLength).toBeGreaterThan(0.98);
      expect(directionLength).toBeLessThan(1.02);
      expect(block.growth.edgeExposure).toBeGreaterThanOrEqual(0);
      expect(block.growth.edgeExposure).toBeLessThanOrEqual(1);
      expect(block.growth.hopperLag).toBeGreaterThanOrEqual(0);
      expect(block.growth.hopperLag).toBeLessThanOrEqual(1);
      expect(block.growth.screwStrength).toBeGreaterThanOrEqual(0);
      expect(block.growth.screwStrength).toBeLessThanOrEqual(1);

      for (const [offsetX, offsetZ] of horizontalDirections) {
        const neighbor = occupied.get(`${block.x + offsetX},${block.y},${block.z + offsetZ}`);
        if (
          neighbor &&
          neighbor.nucleusId !== block.nucleusId &&
          (block.growth.contactStress > 0 || neighbor.growth.contactStress > 0)
        ) {
          stressedContactCount += 1;
        }
      }
    }

    expect(stressedContactCount).toBeGreaterThan(0);
  });
});
