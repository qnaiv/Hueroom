import type { SortDirection, SortMode } from '../core/types';
import { STAR } from './icons';
import type { Phase } from './useGallery';

interface Props {
  folderName: string | null;
  onPick(): void;
  mode: SortMode;
  onMode(m: SortMode): void;
  direction: SortDirection;
  onDirection(d: SortDirection): void;
  onlyFavorites: boolean;
  onOnlyFavorites(v: boolean): void;
  favoriteCount: number;
  tileSize: number;
  onTileSize(n: number): void;
  recursive: boolean;
  onRecursive(v: boolean): void;
  shown: number;
  total: number;
  phase: Phase;
  progress: { done: number; total: number };
}

const MODES: [SortMode, string][] = [
  ['color', '色'],
  ['date', '日付'],
];

export function Toolbar(p: Props) {
  const analyzing = p.phase === 'analyzing';
  // フォルダを選ぶまでは、ロゴだけを出す
  if (p.folderName === null) {
    return (
      <header className="toolbar">
        <div className="brand">
          <i aria-hidden="true" />
          Hueroom
        </div>
      </header>
    );
  }
  return (
    <header className="toolbar">
      <div className="brand">
        <i aria-hidden="true" />
        Hueroom
      </div>
      <button type="button" className="folder-btn" onClick={p.onPick} title="フォルダを選び直す">
        {p.folderName}
      </button>
      <div className="spacer" />

      <div className="seg" role="group" aria-label="並び順">
        {MODES.map(([m, label]) => (
          <button key={m} type="button" aria-pressed={p.mode === m} onClick={() => p.onMode(m)}>
            {label}
          </button>
        ))}
      </div>
      {p.mode !== 'color' && (
        <button
          type="button"
          className="btn"
          onClick={() => p.onDirection(p.direction === 'asc' ? 'desc' : 'asc')}
          aria-label={p.direction === 'asc' ? '古い順（押すと新しい順）' : '新しい順（押すと古い順）'}
        >
          {p.direction === 'asc' ? '古い順 ↑' : '新しい順 ↓'}
        </button>
      )}

      <button
        type="button"
        className="btn fav-filter"
        aria-pressed={p.onlyFavorites}
        onClick={() => p.onOnlyFavorites(!p.onlyFavorites)}
      >
        {STAR}
        お気に入り <span className="num">{p.favoriteCount}</span>
      </button>

      <label className="zoom">
        <span>サイズ</span>
        <input
          type="range"
          min={72}
          max={240}
          step={4}
          value={p.tileSize}
          onChange={(e) => p.onTileSize(Number(e.target.value))}
          aria-label="タイルの大きさ"
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={p.recursive} onChange={(e) => p.onRecursive(e.target.checked)} />
        サブフォルダ
      </label>

      <div className="status" aria-live="polite">
        {p.phase === 'listing' && '読み込み中…'}
        {analyzing && (
          <>
            解析中 <span className="num">{p.progress.done.toLocaleString()}</span> /{' '}
            <span className="num">{p.progress.total.toLocaleString()}</span>
          </>
        )}
        {p.phase === 'done' && (
          <span className="num">
            {p.shown === p.total ? `${p.total.toLocaleString()} 枚` : `${p.shown.toLocaleString()} / ${p.total.toLocaleString()} 枚`}
          </span>
        )}
      </div>
      {analyzing && p.progress.total > 0 && (
        <div className="progress" aria-hidden="true">
          <div style={{ width: `${(p.progress.done / p.progress.total) * 100}%` }} />
        </div>
      )}
    </header>
  );
}
