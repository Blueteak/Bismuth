import { describe, expect, it } from 'vitest';
import {
  interpolateSurfaceAge,
  planVertexEmission,
} from './gpu-vertex-emission';

describe('vertex-emission capacity planning', () => {
  it('reports a complete bounded emission', () => {
    expect(planVertexEmission(98, 294)).toEqual({
      requestedVertexCount: 294,
      emittedVertexCount: 294,
      overflow: false,
    });
  });

  it('clamps only at triangle boundaries and reports overflow', () => {
    expect(planVertexEmission(98, 291)).toEqual({
      requestedVertexCount: 294,
      emittedVertexCount: 291,
      overflow: true,
    });
    expect(() => planVertexEmission(1, 4)).toThrow(RangeError);
    expect(() => planVertexEmission(-1, 3)).toThrow(RangeError);
  });

  it('interpolates valid birth times and ignores the liquid sentinel', () => {
    expect(interpolateSurfaceAge(2, 4, 0.25, 10)).toBe(7.5);
    expect(interpolateSurfaceAge(2, -1, 0.5, 10)).toBe(8);
    expect(interpolateSurfaceAge(-1, 4, 0.5, 10)).toBe(6);
    expect(interpolateSurfaceAge(-1, -1, 0.5, 10)).toBe(0);
  });
});
