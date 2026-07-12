import {
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type ComputeNode,
  type WebGPURenderer,
} from 'three/webgpu';
import { Fn, If, instanceIndex, storage, uvec4 } from 'three/tsl';
import type { GpuVertexEmission } from './gpu-vertex-emission';

export type DrawIndirectArguments = readonly [number, number, number, number];

export interface GpuMeshPromotion {
  readonly promote: ComputeNode;
  execute(renderer: WebGPURenderer): Promise<void>;
  dispose(): void;
}

export interface GpuLastValidMesh {
  readonly vertexCapacity: number;
  readonly positions: StorageBufferAttribute;
  readonly normalAge: StorageBufferAttribute;
  readonly indirect: IndirectStorageBufferAttribute;
  createPromotion(candidate: GpuVertexEmission): GpuMeshPromotion;
}

export function promotedIndirectArgumentsReference(
  previous: DrawIndirectArguments,
  summary: readonly number[],
): DrawIndirectArguments {
  if (
    summary.length !== 4 ||
    summary.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    (summary[2] !== 0 && summary[2] !== 1)
  ) {
    throw new RangeError('Vertex-emission summary is invalid.');
  }
  return summary[2] === 0 ? [summary[1]!, 1, 0, 0] : previous;
}

export function createGpuLastValidMesh(
  vertexCapacity: number,
): GpuLastValidMesh {
  if (
    !Number.isSafeInteger(vertexCapacity) ||
    vertexCapacity < 3 ||
    vertexCapacity % 3 !== 0
  ) {
    throw new RangeError(
      'Last-valid mesh capacity must be a triangle multiple.',
    );
  }
  const positions = new StorageBufferAttribute(vertexCapacity, 4);
  positions.name = 'Last valid marching-cubes positions';
  const normalAge = new StorageBufferAttribute(vertexCapacity, 4);
  normalAge.name = 'Last valid marching-cubes normal and surface age';
  const indirect = new IndirectStorageBufferAttribute(
    new Uint32Array([0, 1, 0, 0]),
    4,
  );
  indirect.name = 'Last valid marching-cubes indirect draw arguments';

  return {
    vertexCapacity,
    positions,
    normalAge,
    indirect,
    createPromotion(candidate) {
      if (candidate.vertexCapacity > vertexCapacity) {
        throw new RangeError('Candidate exceeds last-valid mesh capacity.');
      }
      const candidateSummary = storage(
        candidate.summary,
        'uvec4',
        1,
      ).toReadOnly();
      const candidatePositions = storage(
        candidate.positions,
        'vec4',
        candidate.vertexCapacity,
      ).toReadOnly();
      const candidateNormalAge = storage(
        candidate.normalAge,
        'vec4',
        candidate.vertexCapacity,
      ).toReadOnly();
      const validPositions = storage(positions, 'vec4', vertexCapacity);
      const validNormalAge = storage(normalAge, 'vec4', vertexCapacity);
      const drawArguments = storage(indirect, 'uvec4', 1);

      const promote = Fn(() => {
        const summary = candidateSummary.element(0);
        If(summary.z.equal(0), () => {
          If(instanceIndex.lessThan(summary.y), () => {
            validPositions
              .element(instanceIndex)
              .assign(candidatePositions.element(instanceIndex));
            validNormalAge
              .element(instanceIndex)
              .assign(candidateNormalAge.element(instanceIndex));
          });
          If(instanceIndex.equal(0), () => {
            drawArguments.element(0).assign(uvec4(summary.y, 1, 0, 0));
          });
        });
      })().compute(candidate.vertexCapacity, [128, 1, 1]);

      return {
        promote,
        async execute(renderer) {
          await renderer.computeAsync(promote);
        },
        dispose() {
          promote.dispose();
        },
      };
    },
  };
}
