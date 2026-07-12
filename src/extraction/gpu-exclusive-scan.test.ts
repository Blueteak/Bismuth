import { describe, expect, it } from 'vitest';
import { exclusiveScanReference } from './gpu-exclusive-scan';

describe('exclusive scan reference', () => {
  it('returns exclusive offsets and the total', () => {
    const result = exclusiveScanReference([0, 2, 0, 5, 1]);
    expect(Array.from(result.offsets)).toEqual([0, 0, 2, 2, 7]);
    expect(result.total).toBe(8);
  });

  it('handles empty and all-zero inputs', () => {
    expect(exclusiveScanReference([])).toEqual({
      offsets: new Uint32Array(),
      total: 0,
    });
    expect(Array.from(exclusiveScanReference([0, 0, 0]).offsets)).toEqual([
      0, 0, 0,
    ]);
  });

  it('rejects invalid inputs and uint32 overflow', () => {
    expect(() => exclusiveScanReference([1, -1])).toThrow(RangeError);
    expect(() => exclusiveScanReference([1.5])).toThrow(RangeError);
    expect(() => exclusiveScanReference([0xffff_ffff, 1])).toThrow(RangeError);
  });
});
