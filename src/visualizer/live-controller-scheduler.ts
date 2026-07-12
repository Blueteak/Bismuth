export type LiveTextureParity = 0 | 1;

export interface LiveControllerSnapshot {
  readonly stepCount: number;
  readonly simulatedTime: number;
  readonly textureParity: LiveTextureParity;
}

export interface LiveControllerMeshUpdate extends LiveControllerSnapshot {
  readonly completedAtMilliseconds: number;
}

export interface LiveMeshUpdateCadence {
  readonly updateCount: number;
  readonly measuredDurationMilliseconds: number;
  readonly updatesPerSecond: number;
  readonly medianIntervalMilliseconds: number;
  readonly percentile95IntervalMilliseconds: number;
  readonly maximumIntervalMilliseconds: number;
}

export function summarizeLiveMeshUpdateCadence(
  updates: readonly LiveControllerMeshUpdate[],
): LiveMeshUpdateCadence {
  const intervals = updates.slice(1).map((update, index) => {
    const previous = updates[index]!;
    const interval =
      update.completedAtMilliseconds - previous.completedAtMilliseconds;
    if (!Number.isFinite(interval) || interval < 0) {
      throw new RangeError(
        'Mesh update timestamps must be finite and ordered.',
      );
    }
    return interval;
  });
  const sorted = [...intervals].sort((left, right) => left - right);
  const percentile = (fraction: number) =>
    sorted.length === 0 ? 0 : sorted[Math.ceil(sorted.length * fraction) - 1]!;
  const measuredDurationMilliseconds = intervals.reduce(
    (total, interval) => total + interval,
    0,
  );

  return {
    updateCount: updates.length,
    measuredDurationMilliseconds,
    updatesPerSecond:
      intervals.length > 0 && measuredDurationMilliseconds > 0
        ? (intervals.length * 1000) / measuredDurationMilliseconds
        : 0,
    medianIntervalMilliseconds: percentile(0.5),
    percentile95IntervalMilliseconds: percentile(0.95),
    maximumIntervalMilliseconds: sorted.at(-1) ?? 0,
  };
}

export interface LiveControllerSchedulerHooks {
  step(stepCount: number): Promise<LiveControllerSnapshot>;
  extract(snapshot: LiveControllerSnapshot): Promise<void>;
  render(): void;
  onError(error: unknown): void;
}

export interface LiveControllerSchedulerOptions {
  readonly simulationStepsPerMeshUpdate: number;
  readonly targetStepCount: number;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
  readonly now?: () => number;
}

export interface LiveControllerScheduler {
  readonly completion: Promise<readonly LiveControllerMeshUpdate[]>;
  readonly state: 'idle' | 'running' | 'complete' | 'error' | 'disposed';
  start(): void;
  dispose(): Promise<void>;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

export function createLiveControllerScheduler(
  hooks: LiveControllerSchedulerHooks,
  options: LiveControllerSchedulerOptions,
): LiveControllerScheduler {
  assertPositiveInteger(
    'Simulation steps per mesh update',
    options.simulationStepsPerMeshUpdate,
  );
  assertPositiveInteger('Target step count', options.targetStepCount);

  const requestFrame = options.requestFrame ?? window.requestAnimationFrame;
  const cancelFrame = options.cancelFrame ?? window.cancelAnimationFrame;
  const now = options.now ?? performance.now.bind(performance);
  const meshUpdates: LiveControllerMeshUpdate[] = [];
  let state: LiveControllerScheduler['state'] = 'idle';
  let frameHandle: number | undefined;
  let workInFlight: Promise<void> | undefined;
  let currentStepCount = 0;
  let settleCompletion: (
    updates: readonly LiveControllerMeshUpdate[],
  ) => void = () => undefined;
  const completion = new Promise<readonly LiveControllerMeshUpdate[]>(
    (resolve) => {
      settleCompletion = resolve;
    },
  );
  let completionSettled = false;

  const settle = () => {
    if (!completionSettled) {
      completionSettled = true;
      settleCompletion([...meshUpdates]);
    }
  };

  const advance = () => {
    if (state !== 'running' || workInFlight) {
      return;
    }

    const stepCount = Math.min(
      options.simulationStepsPerMeshUpdate,
      options.targetStepCount - currentStepCount,
    );
    workInFlight = (async () => {
      const expectedStepCount = currentStepCount + stepCount;
      const snapshot = await hooks.step(stepCount);
      if (snapshot.stepCount !== expectedStepCount) {
        throw new Error(
          `Solver returned step ${snapshot.stepCount}; expected ${expectedStepCount}.`,
        );
      }
      currentStepCount = snapshot.stepCount;
      if (state !== 'running') {
        return;
      }

      await hooks.extract(snapshot);
      if (state !== 'running') {
        return;
      }
      meshUpdates.push({
        ...snapshot,
        completedAtMilliseconds: now(),
      });
      if (currentStepCount >= options.targetStepCount) {
        state = 'complete';
        settle();
      }
    })()
      .catch((error: unknown) => {
        if (state === 'disposed') {
          return;
        }
        state = 'error';
        hooks.onError(error);
        settle();
      })
      .finally(() => {
        workInFlight = undefined;
      });
  };

  const renderFrame: FrameRequestCallback = () => {
    if (state === 'disposed') {
      return;
    }
    hooks.render();
    advance();
    frameHandle = requestFrame(renderFrame);
  };

  return {
    completion,
    get state() {
      return state;
    },
    start() {
      if (state !== 'idle') {
        return;
      }
      state = 'running';
      frameHandle = requestFrame(renderFrame);
    },
    async dispose() {
      if (state === 'disposed') {
        await workInFlight;
        return;
      }
      state = 'disposed';
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle);
        frameHandle = undefined;
      }
      await workInFlight;
      settle();
    },
  };
}
