import type { WebGPURenderer } from 'three/webgpu';
import {
  createInitialCpuState,
  stepCpuSimulation,
  type CpuSimulationState,
} from './cpu-reference';
import { createSimulationConfiguration } from './config';
import {
  createGpuSingleCrystalSolver,
  SOLVER_WORKGROUP_SIZE,
  type GpuFieldState,
  type SolverStepTimings,
} from './gpu-solver';

export interface FieldComparison {
  readonly sampleCount: number;
  readonly maximumAbsoluteError: number;
  readonly maximumRelativeError: number;
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly passed: boolean;
}

export interface SolverCheckpointComparison {
  readonly step: number;
  readonly phase: FieldComparison;
  readonly chemicalPotential: FieldComparison;
  readonly solidificationTime: FieldComparison;
  readonly passed: boolean;
}

export interface GpuSolverValidationResult {
  readonly grid: readonly [number, number, number];
  readonly workgroup: readonly [number, number, number];
  readonly precision: 'float32';
  readonly checkpoints: readonly SolverCheckpointComparison[];
  readonly timings: SolverStepTimings;
  readonly passed: boolean;
}

function compareFields(
  actual: Float32Array,
  expected: Float32Array,
  absoluteTolerance: number,
  relativeTolerance: number,
): FieldComparison {
  if (actual.length !== expected.length) {
    return {
      sampleCount: Math.max(actual.length, expected.length),
      maximumAbsoluteError: Number.POSITIVE_INFINITY,
      maximumRelativeError: Number.POSITIVE_INFINITY,
      absoluteTolerance,
      relativeTolerance,
      passed: false,
    };
  }

  let maximumAbsoluteError = 0;
  let maximumRelativeError = 0;
  let passed = true;
  for (let index = 0; index < actual.length; index += 1) {
    const actualValue = actual[index] ?? Number.NaN;
    const expectedValue = expected[index] ?? Number.NaN;
    const absoluteError = Math.abs(actualValue - expectedValue);
    const scale = Math.max(
      Math.abs(actualValue),
      Math.abs(expectedValue),
      1e-6,
    );
    const relativeError = absoluteError / scale;
    maximumAbsoluteError = Math.max(maximumAbsoluteError, absoluteError);
    maximumRelativeError = Math.max(maximumRelativeError, relativeError);
    if (
      !Number.isFinite(actualValue) ||
      !Number.isFinite(expectedValue) ||
      (absoluteError > absoluteTolerance && relativeError > relativeTolerance)
    ) {
      passed = false;
    }
  }

  return {
    sampleCount: actual.length,
    maximumAbsoluteError,
    maximumRelativeError,
    absoluteTolerance,
    relativeTolerance,
    passed,
  };
}

function compareCheckpoint(
  gpu: GpuFieldState,
  cpu: CpuSimulationState,
  absoluteTolerance: number,
  relativeTolerance: number,
): SolverCheckpointComparison {
  const phase = compareFields(
    gpu.phase,
    cpu.phase,
    absoluteTolerance,
    relativeTolerance,
  );
  const chemicalPotential = compareFields(
    gpu.chemicalPotential,
    cpu.chemicalPotential,
    absoluteTolerance,
    relativeTolerance,
  );
  const solidificationTime = compareFields(
    gpu.solidificationTime,
    cpu.solidificationTime,
    absoluteTolerance,
    relativeTolerance,
  );

  return {
    step: cpu.step,
    phase,
    chemicalPotential,
    solidificationTime,
    passed:
      phase.passed && chemicalPotential.passed && solidificationTime.passed,
  };
}

function addTimings(
  current: SolverStepTimings,
  next: SolverStepTimings,
): SolverStepTimings {
  return {
    steps: current.steps + next.steps,
    phaseMilliseconds: current.phaseMilliseconds + next.phaseMilliseconds,
    chemicalPotentialMilliseconds:
      current.chemicalPotentialMilliseconds +
      next.chemicalPotentialMilliseconds,
    solidificationTimeMilliseconds:
      current.solidificationTimeMilliseconds +
      next.solidificationTimeMilliseconds,
    totalMilliseconds: current.totalMilliseconds + next.totalMilliseconds,
  };
}

export async function runGpuSolverValidation(
  renderer: WebGPURenderer,
  device: GPUDevice,
): Promise<GpuSolverValidationResult> {
  const configuration = createSimulationConfiguration('hopper', {
    parameters: {
      criticalRadius: 0.75,
      initialRadius: 1.5,
      interfaceWidth: 0.75,
    },
    grid: {
      shape: [9, 9, 9],
      spacing: 1,
      timeStep: 0.0005,
    },
  });
  const solver = createGpuSingleCrystalSolver(renderer, device, configuration);
  let cpu = createInitialCpuState(configuration);
  let timings: SolverStepTimings = {
    steps: 0,
    phaseMilliseconds: 0,
    chemicalPotentialMilliseconds: 0,
    solidificationTimeMilliseconds: 0,
    totalMilliseconds: 0,
  };

  try {
    await solver.initialize();
    const checkpoints: SolverCheckpointComparison[] = [];
    checkpoints.push(
      compareCheckpoint(await solver.readFields(), cpu, 1e-6, 1e-6),
    );

    timings = addTimings(timings, await solver.step(1));
    cpu = stepCpuSimulation(cpu);
    checkpoints.push(
      compareCheckpoint(await solver.readFields(), cpu, 1e-5, 1e-5),
    );

    timings = addTimings(timings, await solver.step(2));
    cpu = stepCpuSimulation(stepCpuSimulation(cpu));
    checkpoints.push(
      compareCheckpoint(await solver.readFields(), cpu, 1e-4, 1e-4),
    );

    return {
      grid: configuration.grid.shape,
      workgroup: SOLVER_WORKGROUP_SIZE,
      precision: 'float32',
      checkpoints,
      timings,
      passed: checkpoints.every((checkpoint) => checkpoint.passed),
    };
  } finally {
    solver.dispose();
  }
}
