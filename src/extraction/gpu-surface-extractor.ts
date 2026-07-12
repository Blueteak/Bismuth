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
  const lastValidMesh = createGpuLastValidMesh(options.vertexCapacity);
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
