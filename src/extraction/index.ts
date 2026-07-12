/** Typed boundary for GPU surface extraction introduced after milestone 0A. */
export interface ExtractionSubsystem {
  readonly kind: 'extraction';
}

export * from './marching-cubes';
export * from './gpu-exclusive-scan';
export * from './gpu-cell-compaction';
export * from './gpu-vertex-emission';
export * from './gpu-mesh-promotion';
export * from './marching-cubes-reference';
export * from './gpu-surface-extractor';
