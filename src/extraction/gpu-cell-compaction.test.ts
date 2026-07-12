import { describe, expect, it } from 'vitest';
import { compactActiveCellsReference } from './gpu-cell-compaction';

describe('active-cell compaction reference', () => {
  it('scatters active source indices in stable order', () => {
    const result = compactActiveCellsReference([0, 1, 0, 1, 1, 0]);
    expect(Array.from(result.offsets)).toEqual([0, 0, 1, 1, 2, 3]);
    expect(Array.from(result.indices)).toEqual([1, 3, 4]);
  });

  it('supports empty output and validates binary flags', () => {
    expect(compactActiveCellsReference([0, 0]).indices).toHaveLength(0);
    expect(() => compactActiveCellsReference([0, 2])).toThrow(RangeError);
  });
});
