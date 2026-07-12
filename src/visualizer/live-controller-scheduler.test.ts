import { describe, expect, it, vi } from 'vitest';
import {
  createLiveControllerScheduler,
  summarizeLiveMeshUpdateCadence,
  type LiveControllerMeshUpdate,
  type LiveControllerSnapshot,
} from './live-controller-scheduler';

function createFrameHarness() {
  let nextHandle = 1;
  const frames = new Map<number, FrameRequestCallback>();
  return {
    requestFrame: (callback: FrameRequestCallback) => {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle: number) => {
      frames.delete(handle);
    },
    runFrame: () => {
      const entry = frames.entries().next().value;
      if (!entry) {
        throw new Error('No frame is scheduled.');
      }
      frames.delete(entry[0]);
      entry[1](performance.now());
    },
    get pendingFrames() {
      return frames.size;
    },
  };
}

async function flushWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('live controller scheduler', () => {
  it('summarizes continuous mesh update cadence', () => {
    const updates = [0, 32, 64, 100].map(
      (completedAtMilliseconds, index): LiveControllerMeshUpdate => ({
        stepCount: index + 1,
        simulatedTime: (index + 1) * 0.01,
        textureParity: ((index + 1) % 2) as 0 | 1,
        completedAtMilliseconds,
      }),
    );

    expect(summarizeLiveMeshUpdateCadence(updates)).toEqual({
      updateCount: 4,
      measuredDurationMilliseconds: 100,
      updatesPerSecond: 30,
      medianIntervalMilliseconds: 32,
      percentile95IntervalMilliseconds: 36,
      maximumIntervalMilliseconds: 36,
    });
  });

  it('renders every frame while promoting every bounded solver batch', async () => {
    const frames = createFrameHarness();
    let stepCount = 0;
    const extracted: LiveControllerSnapshot[] = [];
    const render = vi.fn();
    let now = 0;
    const scheduler = createLiveControllerScheduler(
      {
        step(count) {
          stepCount += count;
          return Promise.resolve({
            stepCount,
            simulatedTime: stepCount * 0.01,
            textureParity: (stepCount % 2) as 0 | 1,
          });
        },
        extract(snapshot) {
          extracted.push(snapshot);
          return Promise.resolve();
        },
        render,
        onError: vi.fn(),
      },
      {
        simulationStepsPerMeshUpdate: 3,
        targetStepCount: 10,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
        now: () => {
          now += 32;
          return now;
        },
      },
    );

    scheduler.start();
    for (let index = 0; index < 5; index += 1) {
      frames.runFrame();
      await flushWork();
    }

    await expect(scheduler.completion).resolves.toEqual([
      {
        stepCount: 3,
        simulatedTime: 0.03,
        textureParity: 1,
        completedAtMilliseconds: 32,
      },
      {
        stepCount: 6,
        simulatedTime: 0.06,
        textureParity: 0,
        completedAtMilliseconds: 64,
      },
      {
        stepCount: 9,
        simulatedTime: 0.09,
        textureParity: 1,
        completedAtMilliseconds: 96,
      },
      {
        stepCount: 10,
        simulatedTime: 0.1,
        textureParity: 0,
        completedAtMilliseconds: 128,
      },
    ]);
    expect(extracted.map(({ textureParity }) => textureParity)).toEqual([
      1, 0, 1, 0,
    ]);
    expect(render).toHaveBeenCalledTimes(5);
    expect(scheduler.state).toBe('complete');
    await scheduler.dispose();
    expect(frames.pendingFrames).toBe(0);
  });

  it('waits for in-flight work before disposal settles', async () => {
    const frames = createFrameHarness();
    let resolveStep: ((snapshot: LiveControllerSnapshot) => void) | undefined;
    const scheduler = createLiveControllerScheduler(
      {
        step: () =>
          new Promise((resolve) => {
            resolveStep = resolve;
          }),
        extract: vi.fn(),
        render: vi.fn(),
        onError: vi.fn(),
      },
      {
        simulationStepsPerMeshUpdate: 1,
        targetStepCount: 1,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      },
    );

    scheduler.start();
    frames.runFrame();
    const disposal = scheduler.dispose();
    expect(scheduler.state).toBe('disposed');
    resolveStep?.({ stepCount: 1, simulatedTime: 0.01, textureParity: 1 });
    await disposal;
    await expect(scheduler.completion).resolves.toEqual([]);
    expect(frames.pendingFrames).toBe(0);
  });
});
