import {
  StorageBufferAttribute,
  type ComputeNode,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  Fn,
  If,
  element,
  instanceIndex,
  invocationLocalIndex,
  storage,
  uint,
  workgroupArray,
  workgroupBarrier,
  workgroupId,
} from 'three/tsl';
import type ArrayNode from 'three/src/nodes/core/ArrayNode.js';

export const GPU_SCAN_BLOCK_SIZE = 128;

export interface ExclusiveScanReference {
  readonly offsets: Uint32Array;
  readonly total: number;
}

export interface GpuExclusiveScan {
  readonly count: number;
  readonly offsets: StorageBufferAttribute;
  readonly total: StorageBufferAttribute;
  readonly levelCount: number;
  execute(renderer: WebGPURenderer): Promise<void>;
  dispose(): void;
}

interface ScanLevel {
  readonly count: number;
  readonly blockCount: number;
  readonly offsets: StorageBufferAttribute;
  readonly blockTotals: StorageBufferAttribute;
  readonly scanBlocks: ComputeNode;
  addBlockOffsets?: ComputeNode;
}

export function exclusiveScanReference(
  values: readonly number[],
): ExclusiveScanReference {
  const offsets = new Uint32Array(values.length);
  let total = 0;

  values.forEach((value, index) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        'Exclusive-scan inputs must be non-negative integers.',
      );
    }
    if (total + value > 0xffff_ffff) {
      throw new RangeError('Exclusive-scan total exceeds uint32 capacity.');
    }
    offsets[index] = total;
    total += value;
  });

  return { offsets, total };
}

function createScanLevel(
  input: StorageBufferAttribute,
  count: number,
  levelIndex: number,
): ScanLevel {
  const blockCount = Math.ceil(count / GPU_SCAN_BLOCK_SIZE);
  const offsets = new StorageBufferAttribute(new Uint32Array(count), 1);
  offsets.name = `Exclusive scan level ${levelIndex} offsets`;
  const blockTotals = new StorageBufferAttribute(
    new Uint32Array(blockCount),
    1,
  );
  blockTotals.name = `Exclusive scan level ${levelIndex} block totals`;
  const inputStorage = storage(input, 'uint', count).toReadOnly();
  const offsetStorage = storage(offsets, 'uint', count);
  const totalStorage = storage(blockTotals, 'uint', blockCount);
  const shared = workgroupArray('uint', GPU_SCAN_BLOCK_SIZE);
  const sharedArray = shared as unknown as ArrayNode<'uint'>;

  const scanBlocks = Fn(() => {
    const localIndex = invocationLocalIndex;
    const value = uint(0).toVar();
    If(instanceIndex.lessThan(count), () => {
      value.assign(inputStorage.element(instanceIndex));
    });
    element(sharedArray, localIndex).assign(value);
    workgroupBarrier();

    for (let stride = 1; stride < GPU_SCAN_BLOCK_SIZE; stride *= 2) {
      const sharedIndex = localIndex
        .add(1)
        .mul(stride * 2)
        .sub(1);
      If(sharedIndex.lessThan(GPU_SCAN_BLOCK_SIZE), () => {
        element(sharedArray, sharedIndex).addAssign(
          element(sharedArray, sharedIndex.sub(stride)),
        );
      });
      workgroupBarrier();
    }

    If(localIndex.equal(0), () => {
      totalStorage
        .element(workgroupId.x)
        .assign(element(sharedArray, GPU_SCAN_BLOCK_SIZE - 1));
      element(sharedArray, GPU_SCAN_BLOCK_SIZE - 1).assign(0);
    });
    workgroupBarrier();

    for (let stride = GPU_SCAN_BLOCK_SIZE / 2; stride >= 1; stride /= 2) {
      const sharedIndex = localIndex
        .add(1)
        .mul(stride * 2)
        .sub(1);
      If(sharedIndex.lessThan(GPU_SCAN_BLOCK_SIZE), () => {
        const left = element(sharedArray, sharedIndex.sub(stride)).toVar();
        element(sharedArray, sharedIndex.sub(stride)).assign(
          element(sharedArray, sharedIndex),
        );
        element(sharedArray, sharedIndex).addAssign(left);
      });
      workgroupBarrier();
    }

    If(instanceIndex.lessThan(count), () => {
      offsetStorage
        .element(instanceIndex)
        .assign(element(sharedArray, localIndex));
    });
  })().compute(count, [GPU_SCAN_BLOCK_SIZE, 1, 1]);

  return { count, blockCount, offsets, blockTotals, scanBlocks };
}

function createAddBlockOffsetsPass(
  level: ScanLevel,
  parentOffsets: StorageBufferAttribute,
): ComputeNode {
  const offsets = storage(level.offsets, 'uint', level.count);
  const parents = storage(parentOffsets, 'uint', level.blockCount).toReadOnly();

  return Fn(() => {
    If(instanceIndex.lessThan(level.count), () => {
      offsets
        .element(instanceIndex)
        .addAssign(parents.element(instanceIndex.div(GPU_SCAN_BLOCK_SIZE)));
    });
  })().compute(level.count, [GPU_SCAN_BLOCK_SIZE, 1, 1]);
}

export function createGpuExclusiveScan(
  input: StorageBufferAttribute,
): GpuExclusiveScan {
  const count = input.count;
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError('GPU exclusive scan requires at least one value.');
  }

  const levels: ScanLevel[] = [];
  let levelInput = input;
  let levelCount = count;
  while (true) {
    const level = createScanLevel(levelInput, levelCount, levels.length);
    levels.push(level);
    if (level.blockCount === 1) {
      break;
    }
    levelInput = level.blockTotals;
    levelCount = level.blockCount;
  }

  for (let index = levels.length - 2; index >= 0; index -= 1) {
    const level = levels[index]!;
    const parent = levels[index + 1]!;
    level.addBlockOffsets = createAddBlockOffsetsPass(level, parent.offsets);
  }

  const first = levels[0]!;
  const last = levels.at(-1)!;
  return {
    count,
    offsets: first.offsets,
    total: last.blockTotals,
    levelCount: levels.length,
    async execute(renderer) {
      for (const level of levels) {
        await renderer.computeAsync(level.scanBlocks);
      }
      for (let index = levels.length - 2; index >= 0; index -= 1) {
        await renderer.computeAsync(levels[index]!.addBlockOffsets!);
      }
    },
    dispose() {
      levels.forEach((level) => {
        level.scanBlocks.dispose();
        level.addBlockOffsets?.dispose();
      });
    },
  };
}
