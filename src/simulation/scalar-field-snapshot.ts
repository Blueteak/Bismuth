import type { GridShape } from './config';

/**
 * CPU scalar field accepted by the development GPU extraction bridge.
 * Samples are x-fast and use +1 for solid and -1 for liquid.
 */
export interface ScalarFieldSnapshot {
  readonly shape: GridShape;
  readonly voxelCount: number;
  readonly orderParameter: Float32Array;
  readonly step: number;
  readonly simulatedTime: number;
}
