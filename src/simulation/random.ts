import type { Vec3 } from './config';

export interface PerturbationSignature {
  readonly phases: readonly [number, number, number, number];
  readonly weights: readonly [number, number, number, number];
  readonly normalization: number;
}

const TWO_PI = 2 * Math.PI;
const SIGNATURE_WEIGHTS = [1, 0.73, 0.51, 0.37] as const;

function uint32(value: number): number {
  return value >>> 0;
}

/** Stable Mulberry32 output in [0, 1). */
export function createDeterministicRandom(seed: number): () => number {
  let state = uint32(seed);

  return () => {
    state = uint32(state + 0x6d2b_79f5);
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return uint32(mixed ^ (mixed >>> 14)) / 0x1_0000_0000;
  };
}

export function createPerturbationSignature(
  seed: number,
): PerturbationSignature {
  const random = createDeterministicRandom(seed);
  const weights: PerturbationSignature['weights'] = [...SIGNATURE_WEIGHTS];
  const weightSum = weights.reduce((sum, weight) => sum + Math.abs(weight), 0);

  return {
    phases: [
      random() * TWO_PI,
      random() * TWO_PI,
      random() * TWO_PI,
      random() * TWO_PI,
    ],
    weights,
    normalization: 1 / weightSum,
  };
}

/**
 * Smooth deterministic four-mode field bounded to [-1, 1]. Position and
 * correlation length are expressed in the same physical units.
 */
export function correlatedPerturbation(
  position: Vec3,
  correlationLength: number,
  signature: PerturbationSignature,
): number {
  if (!Number.isFinite(correlationLength) || correlationLength <= 0) {
    throw new RangeError('correlationLength must be a finite positive number.');
  }

  const sx = position[0] / correlationLength;
  const sy = position[1] / correlationLength;
  const sz = position[2] / correlationLength;
  const { phases, weights } = signature;
  const sum =
    weights[0] * Math.sin(sx + 0.73 * sy + 0.37 * sz + phases[0]) +
    weights[1] * Math.sin(sy - 0.61 * sz + 0.19 * sx + phases[1]) +
    weights[2] * Math.sin(sz + 0.53 * sx - 0.29 * sy + phases[2]) +
    weights[3] * Math.sin(sx - 0.47 * sy + 0.83 * sz + phases[3]);

  return sum * signature.normalization;
}
