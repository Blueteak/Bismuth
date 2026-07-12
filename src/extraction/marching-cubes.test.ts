import { describe, expect, it } from 'vitest';
import {
  MARCHING_CUBES_CORNER_OFFSETS,
  MARCHING_CUBES_EDGE_CORNERS,
  classifyMarchingCubesCell,
  interpolateMarchingCubesEdge,
  isActiveMarchingCubesCase,
  marchingCubesCellCount,
  marchingCubesCellShape,
  marchingCubesTriangleCount,
  marchingCubesTriangleEdges,
} from './marching-cubes';

describe('marching-cubes classification', () => {
  it('uses the standard eight-corner order', () => {
    expect(MARCHING_CUBES_CORNER_OFFSETS).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ]);
  });

  it('uses the standard edge order and outward triangle winding', () => {
    expect(MARCHING_CUBES_EDGE_CORNERS).toHaveLength(12);
    expect(marchingCubesTriangleEdges(1)).toEqual([0, 3, 8]);
    expect(marchingCubesTriangleEdges(153)).toEqual([0, 2, 4, 4, 2, 6]);
    expect(marchingCubesTriangleEdges(255)).toEqual([]);
  });

  it('interpolates an analytic plane edge in physical coordinates', () => {
    const samples = [3 / 7, 4 / 7, 4 / 7, 3 / 7, 3 / 7, 4 / 7, 4 / 7, 3 / 7];
    expect(interpolateMarchingCubesEdge([10, 20, 30], 2, samples, 0)).toEqual([
      11, 20, 30,
    ]);
    expect(() =>
      interpolateMarchingCubesEdge([0, 0, 0], 1, Array(8).fill(0.5), 0),
    ).toThrow(RangeError);
  });

  it('classifies empty, full, and threshold-inclusive cells', () => {
    expect(classifyMarchingCubesCell(Array(8).fill(1))).toBe(0);
    expect(classifyMarchingCubesCell(Array(8).fill(0))).toBe(255);
    expect(classifyMarchingCubesCell([0.5, 1, 1, 1, 1, 1, 1, 1])).toBe(1);
  });

  it('classifies an x-normal plane with the solid side at negative x', () => {
    expect(classifyMarchingCubesCell([0, 1, 1, 0, 0, 1, 1, 0])).toBe(153);
  });

  it('identifies only intersected cells as active', () => {
    expect(isActiveMarchingCubesCase(0)).toBe(false);
    expect(isActiveMarchingCubesCase(153)).toBe(true);
    expect(isActiveMarchingCubesCase(255)).toBe(false);
  });

  it('uses the canonical triangle count for every case', () => {
    expect(marchingCubesTriangleCount(0)).toBe(0);
    expect(marchingCubesTriangleCount(1)).toBe(1);
    expect(marchingCubesTriangleCount(3)).toBe(2);
    expect(marchingCubesTriangleCount(61)).toBe(5);
    expect(marchingCubesTriangleCount(153)).toBe(2);
    expect(marchingCubesTriangleCount(250)).toBe(4);
    expect(marchingCubesTriangleCount(255)).toBe(0);
    for (let caseIndex = 0; caseIndex < 256; caseIndex += 1) {
      expect(marchingCubesTriangleCount(caseIndex)).toBeGreaterThanOrEqual(0);
      expect(marchingCubesTriangleCount(caseIndex)).toBeLessThanOrEqual(5);
    }
    expect(() => marchingCubesTriangleCount(256)).toThrow(RangeError);
  });

  it('derives cell dimensions from voxel dimensions', () => {
    expect(marchingCubesCellShape([4, 5, 6])).toEqual([3, 4, 5]);
    expect(marchingCubesCellCount([4, 5, 6])).toBe(60);
    expect(() => marchingCubesCellShape([1, 4, 4])).toThrow(RangeError);
  });

  it('rejects malformed or non-finite input', () => {
    expect(() => classifyMarchingCubesCell([0, 1])).toThrow(RangeError);
    expect(() =>
      classifyMarchingCubesCell([0, 0, 0, 0, 0, 0, 0, Number.NaN]),
    ).toThrow(RangeError);
    expect(() => classifyMarchingCubesCell(Array(8).fill(0), Infinity)).toThrow(
      RangeError,
    );
  });
});
