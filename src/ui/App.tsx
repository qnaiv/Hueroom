import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FavoritesStore } from '../core/cache/favorites';
import { sortByPalette } from '../core/palette';
import { toneTags, toneThresholds, TONE_TAGS, type ToneTag } from '../core/tone';
import { compositionTags, spaceThresholds, COMPOSITION_TAGS, type CompositionTag } from '../core/composition';
import { snakeCells } from '../core/layout/snake';
import { sortItems } from '../core/sort';
import type { SortDirection, SortMode } from '../core/types';
import { NO_FILTER, countWhen, matchesWhen, type WhenFilter } from '../core/when';
import { createWebAdapter } from '../platform/web';
import { FilterPanel, type FilterView } from './FilterPanel';
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
  // 配色が近い順に並べているときの、基準の写真（key）
  const [paletteKey, setPaletteKey] = useState<string | null>(null);
  const [compTag, setCompTag] = useState<CompositionTag | null>(null);
  const [when, setWhen] = useState<WhenFilter>(NO_FILTER);
  const [toneTag, setToneTag] = useState<ToneTag | null>(null);
  // 絞り込みのパネル。ふだんは閉じておく（絞り込みたいときだけ開く）
  const [filterOpen, setFilterOpen] = useState(false);
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

  const paletteRef = useMemo(() => (paletteKey === null ? undefined : items.find((x) => x.key === paletteKey)), [items, paletteKey]);
  const refPalette = paletteRef?.analysis?.palette;
  const sorted = useMemo(
    () => (refPalette ? sortByPalette(items, refPalette) : sortItems(items, mode, direction)),
    [items, mode, direction, refPalette],
  );
  // 質感の傾向（明るい・暗いなどは、このフォルダの中での比較）
  const toneTh = useMemo(() => toneThresholds(items.flatMap((x) => (x.analysis ? [x.analysis.tone] : []))), [items]);
  const toneCounts = useMemo(() => {
    const counts = Object.fromEntries(TONE_TAGS.map((t) => [t, 0])) as Record<ToneTag, number>;
    for (const x of items) if (x.analysis) for (const t of toneTags(x.analysis.tone, toneTh)) counts[t]++;
    return counts;
  }, [items, toneTh]);
  // 構図の傾向（余白の多い・少ないは、このフォルダの中での比較）
  const spaceTh = useMemo(
    () => spaceThresholds(items.flatMap((x) => (x.analysis ? [x.analysis.composition.space] : []))),
    [items],
  );
  const compCounts = useMemo(() => {
    const counts = Object.fromEntries(COMPOSITION_TAGS.map((t) => [t, 0])) as Record<CompositionTag, number>;
    for (const x of items) if (x.analysis) for (const t of compositionTags(x.analysis.composition, spaceTh)) counts[t]++;
    return counts;
  }, [items, spaceTh]);
  // 日付の画面は季節・時間帯、色の画面（配色の並びを含む）は構図・質感で絞り込む。
  // 開いていない画面の絞り込みは、覚えておくだけで、効かせない（見えない絞り込みで写真が消えないように）
  const view: FilterView = mode === 'date' && !refPalette ? 'date' : 'color';
  const activeWhen = view === 'date' ? when : NO_FILTER;
  const activeComp = view === 'color' ? compTag : null;
  const activeTone = view === 'color' ? toneTag : null;
  const filterCount =
    view === 'date' ? (when.season !== null ? 1 : 0) + (when.time !== null ? 1 : 0) : (compTag !== null ? 1 : 0) + (toneTag !== null ? 1 : 0);
  const displayed = useMemo(
    () =>
      sorted.filter(
        (x) =>
          matchesWhen(x, activeWhen) &&
          (activeComp === null || (x.analysis !== undefined && compositionTags(x.analysis.composition, spaceTh).includes(activeComp))) &&
          (activeTone === null || (x.analysis !== undefined && toneTags(x.analysis.tone, toneTh).includes(activeTone))) &&
          (!onlyFavorites || isFavorite(x, filterFavorites)),
      ),
    [sorted, activeWhen, activeComp, spaceTh, activeTone, toneTh, onlyFavorites, filterFavorites],
  );
  const whenCounts = useMemo(() => countWhen(items, activeWhen), [items, activeWhen]);
  // 色順は蛇行配置、それ以外は通常の行優先
  const cells = useMemo(() => (mode === 'color' && !refPalette ? snakeCells(displayed, cols) : displayed), [displayed, cols, mode, refPalette]);

  // 並び順・絞り込みを変えたら先頭に戻る
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [mode, direction, onlyFavorites, activeWhen, activeComp, activeTone, refPalette]);

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
        onMode={(m) => {
          setPaletteKey(null);
          setMode(m);
        }}
        palette={paletteRef && refPalette ? { name: paletteRef.name, colors: refPalette.map((c) => c.hex) } : null}
        onClearPalette={() => setPaletteKey(null)}
        direction={direction}
        onDirection={setDirection}
        filterOpen={filterOpen}
        onFilterOpen={setFilterOpen}
        filterCount={filterCount}
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
      {folder && filterOpen && (
        <FilterPanel
          view={view}
          when={when}
          onWhen={setWhen}
          whenCounts={whenCounts}
          comp={compTag}
          onComp={setCompTag}
          compCounts={compCounts}
          tone={toneTag}
          onTone={setToneTag}
          toneCounts={toneCounts}
          activeCount={filterCount}
          onClear={() => {
            if (view === 'date') setWhen(NO_FILTER);
            else {
              setCompTag(null);
              setToneTag(null);
            }
          }}
        />
      )}
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
                {activeWhen.season !== null || activeWhen.time !== null
                  ? 'この季節・時間帯の写真はありません。撮影日時（EXIF）が無い画像は、絞り込みの対象外です。'
                  : activeComp !== null
                  ? 'この構図の写真は見つかりません。解析が終わっていない画像は、絞り込みの対象外です。'
                  : activeTone !== null
                  ? 'この質感の写真は見つかりません。解析が終わっていない画像は、絞り込みの対象外です。'
                  : onlyFavorites
                  ? 'お気に入りはまだありません。画像を開いて「お気に入りに追加」を押すと、ここに集まります。'
                  : error ?? '画像（jpg / png / webp / gif）が見つかりませんでした。'}
              </p>
            )}
          </div>
          <NavBar variant={refPalette ? 'color' : mode} cells={cells} cols={cols} favorites={favorites} scrollerRef={scrollerRef} />
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
          onPaletteSort={() => {
            setPaletteKey(openItem.key);
            close();
          }}
          onMove={move}
          onClose={close}
        />
      )}
    </div>
  );
}
