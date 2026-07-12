import {
  StorageBufferAttribute,
  type ComputeNode,
  type WebGPURenderer,
} from 'three/webgpu';
import { Fn, If, instanceIndex, storage } from 'three/tsl';
import {
  GPU_SCAN_BLOCK_SIZE,
  createGpuExclusiveScan,
  exclusiveScanReference,
  type GpuExclusiveScan,
} from './gpu-exclusive-scan';
import type { GpuCellClassification } from './marching-cubes';

export interface ActiveCellCompactionReference {
  readonly indices: Uint32Array;
  readonly offsets: Uint32Array;
}

export interface GpuCellCompaction {
  readonly activeScan: GpuExclusiveScan;
  readonly triangleScan: GpuExclusiveScan;
  readonly compactedActiveCells: StorageBufferAttribute;
  readonly scatterActiveCells: ComputeNode;
  execute(renderer: WebGPURenderer): Promise<void>;
  dispose(): void;
}

export function compactActiveCellsReference(
  activeFlags: readonly number[],
): ActiveCellCompactionReference {
  activeFlags.forEach((flag) => {
    if (flag !== 0 && flag !== 1) {
      throw new RangeError('Active-cell flags must be 0 or 1.');
    }
  });
  const scan = exclusiveScanReference(activeFlags);
  const indices = new Uint32Array(scan.total);
  activeFlags.forEach((flag, cellIndex) => {
    if (flag === 1) {
      indices[scan.offsets[cellIndex]!] = cellIndex;
    }
  });
  return { indices, offsets: scan.offsets };
}

export function createGpuCellCompaction(
  classification: GpuCellClassification,
): GpuCellCompaction {
  const activeScan = createGpuExclusiveScan(classification.activeFlags);
  const triangleScan = createGpuExclusiveScan(classification.triangleCounts);
  const compactedActiveCells = new StorageBufferAttribute(
    new Uint32Array(classification.cellCount),
    1,
  );
  compactedActiveCells.name = 'Compacted marching-cubes active-cell indices';
  const flags = storage(
    classification.activeFlags,
    'uint',
    classification.cellCount,
  ).toReadOnly();
  const offsets = storage(
    activeScan.offsets,
    'uint',
    classification.cellCount,
  ).toReadOnly();
  const compacted = storage(
    compactedActiveCells,
    'uint',
    classification.cellCount,
  );

  const scatterActiveCells = Fn(() => {
    If(flags.element(instanceIndex).equal(1), () => {
      compacted.element(offsets.element(instanceIndex)).assign(instanceIndex);
    });
  })().compute(classification.cellCount, [GPU_SCAN_BLOCK_SIZE, 1, 1]);

  return {
    activeScan,
    triangleScan,
    compactedActiveCells,
    scatterActiveCells,
    async execute(renderer) {
      await activeScan.execute(renderer);
      await triangleScan.execute(renderer);
      await renderer.computeAsync(scatterActiveCells);
    },
    dispose() {
      activeScan.dispose();
      triangleScan.dispose();
      scatterActiveCells.dispose();
    },
  };
}
