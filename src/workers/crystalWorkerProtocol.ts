import type { CrystalModel, GenerationEvent, GenerationSettings } from '../generation/types';

export interface GenerateCrystalRequest {
  type: 'generate';
  jobId: number;
  settings: GenerationSettings;
}

export interface CancelCrystalRequest {
  type: 'cancel';
  jobId: number;
}

export type CrystalWorkerRequest = GenerateCrystalRequest | CancelCrystalRequest;

export interface CrystalWorkerResult {
  type: 'result';
  jobId: number;
  events: GenerationEvent[];
  model: CrystalModel;
}

export interface CrystalWorkerError {
  type: 'error';
  jobId: number;
  message: string;
}

export type CrystalWorkerResponse = CrystalWorkerResult | CrystalWorkerError;
