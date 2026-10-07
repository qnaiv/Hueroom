import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAnalysisCache } from '../core/cache/analysisCache';
import { diffKeys, refreshNotice } from '../core/diff';
import { favoriteId, imageKey } from '../core/keys';
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
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // true のとき、次の読み込みは「更新」（いまの一覧を残したまま、差分だけ解析する）
  const softRef = useRef(false);
  const refsRef = useRef<ImageFileRef[]>([]);
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

  // フォルダ・サブフォルダ設定が変わったとき、または「更新」のたびに、列挙して解析する
  useEffect(() => {
    if (!folder) return;
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const soft = softRef.current;
    softRef.current = false;
    if (!soft) {
      results.current = new Map();
      refsRef.current = [];
      setRefs([]);
    }
    setError(null);
    setProgress({ done: 0, total: 0 });
    setPhase('listing');

    let timer: ReturnType<typeof setTimeout> | undefined;
    let total = 0;
    let done = 0;
    let result: string | null = null;
    const flush = () => {
      timer = undefined;
      setProgress({ done, total });
      setTick((t) => t + 1);
    };

    (async () => {
      const list: ImageFileRef[] = [];
      for await (const ref of adapter.listImages(folder, { recursive, signal })) {
        list.push(ref);
        // 更新のときは、一覧が途中で欠けて見えないよう、最後にまとめて差し替える
        if (!soft && list.length % 200 === 0) setRefs([...list]);
      }
      if (signal.aborted) return;
      if (soft) result = refreshNotice(diffKeys(refsRef.current.map(imageKey), list.map(imageKey)));
      refsRef.current = list;
      setRefs(list);

      // 解析済みの画像は飛ばし、新しい画像と、前回失敗した画像だけを解析する
      const todo = list.filter((r) => !results.current.get(imageKey(r)));
      total = todo.length;
      setPhase('analyzing');
      setProgress({ done: 0, total });
      await analyzeImages(
        todo,
        { cache, extractor: getExtractor() },
        {
          onResult: (_ref, key, analysis) => {
            results.current.set(key, analysis);
            done++;
            timer ??= setTimeout(flush, FLUSH_MS);
          },
        },
        signal,
      );
      if (signal.aborted) return;
      clearTimeout(timer);
      flush();
      setPhase('done');
      // 更新の結果は、解析まで終わってから数秒だけ出す
      if (result !== null) setNotice(result);
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
  }, [adapter, folder, recursive, reloadKey]);

  // 更新の結果の表示は数秒で消す
  useEffect(() => {
    if (notice === null) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

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
          favoriteId: a ? favoriteId(ref, a.hash) : undefined,
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

  /**
   * フォルダを読み直して、新しい画像を追加する（消えた画像は一覧から外す）。
   * フォルダを覚えられない環境（Safari / Firefox）は、選んだ時点のファイル一覧しか持てないので、
   * フォルダの選択をもう一度開く。同じフォルダを選べば、新しい画像だけが解析される。
   */
  const refresh = useCallback(async () => {
    if (!folder || phase === 'listing' || phase === 'analyzing') return;
    if (!adapter.capabilities.persistent) {
      try {
        // 写真を選ぶ方式は、いま選んでいる写真に足す。フォルダを選ぶ方式は、選び直す
        const f = await adapter.pickFolder({ append: adapter.capabilities.appendable === true });
        if (f) {
          softRef.current = true;
          setFolder(f);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    softRef.current = true;
    setReloadKey((k) => k + 1);
  }, [adapter, folder, phase]);

  /** 最初の画面（フォルダ選択）に戻る。いま開いているフォルダは、ボタンからすぐ開き直せる */
  const close = useCallback(() => {
    if (!folder) return;
    const current = folder;
    setRestore({ status: 'needs-permission', folderName: current.name, request: async () => current });
    setFolder(null);
    refsRef.current = [];
    setNotice(null);
    setRefs([]);
    setPhase('idle');
    setProgress({ done: 0, total: 0 });
    setError(null);
  }, [folder]);

  return { folder, items, phase, progress, restore, error, notice, pick, reopen, close, refresh };
}
