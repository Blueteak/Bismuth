import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import type { GenerationSettings } from './types';

const baseSettings: GenerationSettings = {
  version: 1,
  seed: 'BI-TEST-001',
  nucleationCount: 2,
  nucleusStartDelay: 0.18,
  nucleiVerticalSpread: 0.28,
  initialSeedSize: 0.42,
  crystalScale: 1,
  symmetryBias: 0.72,
  coolingRate: 0.58,
  edgeGrowthBias: 0.74,
  faceFillRate: 0.34,
  terraceHeight: 0.46,
  hopperDepth: 0.68,
  branchingProbability: 0.18,
  impurity: 0.24,
  gravitySagBias: 0.12,
  oxidationExposure: 0.82,
  quality: 'standard',
};

describe('generateCrystal', () => {
  it('generates byte-stable output for identical settings', () => {
    const first = generateCrystal(baseSettings);
    const second = generateCrystal(baseSettings);

    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
  });

  it('changes the model hash and block layout for a different seed', () => {
    const first = generateCrystal(baseSettings);
    const second = generateCrystal({
      ...baseSettings,
      seed: 'BI-TEST-002',
    });

    expect(second.model.settingsHash).not.toEqual(first.model.settingsHash);
    expect(second.model.blocks.map(({ x, y, z }) => [x, y, z])).not.toEqual(
      first.model.blocks.map(({ x, y, z }) => [x, y, z]),
    );
  });

  it('keeps model bounds finite and triangle estimates under the standard budget', () => {
    const { model } = generateCrystal(baseSettings);

    expect(model.stats.blockCount).toBeGreaterThan(0);
    expect(model.stats.triangleCountEstimate).toBeLessThan(200_000);
    for (const value of [...model.bounds.min, ...model.bounds.max]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(model.bounds.min[0]).toBeLessThan(model.bounds.max[0]);
    expect(model.bounds.min[1]).toBeLessThan(model.bounds.max[1]);
    expect(model.bounds.min[2]).toBeLessThan(model.bounds.max[2]);
  });

  it('emits deterministic, monotonic progress and display timing', () => {
    const { events } = generateCrystal(baseSettings);

    expect(events[0].step).toBe('seed');
    expect(events.at(-1)?.step).toBe('complete');
    expect(events.at(-1)?.progress).toBe(1);

    for (let index = 1; index < events.length; index += 1) {
      expect(events[index].progress).toBeGreaterThanOrEqual(events[index - 1].progress);
      expect(events[index].displayTimeMs).toBeGreaterThanOrEqual(
        events[index - 1].displayTimeMs ?? 0,
      );
    }
  });

  it('co-grows multiple vertically distributed nuclei on one timeline', () => {
    const { model } = generateCrystal({
      ...baseSettings,
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
      ...baseSettings,
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
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;

    for (const block of model.blocks) {
      for (const [offsetX, offsetZ] of directions) {
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
      ...baseSettings,
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
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    let contactCount = 0;

    for (const block of model.blocks) {
      for (const [offsetX, offsetZ] of directions) {
        const neighbor = occupied.get(`${block.x + offsetX},${block.y},${block.z + offsetZ}`);
        if (neighbor && neighbor.nucleusId !== block.nucleusId) {
          contactCount += 1;
        }
      }
    }

    expect(contactCount).toBeGreaterThan(0);
  });

  it('does not leave unsupported terminal voxels near the top of each nucleus', () => {
    const { model } = generateCrystal(baseSettings);
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
