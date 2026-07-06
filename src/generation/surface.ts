import type { SeededPrng } from './prng';
import type { CrystalBlock, CrystalFacet, GenerationSettings } from './types';
import { cellKey } from './spatial';

export function assignOxide(
  blocks: CrystalBlock[],
  settings: GenerationSettings,
  prng: SeededPrng,
) {
  const maxY = blocks.reduce((max, block) => Math.max(max, block.y), 0);

  for (const block of blocks) {
    const heightFactor = block.y / Math.max(1, maxY);
    const recessFactor = block.stage === 'face' ? 0.85 : block.stage === 'terrace' ? 1.05 : 1.18;
    const noise = prng.signed(settings.impurity * 38);
    block.oxideThickness = Number(
      (
        90 +
        settings.oxidationExposure * 520 +
        heightFactor * 120 +
        recessFactor * 42 +
        noise
      ).toFixed(3),
    );
  }
}

export function buildFacets(blocks: CrystalBlock[], occupied: Set<string>) {
  const facets: CrystalFacet[] = [];
  const normals: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  for (const block of blocks) {
    for (const normal of normals) {
      const neighborKey = cellKey(
        block.x + normal[0],
        block.y + normal[1],
        block.z + normal[2],
      );
      if (occupied.has(neighborKey)) {
        continue;
      }

      facets.push({
        id: facets.length + 1,
        blockId: block.id,
        normal,
        center: [
          Number((block.x + normal[0] * 0.5).toFixed(4)),
          Number((block.y + normal[1] * 0.5).toFixed(4)),
          Number((block.z + normal[2] * 0.5).toFixed(4)),
        ],
        oxideThickness: block.oxideThickness,
        area: Number((block.size * block.size).toFixed(4)),
      });
    }
  }

  return facets;
}

export function getOxideRange(blocks: CrystalBlock[]): [number, number] {
  if (blocks.length === 0) {
    return [0, 0];
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const block of blocks) {
    min = Math.min(min, block.oxideThickness);
    max = Math.max(max, block.oxideThickness);
  }

  return [Number(min.toFixed(3)), Number(max.toFixed(3))];
}

