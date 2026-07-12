export interface LiveExtractionSample {
  readonly stepCount: number;
  readonly simulatedTime: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly overflow: boolean;
  readonly extractionMilliseconds: number;
}

export interface LiveExtractionCadence {
  readonly firstSampleMilliseconds: number;
  readonly warmSampleCount: number;
  readonly warmMinimumMilliseconds: number;
  readonly warmMedianMilliseconds: number;
  readonly warmMaximumMilliseconds: number;
}

export interface LiveExtractionValidation {
  readonly cadence: LiveExtractionCadence;
  readonly distinctVertexCounts: number;
  readonly failures: readonly string[];
  readonly passed: boolean;
}

const DEFAULT_SAMPLE_COUNT = 5;
const SOLVER_TEXTURE_ALIGNMENT = 2;

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

export function planLiveExtractionCheckpoints(
  totalSteps: number,
  requestedSampleCount = DEFAULT_SAMPLE_COUNT,
): readonly number[] {
  requirePositiveInteger(totalSteps, 'Total step count');
  requirePositiveInteger(requestedSampleCount, 'Requested sample count');
  if (totalSteps % SOLVER_TEXTURE_ALIGNMENT !== 0) {
    throw new RangeError(
      'Live extraction step count must be even to retain one ping-pong texture source.',
    );
  }

  const sampleCount = Math.min(
    requestedSampleCount,
    totalSteps / SOLVER_TEXTURE_ALIGNMENT,
  );
  const checkpoints = new Set<number>();
  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const proportionalStep = (sample * totalSteps) / sampleCount;
    const alignedStep =
      Math.round(proportionalStep / SOLVER_TEXTURE_ALIGNMENT) *
      SOLVER_TEXTURE_ALIGNMENT;
    checkpoints.add(Math.min(totalSteps, Math.max(2, alignedStep)));
  }
  checkpoints.add(totalSteps);
  return [...checkpoints].sort((left, right) => left - right);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

export function evaluateLiveExtractionSamples(
  samples: readonly LiveExtractionSample[],
  expectedFinalStep: number,
): LiveExtractionValidation {
  requirePositiveInteger(expectedFinalStep, 'Expected final step');
  if (samples.length < 2) {
    throw new RangeError(
      'Live extraction cadence validation requires at least two samples.',
    );
  }

  const failures: string[] = [];
  const requireSample = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };
  samples.forEach((sample, index) => {
    requireSample(
      Number.isFinite(sample.extractionMilliseconds) &&
        sample.extractionMilliseconds > 0,
      `sample ${index + 1} extraction time must be positive and finite`,
    );
    requireSample(
      sample.vertexCount > 0 && sample.vertexCount === sample.triangleCount * 3,
      `sample ${index + 1} must contain complete non-indexed triangles`,
    );
    requireSample(!sample.overflow, `sample ${index + 1} must not overflow`);
    if (index > 0) {
      requireSample(
        sample.stepCount > samples[index - 1]!.stepCount,
        'sample step counts must increase strictly',
      );
    }
  });
  requireSample(
    samples.at(-1)!.stepCount === expectedFinalStep,
    'the final extraction sample must match the requested final step',
  );

  const distinctVertexCounts = new Set(
    samples.map((sample) => sample.vertexCount),
  ).size;
  requireSample(
    distinctVertexCounts > 1,
    'repeated extraction must observe at least two distinct promoted meshes',
  );

  const warmTimings = samples
    .slice(1)
    .map((sample) => sample.extractionMilliseconds);
  return {
    cadence: {
      firstSampleMilliseconds: samples[0]!.extractionMilliseconds,
      warmSampleCount: warmTimings.length,
      warmMinimumMilliseconds: Math.min(...warmTimings),
      warmMedianMilliseconds: median(warmTimings),
      warmMaximumMilliseconds: Math.max(...warmTimings),
    },
    distinctVertexCounts,
    failures,
    passed: failures.length === 0,
  };
}
