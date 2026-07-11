import { describe, expect, it } from 'vitest';
import {
  correlatedPerturbation,
  createDeterministicRandom,
  createPerturbationSignature,
} from './random';

describe('deterministic perturbations', () => {
  it('repeats the same random stream and signature for a fixed seed', () => {
    const first = createDeterministicRandom(42);
    const second = createDeterministicRandom(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
    expect(createPerturbationSignature(42)).toEqual(
      createPerturbationSignature(42),
    );
    expect(createPerturbationSignature(42).phases).not.toEqual(
      createPerturbationSignature(43).phases,
    );
  });

  it('keeps the smooth Fourier field bounded and continuous', () => {
    const signature = createPerturbationSignature(1234);
    expect(
      signature.weights.reduce((sum, weight) => sum + Math.abs(weight), 0) *
        signature.normalization,
    ).toBe(1);
    let maximumMagnitude = 0;
    for (let z = -8; z <= 8; z += 1) {
      for (let y = -8; y <= 8; y += 1) {
        for (let x = -8; x <= 8; x += 1) {
          maximumMagnitude = Math.max(
            maximumMagnitude,
            Math.abs(correlatedPerturbation([x, y, z], 3.5, signature)),
          );
        }
      }
    }
    expect(maximumMagnitude).toBeLessThanOrEqual(1 + Number.EPSILON);

    const atPoint = correlatedPerturbation([1, 2, 3], 4, signature);
    const nearby = correlatedPerturbation(
      [1.000_001, 2.000_001, 3.000_001],
      4,
      signature,
    );
    expect(Math.abs(nearby - atPoint)).toBeLessThan(1e-5);
  });

  it('keeps the strict amplitude bound for extreme seeds and coordinates', () => {
    for (const seed of [0, 1, 0x7fff_ffff, 0xffff_ffff]) {
      const signature = createPerturbationSignature(seed);
      expect(
        signature.phases.every((phase) => phase >= 0 && phase < 2 * Math.PI),
      ).toBe(true);

      for (const position of [
        [0, 0, 0],
        [1e6, -1e6, 1e-6],
        [-1234.5, 6789.25, -0.125],
      ] as const) {
        expect(
          Math.abs(correlatedPerturbation(position, 0.125, signature)),
        ).toBeLessThanOrEqual(1 + Number.EPSILON);
      }
    }
  });

  it('validates the correlation length', () => {
    const signature = createPerturbationSignature(1);
    expect(() => correlatedPerturbation([0, 0, 0], 0, signature)).toThrow(
      /correlationLength/,
    );
  });
});
