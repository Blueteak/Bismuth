import { describe, expect, it } from 'vitest';
import {
  evaluateLiveExtractionSamples,
  planLiveExtractionCheckpoints,
  type LiveExtractionSample,
} from './live-extraction-validation';

const sample = (
  stepCount: number,
  vertexCount: number,
  extractionMilliseconds: number,
  overflow = false,
): LiveExtractionSample => ({
  stepCount,
  simulatedTime: stepCount * 0.01,
  vertexCount,
  triangleCount: vertexCount / 3,
  overflow,
  extractionMilliseconds,
});

describe('live extraction validation', () => {
  it('plans evenly distributed checkpoints on one solver texture parity', () => {
    expect(planLiveExtractionCheckpoints(50_000)).toEqual([
      10_000, 20_000, 30_000, 40_000, 50_000,
    ]);
    expect(planLiveExtractionCheckpoints(8, 5)).toEqual([2, 4, 6, 8]);
    expect(() => planLiveExtractionCheckpoints(9)).toThrow(/must be even/);
  });

  it('separates the first sample from warm cadence and accepts mesh tracking', () => {
    const result = evaluateLiveExtractionSamples(
      [
        sample(10_000, 24_000, 520),
        sample(20_000, 36_000, 126),
        sample(30_000, 51_000, 118),
        sample(40_000, 72_000, 124),
        sample(50_000, 96_000, 120),
      ],
      50_000,
    );

    expect(result).toEqual({
      cadence: {
        firstSampleMilliseconds: 520,
        warmSampleCount: 4,
        warmMinimumMilliseconds: 118,
        warmMedianMilliseconds: 122,
        warmMaximumMilliseconds: 126,
      },
      distinctVertexCounts: 5,
      failures: [],
      passed: true,
    });
  });

  it.each([
    [
      'overflow',
      [sample(10_000, 24_000, 500), sample(20_000, 36_000, 120, true)],
      'sample 2 must not overflow',
    ],
    [
      'stale mesh',
      [sample(10_000, 24_000, 500), sample(20_000, 24_000, 120)],
      'repeated extraction must observe at least two distinct promoted meshes',
    ],
    [
      'wrong final step',
      [sample(10_000, 24_000, 500), sample(20_000, 36_000, 120)],
      'the final extraction sample must match the requested final step',
    ],
  ] as const)(
    'rejects a repeated-extraction %s failure',
    (_name, samples, failure) => {
      const result = evaluateLiveExtractionSamples(samples, 30_000);
      expect(result.passed).toBe(false);
      expect(result.failures).toContain(failure);
    },
  );
});
