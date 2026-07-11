import { describe, expect, it } from 'vitest';
import {
  validateEnvironmentPreset,
  type EnvironmentPreset,
} from './environment-preset';

const validPreset: EnvironmentPreset = {
  id: 'initial-studio',
  hdriUrl: '/assets/hdri.jpg',
  environmentRotation: 0,
  exposure: 1,
  sunDirection: [3, 5, 4],
  sunIntensity: 2.5,
  sunColor: '#fff4e8',
};

describe('validateEnvironmentPreset', () => {
  it('accepts a complete coherent preset', () => {
    expect(validateEnvironmentPreset(validPreset)).toBe(validPreset);
  });

  it.each([
    { ...validPreset, exposure: 0 },
    { ...validPreset, sunIntensity: -1 },
    { ...validPreset, sunDirection: [0, 0, 0] as const },
    { ...validPreset, sunColor: 'white' },
  ])('rejects invalid lighting data', (preset) => {
    expect(() => validateEnvironmentPreset(preset)).toThrow();
  });
});
