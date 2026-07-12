import type { Storage3DTexture, WebGPURenderer } from 'three/webgpu';
import {
  createGpuCellCompaction,
  type GpuCellCompaction,
} from './gpu-cell-compaction';
import {
  createGpuLastValidMesh,
  type GpuLastValidMesh,
  type GpuMeshPromotion,
} from './gpu-mesh-promotion';
import {
  createGpuVertexEmission,
  type GpuVertexEmission,
} from './gpu-vertex-emission';
import {
  createGpuCellClassification,
  type ExtractionVec3,
  type GpuCellClassification,
  type GridShape,
} from './marching-cubes';

export interface GpuSurfaceExtractorOptions {
  readonly spacing: number;
  readonly physicalOrigin: ExtractionVec3;
  readonly vertexCapacity: number;
  readonly initialSimulatedTime: number;
  readonly lastValidMesh?: GpuLastValidMesh;
}

export interface GpuSurfaceExtractor {
  readonly classification: GpuCellClassification;
  readonly compaction: GpuCellCompaction;
  readonly candidate: GpuVertexEmission;
  readonly lastValidMesh: GpuLastValidMesh;
  readonly promotion: GpuMeshPromotion;
  extract(renderer: WebGPURenderer, simulatedTime: number): Promise<void>;
  dispose(): void;
}

export function createGpuSurfaceExtractor(
  phase: Storage3DTexture,
  solidificationTime: Storage3DTexture,
  gridShape: GridShape,
  options: GpuSurfaceExtractorOptions,
): GpuSurfaceExtractor {
  const classification = createGpuCellClassification(phase, gridShape);
  const compaction = createGpuCellCompaction(classification);
  const candidate = createGpuVertexEmission(
    phase,
    solidificationTime,
    classification,
    compaction,
    {
      spacing: options.spacing,
      physicalOrigin: options.physicalOrigin,
      vertexCapacity: options.vertexCapacity,
      simulatedTime: options.initialSimulatedTime,
    },
  );
  const lastValidMesh =
    options.lastValidMesh ?? createGpuLastValidMesh(options.vertexCapacity);
  if (lastValidMesh.vertexCapacity < options.vertexCapacity) {
    throw new RangeError(
      'Shared last-valid mesh capacity is smaller than the extractor candidate.',
    );
  }
  const promotion = lastValidMesh.createPromotion(candidate);

  return {
    classification,
    compaction,
    candidate,
    lastValidMesh,
    promotion,
    async extract(renderer, simulatedTime) {
      candidate.setSimulatedTime(simulatedTime);
      await renderer.computeAsync(classification.classify);
      await compaction.execute(renderer);
      await candidate.execute(renderer);
      await promotion.execute(renderer);
    },
    dispose() {
      promotion.dispose();
      candidate.dispose();
      compaction.dispose();
      classification.dispose();
    },
  };
}

export interface GpuSurfaceExtractorPair {
  readonly extractors: readonly [GpuSurfaceExtractor, GpuSurfaceExtractor];
  readonly lastValidMesh: GpuLastValidMesh;
  extract(
    renderer: WebGPURenderer,
    parity: 0 | 1,
    simulatedTime: number,
  ): Promise<void>;
  dispose(): void;
}

export function createGpuSurfaceExtractorPair(
  textureParities: readonly [
    {
      readonly phase: Storage3DTexture;
      readonly solidificationTime: Storage3DTexture;
    },
    {
      readonly phase: Storage3DTexture;
      readonly solidificationTime: Storage3DTexture;
    },
  ],
  gridShape: GridShape,
  options: GpuSurfaceExtractorOptions,
): GpuSurfaceExtractorPair {
  const lastValidMesh =
    options.lastValidMesh ?? createGpuLastValidMesh(options.vertexCapacity);
  const createForParity = (parity: 0 | 1) =>
    createGpuSurfaceExtractor(
      textureParities[parity].phase,
      textureParities[parity].solidificationTime,
      gridShape,
      { ...options, lastValidMesh },
    );
  const extractors = [createForParity(0), createForParity(1)] as const;

  return {
    extractors,
    lastValidMesh,
    extract(renderer, parity, simulatedTime) {
      return extractors[parity].extract(renderer, simulatedTime);
    },
    dispose() {
      extractors[0].dispose();
      extractors[1].dispose();
    },
  };
}
