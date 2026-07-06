import { normalizeGenerationSettings } from '../generation/settings';
import type {
  CrystalBlock,
  CrystalModel,
  GenerationEvent,
  GenerationSettings,
} from '../generation/types';
import type {
  CrystalWorkerRequest,
  CrystalWorkerResponse,
} from './crystalWorkerProtocol';

interface GenerationCallbacks {
  onStart: (jobId: number) => void;
  onEvent: (event: GenerationEvent) => void;
  onComplete: (model: CrystalModel) => void;
  onError: (message: string) => void;
}

let worker: Worker | undefined;
let activeJobId = 0;
let activeTimers: number[] = [];

function getWorker() {
  worker ??= new Worker(new URL('./crystalGenerator.worker.ts', import.meta.url), {
    type: 'module',
  });

  return worker;
}

export function startCrystalGeneration(
  settings: GenerationSettings,
  callbacks: GenerationCallbacks,
) {
  if (activeJobId > 0) {
    getWorker().postMessage({
      type: 'cancel',
      jobId: activeJobId,
    } satisfies CrystalWorkerRequest);
  }

  const jobId = activeJobId + 1;
  activeJobId = jobId;
  clearScheduledEvents();

  const crystalWorker = getWorker();
  const startedAt = globalThis.performance.now();

  callbacks.onStart(jobId);

  crystalWorker.onmessage = (event: MessageEvent<CrystalWorkerResponse>) => {
    const response = event.data;
    if (response.jobId !== activeJobId) {
      return;
    }

    if (response.type === 'error') {
      callbacks.onError(response.message);
      return;
    }

    schedulePacedResult({
      events: response.events,
      model: response.model,
      startedAt,
      callbacks,
      jobId,
    });
  };

  crystalWorker.postMessage({
    type: 'generate',
    jobId,
    settings: normalizeGenerationSettings(settings),
  } satisfies CrystalWorkerRequest);

  return () => cancelCrystalGeneration(jobId);
}

export function cancelActiveCrystalGeneration() {
  cancelCrystalGeneration(activeJobId);
}

function cancelCrystalGeneration(jobId: number) {
  if (jobId <= 0) {
    return;
  }

  clearScheduledEvents();
  getWorker().postMessage({ type: 'cancel', jobId } satisfies CrystalWorkerRequest);
}

function schedulePacedResult({
  events,
  model,
  startedAt,
  callbacks,
  jobId,
}: {
  events: GenerationEvent[];
  model: CrystalModel;
  startedAt: number;
  callbacks: GenerationCallbacks;
  jobId: number;
}) {
  const previewBlocks: CrystalBlock[] = [];

  for (const event of events) {
    const elapsed = globalThis.performance.now() - startedAt;
    const delay = Math.max(0, (event.displayTimeMs ?? 0) - elapsed);
    const timer = globalThis.setTimeout(() => {
      if (jobId !== activeJobId) {
        return;
      }

      if (event.chunk?.blocks.length) {
        previewBlocks.push(...event.chunk.blocks);
        callbacks.onEvent({
          ...event,
          preview: {
            blockCount: previewBlocks.length,
            bounds: event.preview?.bounds ?? model.bounds,
          },
        });
        return;
      }

      callbacks.onEvent(event);
      if (event.step === 'complete') {
        callbacks.onComplete(model);
      }
    }, delay);

    activeTimers.push(timer);
  }
}

function clearScheduledEvents() {
  for (const timer of activeTimers) {
    globalThis.clearTimeout(timer);
  }

  activeTimers = [];
}
