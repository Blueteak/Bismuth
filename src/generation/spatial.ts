import type { Bounds3, CrystalBlock } from './types';

export function cellKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
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

