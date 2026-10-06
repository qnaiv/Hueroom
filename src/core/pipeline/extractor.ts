import { analyzeBlob } from '../color/extract';
import type { Analysis } from '../types';
import type { WorkerRequest, WorkerResponse } from './protocol';

/** 色抽出の実行環境。Worker プールか、メインスレッド */
export interface Extractor {
  /** 同時に処理できる数の目安 */
  readonly concurrency: number;
  extract(blob: Blob): Promise<Analysis | null>;
  dispose(): void;
}

/** Worker が使えない環境向け（メインスレッドで直接処理） */
export function createMainThreadExtractor(): Extractor {
  return { concurrency: 1, extract: analyzeBlob, dispose() {} };
}

interface Slot {
  worker: Worker;
  busy: boolean;
}

/** Web Worker のプール。OffscreenCanvas が無い環境では呼び出し側でメインスレッド版を選ぶ */
export function createWorkerExtractor(size: number): Extractor {
  const slots: Slot[] = [];
  const pending = new Map<number, { resolve(a: Analysis | null): void; slot: Slot }>();
  const waiting: (() => void)[] = [];
  let nextId = 1;

  for (let i = 0; i < size; i++) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const slot: Slot = { worker, busy: false };
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      p.slot.busy = false;
      p.resolve(e.data.analysis);
      waiting.shift()?.();
    };
    worker.onerror = () => {
      // Worker 自体の失敗は、処理中の依頼を失敗（null）として返す
      for (const [id, p] of pending) {
        if (p.slot === slot) {
          pending.delete(id);
          slot.busy = false;
          p.resolve(null);
        }
      }
      waiting.shift()?.();
    };
    slots.push(slot);
  }

  const acquire = async (): Promise<Slot> => {
    for (;;) {
      const free = slots.find((s) => !s.busy);
      if (free) return free;
      await new Promise<void>((r) => waiting.push(r));
    }
  };

  return {
    concurrency: size,
    async extract(blob) {
      const slot = await acquire();
      slot.busy = true;
      const id = nextId++;
      return new Promise<Analysis | null>((resolve) => {
        pending.set(id, { resolve, slot });
        slot.worker.postMessage({ id, blob } satisfies WorkerRequest);
      });
    },
    dispose() {
      for (const s of slots) s.worker.terminate();
      for (const p of pending.values()) p.resolve(null);
      pending.clear();
    },
  };
}

/** 環境に合った Extractor を作る */
export function createExtractor(): Extractor {
  const canWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  if (!canWorker) return createMainThreadExtractor();
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return createWorkerExtractor(Math.max(2, Math.min(4, cores - 1)));
}
