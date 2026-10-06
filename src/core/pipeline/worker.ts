/// <reference lib="webworker" />
import { analyzeBlob } from '../color/extract';
import type { WorkerRequest, WorkerResponse } from './protocol';

// 1 件ずつ受け取り、デコード → 縮小 → 主要色 → サムネイルまでをこのスレッドで行う
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, blob } = e.data;
  try {
    const analysis = await analyzeBlob(blob);
    (self as unknown as Worker).postMessage({ id, analysis } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, analysis: null, error: String(err) } satisfies WorkerResponse);
  }
};
