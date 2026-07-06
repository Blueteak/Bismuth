import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import { localCellKey } from './spatial';
import { baseGenerationSettings } from './testSettings';

describe('generateCrystal model invariants', () => {
  it('keeps model bounds finite and triangle estimates under the standard budget', () => {
    const { model } = generateCrystal(baseGenerationSettings);

    expect(model.stats.blockCount).toBeGreaterThan(0);
    expect(model.stats.triangleCountEstimate).toBeLessThan(200_000);
    for (const value of [...model.bounds.min, ...model.bounds.max]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(model.bounds.min[0]).toBeLessThan(model.bounds.max[0]);
    expect(model.bounds.min[1]).toBeLessThan(model.bounds.max[1]);
    expect(model.bounds.min[2]).toBeLessThan(model.bounds.max[2]);
  });

  it('does not leave unsupported terminal voxels near the top of each nucleus', () => {
    const { model } = generateCrystal(baseGenerationSettings);
    const occupied = new Set(model.blocks.map((block) => localCellKey(block.nucleusId, block.local)));
    const maxLayerByNucleus = new Map<number, number>();

    for (const block of model.blocks) {
      maxLayerByNucleus.set(
        block.nucleusId,
        Math.max(maxLayerByNucleus.get(block.nucleusId) ?? Number.NEGATIVE_INFINITY, block.local[1]),
      );
    }

    for (const block of model.blocks) {
      if (
        block.stage === 'seed' ||
        block.local[1] < (maxLayerByNucleus.get(block.nucleusId) ?? block.local[1]) - 2
      ) {
        continue;
      }

      const horizontalNeighbors = [
        localCellKey(block.nucleusId, [block.local[0] + 1, block.local[1], block.local[2]]),
        localCellKey(block.nucleusId, [block.local[0] - 1, block.local[1], block.local[2]]),
        localCellKey(block.nucleusId, [block.local[0], block.local[1], block.local[2] + 1]),
        localCellKey(block.nucleusId, [block.local[0], block.local[1], block.local[2] - 1]),
      ].filter((key) => occupied.has(key)).length;
      const hasAbove = occupied.has(
        localCellKey(block.nucleusId, [block.local[0], block.local[1] + 1, block.local[2]]),
      );

      if (!hasAbove) {
        expect(horizontalNeighbors).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
