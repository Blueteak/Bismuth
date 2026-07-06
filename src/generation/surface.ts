import { transformLocalDirection } from './math';
import type { SeededPrng } from './prng';
import type { CrystalBlock, CrystalFacet, GenerationSettings } from './types';
import { localCellKey } from './spatial';

export function assignOxide(
  blocks: CrystalBlock[],
  settings: GenerationSettings,
  prng: SeededPrng,
) {
  const maxLayer = blocks.reduce((max, block) => Math.max(max, block.local[1]), 0);

  for (const block of blocks) {
    const heightFactor = block.local[1] / Math.max(1, maxLayer);
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

export function buildFacets(blocks: CrystalBlock[]) {
  const facets: CrystalFacet[] = [];
  const normals: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const occupied = new Set(blocks.map((block) => localCellKey(block.nucleusId, block.local)));

  for (const block of blocks) {
    for (const normal of normals) {
      const neighborKey = localCellKey(
        block.nucleusId,
        [
          block.local[0] + normal[0],
          block.local[1] + normal[1],
          block.local[2] + normal[2],
        ],
      );
      if (occupied.has(neighborKey)) {
        continue;
      }

      const worldNormal = transformLocalDirection(block.basis, normal);
      facets.push({
        id: facets.length + 1,
        blockId: block.id,
        normal: worldNormal,
        center: [
          Number((block.x + worldNormal[0] * 0.5).toFixed(4)),
          Number((block.y + worldNormal[1] * 0.5).toFixed(4)),
          Number((block.z + worldNormal[2] * 0.5).toFixed(4)),
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
