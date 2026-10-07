import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FavoritesStore } from '../core/cache/favorites';
import { toneTags, toneThresholds, TONE_TAGS, type ToneTag } from '../core/tone';
import { snakeCells } from '../core/layout/snake';
import { sortItems } from '../core/sort';
import type { SortDirection, SortMode } from '../core/types';
import { createWebAdapter } from '../platform/web';
import { ToneBar } from './ToneBar';
import { NavBar } from './NavBar';
import { Lightbox } from './Lightbox';
import { Toolbar } from './Toolbar';
import { VirtualGrid } from './VirtualGrid';
import { Welcome } from './Welcome';
import { isFavorite } from './types';
import { useGallery } from './useGallery';

const adapter = createWebAdapter();
const favoritesStore = new FavoritesStore();

export function App() {
  const [mode, setMode] = useState<SortMode>('color');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [recursive, setRecursive] = useState(true);
  const [tileSize, setTileSize] = useState(128);
  const [cols, setCols] = useState(6);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [toneTag, setToneTag] = useState<ToneTag | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { folder, items, phase, progress, restore, error, notice, pick, reopen, close: closeFolder, refresh } = useGallery(adapter, recursive);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // お気に入り（IndexedDB）
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    favoritesStore.load().then(setFavorites, () => undefined);
  }, []);
  const toggleFavorite = useCallback((key: string) => {
    favoritesStore.toggle(key).then((on) =>
      setFavorites((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      }),
    );
  }, []);

  // 絞り込み用の集合は、拡大表示を閉じてから更新する（開いたまま解除しても画像が消えないように）
  const [filterFavorites, setFilterFavorites] = useState(favorites);
  useEffect(() => {
    if (openKey === null) setFilterFavorites(favorites);
  }, [favorites, openKey]);

  const sorted = useMemo(() => sortItems(items, mode, direction), [items, mode, direction]);
  // 質感の傾向（明るい・暗いなどは、このフォルダの中での比較）
  const toneTh = useMemo(() => toneThresholds(items.flatMap((x) => (x.analysis ? [x.analysis.tone] : []))), [items]);
  const toneCounts = useMemo(() => {
    const counts = Object.fromEntries(TONE_TAGS.map((t) => [t, 0])) as Record<ToneTag, number>;
    for (const x of items) if (x.analysis) for (const t of toneTags(x.analysis.tone, toneTh)) counts[t]++;
    return counts;
  }, [items, toneTh]);
  const displayed = useMemo(
    () =>
      sorted.filter(
        (x) =>
          (toneTag === null || (x.analysis !== undefined && toneTags(x.analysis.tone, toneTh).includes(toneTag))) &&
          (!onlyFavorites || isFavorite(x, filterFavorites)),
      ),
    [sorted, toneTag, toneTh, onlyFavorites, filterFavorites],
  );
  // 色順は蛇行配置、それ以外は通常の行優先
  const cells = useMemo(() => (mode === 'color' ? snakeCells(displayed, cols) : displayed), [displayed, cols, mode]);

  // 並び順・絞り込みを変えたら先頭に戻る
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [mode, direction, onlyFavorites, toneTag]);

  const openIndex = openKey === null ? -1 : displayed.findIndex((x) => x.key === openKey);
  const openItem = openIndex >= 0 ? displayed[openIndex] : undefined;
  const move = useCallback(
    (delta: number) => {
      const next = displayed[openIndex + delta];
      if (next) setOpenKey(next.key);
    },
    [displayed, openIndex],
  );
  const open = useCallback((item: { key: string }) => setOpenKey(item.key), []);
  const close = useCallback(() => setOpenKey(null), []);

  const favCountInFolder = useMemo(() => items.reduce((n, x) => n + (isFavorite(x, favorites) ? 1 : 0), 0), [items, favorites]);

  return (
    <div className="app" data-analysis={phase} data-count={items.length}>
      <Toolbar
        folderName={folder?.name ?? null}
        onHome={() => {
          setOpenKey(null);
          closeFolder();
        }}
        mode={mode}
        onMode={setMode}
        direction={direction}
        onDirection={setDirection}
        onlyFavorites={onlyFavorites}
        onOnlyFavorites={setOnlyFavorites}
        favoriteCount={favCountInFolder}
        tileSize={tileSize}
        onTileSize={setTileSize}
        recursive={recursive}
        onRecursive={setRecursive}
        shown={displayed.length}
        total={items.length}
        phase={phase}
        progress={progress}
        notice={notice}
        onRefresh={refresh}
        refreshReopensPicker={!adapter.capabilities.persistent}
      />
      {folder && <ToneBar tag={toneTag} onChange={setToneTag} counts={toneCounts} />}
      {folder ? (
        <div className="main">
          <div className="scroller" ref={scrollerRef}>
            <VirtualGrid
              cells={cells}
              cols={cols}
              tileTarget={tileSize}
              onColsChange={setCols}
              favorites={favorites}
              onOpen={open}
              scrollerRef={scrollerRef}
            />
            {phase !== 'idle' && phase !== 'listing' && displayed.length === 0 && (
              <p className="empty">
                {toneTag !== null
                  ? 'この質感の写真は見つかりません。解析が終わっていない画像は、絞り込みの対象外です。'
                  : onlyFavorites
                  ? 'お気に入りはまだありません。画像を開いて「お気に入りに追加」を押すと、ここに集まります。'
                  : error ?? '画像（jpg / png / webp / gif）が見つかりませんでした。'}
              </p>
            )}
          </div>
          <NavBar variant={mode} cells={cells} cols={cols} favorites={favorites} scrollerRef={scrollerRef} />
        </div>
      ) : (
        <Welcome onPick={pick} onReopen={reopen} restore={restore} persistent={adapter.capabilities.persistent} error={error} />
      )}
      {openItem && (
        <Lightbox
          item={openItem}
          index={openIndex}
          count={displayed.length}
          isFavorite={isFavorite(openItem, favorites)}
          canFavorite={openItem.favoriteId !== undefined}
          onToggleFavorite={() => openItem.favoriteId !== undefined && toggleFavorite(openItem.favoriteId)}
          onMove={move}
          onClose={close}
        />
      )}
    </div>
  );
}
