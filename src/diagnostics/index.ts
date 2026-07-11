import { REVISION } from 'three';

export interface RuntimeSummary {
  readonly threeRevision: string;
  readonly browserReportsWebGpu: boolean;
}

export function getRuntimeSummary(): RuntimeSummary {
  return {
    threeRevision: REVISION,
    browserReportsWebGpu: 'gpu' in navigator,
  };
}
