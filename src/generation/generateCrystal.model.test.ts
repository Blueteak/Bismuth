import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
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
    const occupied = new Set(model.blocks.map((block) => `${block.x},${block.y},${block.z}`));
    const maxYByNucleus = new Map<number, number>();

    for (const block of model.blocks) {
      maxYByNucleus.set(
        block.nucleusId,
        Math.max(maxYByNucleus.get(block.nucleusId) ?? Number.NEGATIVE_INFINITY, block.y),
      );
    }

    for (const block of model.blocks) {
      if (block.stage === 'seed' || block.y < (maxYByNucleus.get(block.nucleusId) ?? block.y) - 2) {
        continue;
      }

      const horizontalNeighbors = [
        `${block.x + 1},${block.y},${block.z}`,
        `${block.x - 1},${block.y},${block.z}`,
        `${block.x},${block.y},${block.z + 1}`,
        `${block.x},${block.y},${block.z - 1}`,
      ].filter((key) => occupied.has(key)).length;
      const hasAbove = occupied.has(`${block.x},${block.y + 1},${block.z}`);

      if (!hasAbove) {
        expect(horizontalNeighbors).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
