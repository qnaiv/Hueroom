import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAnalysisCache } from '../core/cache/analysisCache';
import { imageKey } from '../core/keys';
import { analyzeImages } from '../core/pipeline/analyzer';
import { createExtractor, type Extractor } from '../core/pipeline/extractor';
import type { Analysis, ImageFileRef } from '../core/types';
import type { FolderAdapter, FolderHandle, RestoreResult } from '../platform/types';
import type { GalleryItem } from './types';

export type Phase = 'idle' | 'listing' | 'analyzing' | 'done';

const cache = createAnalysisCache();
let extractor: Extractor | null = null;
const getExtractor = () => (extractor ??= createExtractor());

/** 解析結果を画面に反映する間隔。短すぎると解析中の並び替えで画面が落ち着かない */
const FLUSH_MS = 500;

/** フォルダの選択・列挙・解析（キャッシュ→Worker）の状態をまとめて扱う */
export function useGallery(adapter: FolderAdapter, recursive: boolean) {
  const [folder, setFolder] = useState<FolderHandle | null>(null);
  const [refs, setRefs] = useState<ImageFileRef[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [restore, setRestore] = useState<RestoreResult>({ status: 'none' });
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // null は「解析に失敗した」印
  const results = useRef(new Map<string, Analysis | null>());

  // 起動時に前回のフォルダを復元する。許可が必要な場合はボタンを出す（ユーザー操作が必要なため）
  useEffect(() => {
    let alive = true;
    adapter.restoreLast().then((r) => {
      if (!alive) return;
      if (r.status === 'ok') setFolder(r.folder);
      else setRestore(r);
    }, () => undefined);
    return () => {
      alive = false;
    };
  }, [adapter]);

  // フォルダ（またはサブフォルダ設定）が変わったら、列挙して解析する
  useEffect(() => {
    if (!folder) return;
    const ctrl = new AbortController();
    const { signal } = ctrl;
    results.current = new Map();
    setRefs([]);
    setError(null);
    setProgress({ done: 0, total: 0 });
    setPhase('listing');

    let timer: ReturnType<typeof setTimeout> | undefined;
    let total = 0;
    const flush = () => {
      timer = undefined;
      setProgress({ done: results.current.size, total });
      setTick((t) => t + 1);
    };

    (async () => {
      const list: ImageFileRef[] = [];
      for await (const ref of adapter.listImages(folder, { recursive, signal })) {
        list.push(ref);
        if (list.length % 200 === 0) setRefs([...list]);
      }
      if (signal.aborted) return;
      total = list.length;
      setRefs(list);
      setPhase('analyzing');
      setProgress({ done: 0, total });
      await analyzeImages(
        list,
        { cache, extractor: getExtractor() },
        {
          onResult: (_ref, key, analysis) => {
            results.current.set(key, analysis);
            timer ??= setTimeout(flush, FLUSH_MS);
          },
        },
        signal,
      );
      if (signal.aborted) return;
      clearTimeout(timer);
      flush();
      setPhase('done');
    })().catch((e) => {
      if (!signal.aborted) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('done');
      }
    });

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [adapter, folder, recursive]);

  const items = useMemo<GalleryItem[]>(
    () =>
      refs.map((ref) => {
        const key = imageKey(ref);
        const a = results.current.get(key);
        return {
          key,
          ref,
          name: ref.name,
          lastModified: ref.lastModified,
          shotAt: a?.shotAt ?? ref.lastModified,
          shotFromExif: a?.shotAt !== undefined,
          analysis: a ?? undefined,
          color: a?.color,
          failed: a === null,
        };
      }),
    // results は ref に入っているので、tick で再計算する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refs, tick],
  );

  const pick = useCallback(async () => {
    setError(null);
    try {
      const f = await adapter.pickFolder();
      if (f) {
        setRestore({ status: 'none' });
        setFolder(f);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [adapter]);

  const reopen = useCallback(async () => {
    if (restore.status !== 'needs-permission') return;
    const f = await restore.request().catch(() => null);
    if (f) {
      setRestore({ status: 'none' });
      setFolder(f);
    }
  }, [restore]);

  /** 最初の画面（フォルダ選択）に戻る。いま開いているフォルダは、ボタンからすぐ開き直せる */
  const close = useCallback(() => {
    if (!folder) return;
    const current = folder;
    setRestore({ status: 'needs-permission', folderName: current.name, request: async () => current });
    setFolder(null);
    setRefs([]);
    setPhase('idle');
    setProgress({ done: 0, total: 0 });
    setError(null);
  }, [folder]);

  return { folder, items, phase, progress, restore, error, pick, reopen, close };
}
