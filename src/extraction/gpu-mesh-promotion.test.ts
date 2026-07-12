import { describe, expect, it } from 'vitest';
import { promotedIndirectArgumentsReference } from './gpu-mesh-promotion';

describe('last-valid mesh promotion reference', () => {
  it('publishes a complete candidate', () => {
    expect(
      promotedIndirectArgumentsReference([0, 1, 0, 0], [294, 294, 0, 98]),
    ).toEqual([294, 1, 0, 0]);
  });

  it('retains the prior draw on overflow', () => {
    expect(
      promotedIndirectArgumentsReference([294, 1, 0, 0], [294, 291, 1, 98]),
    ).toEqual([294, 1, 0, 0]);
    expect(() =>
      promotedIndirectArgumentsReference([0, 1, 0, 0], [1, 2, 3]),
    ).toThrow(RangeError);
  });
});
