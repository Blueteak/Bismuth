import { describe, expect, it } from 'vitest';

import {
  CANDIDATE2D_EDGE_MORPHOLOGY_CARRIER,
  candidate2DEdgeMorphologyAnalyticVolume,
  candidate2DEdgeMorphologyLevel,
  createCandidate2DEdgeMorphologySnapshot,
} from './candidate2d-edge-morphology';
import { runCandidate2DEdgeSourceDiscriminator } from './candidate2d-edge-source';

function solidComponentCount(
  values: Float32Array,
  shape: readonly [number, number, number],
): number {
  const visited = new Uint8Array(values.length);
  const [width, height, depth] = shape;
  const neighbors = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
  ] as const;
  let components = 0;
  for (let start = 0; start < values.length; start += 1) {
    if ((values[start] ?? -1) <= 0 || visited[start] === 1) continue;
    components += 1;
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      const x = index % width;
      const yz = Math.floor(index / width);
      const y = yz % height;
      const z = Math.floor(yz / height);
      for (const [dx, dy, dz] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (
          nx < 0 ||
          nx >= width ||
          ny < 0 ||
          ny >= height ||
          nz < 0 ||
          nz >= depth
        ) {
          continue;
        }
        const neighbor = nx + width * (ny + height * nz);
        if ((values[neighbor] ?? -1) > 0 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
  }
  return components;
}

describe('Candidate 2D edge-source 3D carrier', () => {
  it('contains only the connected swept front and leaves failed controls empty', () => {
    const result = runCandidate2DEdgeSourceDiscriminator();
    const snapshot = createCandidate2DEdgeMorphologySnapshot(result.forward);
    const carrier = CANDIDATE2D_EDGE_MORPHOLOGY_CARRIER;
    const sampledVolume =
      snapshot.orderParameter.reduce((sum, value) => sum + (value + 1) / 2, 0) *
      carrier.spacing ** 3;
    const analyticVolume = candidate2DEdgeMorphologyAnalyticVolume(
      result.forward,
    );

    expect(analyticVolume).toBeCloseTo(
      result.forward.integratedSolidVolume,
      12,
    );
    expect(
      Math.abs(sampledVolume - analyticVolume) / analyticVolume,
    ).toBeLessThan(0.08);
    expect(solidComponentCount(snapshot.orderParameter, snapshot.shape)).toBe(
      1,
    );
    expect(
      candidate2DEdgeMorphologyLevel(result.forward, [0, -0.6, 0]),
    ).toBeLessThan(0);
    expect(
      candidate2DEdgeMorphologyLevel(result.forward, [0.7, 0.7, 1.2]),
    ).toBeGreaterThan(0);

    for (const emptyState of [
      result.noSeed,
      result.contactOffSurface,
      result.zeroDriving,
      result.reversed,
    ]) {
      const empty = createCandidate2DEdgeMorphologySnapshot(emptyState);
      expect(empty.orderParameter.every((value) => value === -1)).toBe(true);
      expect(candidate2DEdgeMorphologyAnalyticVolume(emptyState)).toBe(0);
    }
  });
});
