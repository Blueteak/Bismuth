import { generateCrystal } from '../generation/generateCrystal';
import type {
  CrystalWorkerRequest,
  CrystalWorkerResponse,
} from './crystalWorkerProtocol';

const canceledJobs = new Set<number>();

self.onmessage = (event: MessageEvent<CrystalWorkerRequest>) => {
  const message = event.data;

  if (message.type === 'cancel') {
    canceledJobs.add(message.jobId);
    return;
  }

  try {
    const result = generateCrystal(message.settings);
    if (canceledJobs.has(message.jobId)) {
      canceledJobs.delete(message.jobId);
      return;
    }

    self.postMessage({
      type: 'result',
      jobId: message.jobId,
      events: result.events,
      model: result.model,
    } satisfies CrystalWorkerResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      jobId: message.jobId,
      message: error instanceof Error ? error.message : 'Crystal generation failed',
    } satisfies CrystalWorkerResponse);
  }
};
