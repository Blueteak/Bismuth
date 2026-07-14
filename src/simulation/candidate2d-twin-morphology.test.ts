import { describe, expect, it } from 'vitest';

import {
  CANDIDATE2D_TWIN_MORPHOLOGY_CARRIER,
  candidate2DTwinMorphologyAnalyticVolume,
  candidate2DTwinMorphologyLevel,
  createCandidate2DTwinMorphologySnapshot,
} from './candidate2d-twin-morphology';
import {
  CANDIDATE2D_TWIN_SOURCE_PROOF,
  createCandidate2DTwinSourceState,
  runCandidate2DTwinSourceDiscriminator,
} from './candidate2d-twin-source';

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

describe('Candidate 2D twin-source 3D carrier', () => {
  it('renders only the exact connected one-front volume and leaves null arms empty', () => {
    const result = runCandidate2DTwinSourceDiscriminator();
    const snapshot = createCandidate2DTwinMorphologySnapshot(result.forward);
    const carrier = CANDIDATE2D_TWIN_MORPHOLOGY_CARRIER;
    const sampledVolume =
      snapshot.orderParameter.reduce((sum, value) => sum + (value + 1) / 2, 0) *
      carrier.spacing ** 3;
    const analyticVolume = candidate2DTwinMorphologyAnalyticVolume(
      result.forward,
    );

    expect(result.forward.front?.complete).toBe(true);
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
    const growth = result.forward.front!.growthDirection;
    expect(
      candidate2DTwinMorphologyLevel(result.forward, [
        growth[0] * 0.5,
        growth[1] * 0.5,
        0,
      ]),
    ).toBeLessThan(0);
    expect(
      candidate2DTwinMorphologyLevel(result.forward, [1.2, 1.2, 1.1]),
    ).toBeGreaterThan(0);

    for (const emptyState of [
      result.noTwin,
      result.zeroDriving,
      result.reversed,
    ]) {
      const empty = createCandidate2DTwinMorphologySnapshot(emptyState);
      expect(empty.orderParameter.every((value) => value === -1)).toBe(true);
      expect(candidate2DTwinMorphologyAnalyticVolume(emptyState)).toBe(0);
    }

    const sourceOnly = createCandidate2DTwinSourceState(
      CANDIDATE2D_TWIN_SOURCE_PROOF.configuration,
    );
    expect(
      createCandidate2DTwinMorphologySnapshot(sourceOnly).orderParameter.every(
        (value) => value === -1,
      ),
    ).toBe(true);
  });
});
