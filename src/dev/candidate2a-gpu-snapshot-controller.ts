import type { Candidate2AThermalState } from '../simulation/candidate2a';
import type { ScalarFieldSnapshot } from '../simulation/scalar-field-snapshot';
import {
  createScalarFieldGpuSnapshotController,
  type ScalarFieldGpuSnapshotController,
  type ScalarFieldGpuSnapshotResult,
} from './scalar-field-gpu-snapshot-controller';

export type Candidate2AGpuSnapshotResult = ScalarFieldGpuSnapshotResult;

export interface Candidate2AGpuSnapshotController {
  readonly ready: ScalarFieldGpuSnapshotController['ready'];
  readonly errors: readonly string[];
  show(state: Candidate2AThermalState): Promise<Candidate2AGpuSnapshotResult>;
  resize(width: number, height: number, devicePixelRatio: number): void;
  dispose(): void;
}

function candidate2ASnapshot(
  state: Candidate2AThermalState,
): ScalarFieldSnapshot {
  return {
    shape: state.config.shape,
    voxelCount: state.config.voxelCount,
    orderParameter: state.orderParameter,
    step: state.step,
    simulatedTime: state.simulatedTime,
  };
}

export function createCandidate2AGpuSnapshotController(
  canvas: HTMLCanvasElement,
  initial: Candidate2AThermalState,
  vertexCapacity = 650_001,
): Candidate2AGpuSnapshotController {
  const controller = createScalarFieldGpuSnapshotController(
    canvas,
    candidate2ASnapshot(initial),
    {
      vertexCapacity,
      displaySpan: 5.4,
      label: 'Candidate 2A',
    },
  );

  return {
    ready: controller.ready,
    get errors() {
      return controller.errors;
    },
    show(state) {
      return controller.show(candidate2ASnapshot(state));
    },
    resize(width, height, devicePixelRatio) {
      controller.resize(width, height, devicePixelRatio);
    },
    dispose() {
      controller.dispose();
    },
  };
}
