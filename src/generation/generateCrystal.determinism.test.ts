import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import { baseGenerationSettings } from './testSettings';

describe('generateCrystal determinism', () => {
  it('generates byte-stable output for identical settings', () => {
    const first = generateCrystal(baseGenerationSettings);
    const second = generateCrystal(baseGenerationSettings);

    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
  });

  it('changes the model hash and block layout for a different seed', () => {
    const first = generateCrystal(baseGenerationSettings);
    const second = generateCrystal({
      ...baseGenerationSettings,
      seed: 'BI-TEST-002',
    });

    expect(second.model.settingsHash).not.toEqual(first.model.settingsHash);
    expect(second.model.blocks.map(({ x, y, z }) => [x, y, z])).not.toEqual(
      first.model.blocks.map(({ x, y, z }) => [x, y, z]),
    );
  });
});
