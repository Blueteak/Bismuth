import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import { createSpatialIndex, getNearbyBlocks } from './spatial';
import { baseGenerationSettings } from './testSettings';

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
    const occupied = createSpatialIndex(model.blocks);
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

      for (const neighbor of getNearbyBlocks(occupied, [block.x, block.y, block.z], 1.18)) {
        if (
          neighbor.id !== block.id &&
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
