import type { Bounds3, CrystalBlock } from './types';

const spatialHashCellSize = 1.15;

export function cellKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

export function localCellKey(nucleusId: number, local: readonly number[]) {
  return `${nucleusId}:${local[0]},${local[1]},${local[2]}`;
}

export function spatialHashKey(x: number, y: number, z: number) {
  return cellKey(
    Math.floor(x / spatialHashCellSize),
    Math.floor(y / spatialHashCellSize),
    Math.floor(z / spatialHashCellSize),
  );
}

export function createSpatialIndex(blocks: readonly CrystalBlock[] = []) {
  const index = new Map<string, CrystalBlock[]>();

  for (const block of blocks) {
    addBlockToSpatialIndex(index, block);
  }

  return index;
}

export function addBlockToSpatialIndex(
  index: Map<string, CrystalBlock[]>,
  block: CrystalBlock,
) {
  const key = spatialHashKey(block.x, block.y, block.z);
  const bucket = index.get(key) ?? [];
  bucket.push(block);
  index.set(key, bucket);
}

export function getNearbyBlocks(
  index: Map<string, CrystalBlock[]>,
  position: readonly number[],
  radius: number,
) {
  const blocks: CrystalBlock[] = [];
  const minX = Math.floor((position[0] - radius) / spatialHashCellSize);
  const maxX = Math.floor((position[0] + radius) / spatialHashCellSize);
  const minY = Math.floor((position[1] - radius) / spatialHashCellSize);
  const maxY = Math.floor((position[1] + radius) / spatialHashCellSize);
  const minZ = Math.floor((position[2] - radius) / spatialHashCellSize);
  const maxZ = Math.floor((position[2] + radius) / spatialHashCellSize);
  const radiusSquared = radius * radius;

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const bucket = index.get(cellKey(x, y, z));
        if (!bucket) {
          continue;
        }

        for (const block of bucket) {
          const distanceSquared =
            (block.x - position[0]) ** 2 +
            (block.y - position[1]) ** 2 +
            (block.z - position[2]) ** 2;

          if (distanceSquared <= radiusSquared) {
            blocks.push(block);
          }
        }
      }
    }
  }

  return blocks;
}

export function createEmptyBounds(): Bounds3 {
  return {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  };
}

export function extendBounds(bounds: Bounds3, block: CrystalBlock) {
  const half = block.size / 2;
  bounds.min[0] = Math.min(bounds.min[0], block.x - half);
  bounds.min[1] = Math.min(bounds.min[1], block.y - half);
  bounds.min[2] = Math.min(bounds.min[2], block.z - half);
  bounds.max[0] = Math.max(bounds.max[0], block.x + half);
  bounds.max[1] = Math.max(bounds.max[1], block.y + half);
  bounds.max[2] = Math.max(bounds.max[2], block.z + half);
}

export function cloneBounds(bounds: Bounds3): Bounds3 {
  return {
    min: bounds.min.map((value) => Number(value.toFixed(4))) as [number, number, number],
    max: bounds.max.map((value) => Number(value.toFixed(4))) as [number, number, number],
  };
}

export function chunkBlocks(blocks: CrystalBlock[], chunkSize: number) {
  const chunks: CrystalBlock[][] = [];
  for (let index = 0; index < blocks.length; index += chunkSize) {
    chunks.push(blocks.slice(index, index + chunkSize));
  }

  return chunks;
}
