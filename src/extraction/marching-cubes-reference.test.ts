import { describe, expect, it } from 'vitest';
import { extractMarchingCubesReference } from './marching-cubes-reference';
import type { ExtractionVec3, GridShape } from './marching-cubes';

const SHAPE: GridShape = [16, 16, 16];
const CENTER: ExtractionVec3 = [7.5, 7.5, 7.5];

function createField(sample: (x: number, y: number, z: number) => number) {
  const values = new Float32Array(SHAPE[0] * SHAPE[1] * SHAPE[2]);
  for (let z = 0; z < SHAPE[2]; z += 1) {
    for (let y = 0; y < SHAPE[1]; y += 1) {
      for (let x = 0; x < SHAPE[0]; x += 1) {
        values[x + SHAPE[0] * (y + SHAPE[1] * z)] = sample(x, y, z);
      }
    }
  }
  return values;
}

function key(position: ExtractionVec3): string {
  return position.map((value) => value.toFixed(5)).join(',');
}

function validateClosedConnectedOutward(
  positions: readonly ExtractionVec3[],
): void {
  expect(positions.length).toBeGreaterThan(0);
  expect(positions.length % 3).toBe(0);
  const edgeUse = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();

  for (let triangle = 0; triangle < positions.length / 3; triangle += 1) {
    const a = positions[triangle * 3]!;
    const b = positions[triangle * 3 + 1]!;
    const c = positions[triangle * 3 + 2]!;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ] as const;
    const centroid = [
      (a[0] + b[0] + c[0]) / 3 - CENTER[0],
      (a[1] + b[1] + c[1]) / 3 - CENTER[1],
      (a[2] + b[2] + c[2]) / 3 - CENTER[2],
    ] as const;
    expect(
      normal[0] * centroid[0] +
        normal[1] * centroid[1] +
        normal[2] * centroid[2],
    ).toBeGreaterThan(0);

    const vertices = [key(a), key(b), key(c)];
    for (let edge = 0; edge < 3; edge += 1) {
      const first = vertices[edge]!;
      const second = vertices[(edge + 1) % 3]!;
      const edgeKey = [first, second].sort().join('|');
      edgeUse.set(edgeKey, (edgeUse.get(edgeKey) ?? 0) + 1);
      const firstNeighbors = adjacency.get(first) ?? new Set<string>();
      firstNeighbors.add(second);
      adjacency.set(first, firstNeighbors);
      const secondNeighbors = adjacency.get(second) ?? new Set<string>();
      secondNeighbors.add(first);
      adjacency.set(second, secondNeighbors);
    }
  }

  expect([...edgeUse.values()].every((count) => count === 2)).toBe(true);
  const start = adjacency.keys().next().value as string;
  const visited = new Set([start]);
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        pending.push(neighbor);
      }
    }
  }
  expect(visited.size).toBe(adjacency.size);
}

describe('marching-cubes analytic topology reference', () => {
  it('extracts a closed connected sphere with outward winding', () => {
    const radius = 4;
    const field = createField((x, y, z) => {
      const distance = Math.hypot(x - CENTER[0], y - CENTER[1], z - CENTER[2]);
      return 0.5 + (distance - radius) * 0.1;
    });
    const mesh = extractMarchingCubesReference({
      field,
      shape: SHAPE,
      spacing: 1,
      physicalOrigin: [0, 0, 0],
    });
    validateClosedConnectedOutward(mesh.positions);
    const xs = mesh.positions.map((position) => position[0]);
    expect(Math.min(...xs)).toBeCloseTo(3.56, 1);
    expect(Math.max(...xs)).toBeCloseTo(11.44, 1);
  });

  it('extracts a closed connected faceted cube with exact bounds', () => {
    const radius = 4;
    const field = createField((x, y, z) => {
      const distance = Math.max(
        Math.abs(x - CENTER[0]),
        Math.abs(y - CENTER[1]),
        Math.abs(z - CENTER[2]),
      );
      return 0.5 + (distance - radius) * 0.1;
    });
    const mesh = extractMarchingCubesReference({
      field,
      shape: SHAPE,
      spacing: 1,
      physicalOrigin: [0, 0, 0],
    });
    validateClosedConnectedOutward(mesh.positions);
    for (let axis = 0; axis < 3; axis += 1) {
      const values = mesh.positions.map((position) => position[axis]!);
      expect(Math.min(...values)).toBeCloseTo(3.5, 6);
      expect(Math.max(...values)).toBeCloseTo(11.5, 6);
    }
  });
});
