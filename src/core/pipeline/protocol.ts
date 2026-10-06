import type { Analysis } from '../types';

export interface WorkerRequest {
  id: number;
  blob: Blob;
}

export interface WorkerResponse {
  id: number;
  analysis: Analysis | null;
  error?: string;
}
