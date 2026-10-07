import { COMPOSITION_HINT, COMPOSITION_LABEL, COMPOSITION_TAGS, type CompositionTag } from '../core/composition';
import { TONE_HINT, TONE_LABEL, TONE_TAGS, type ToneTag } from '../core/tone';
import {
  SEASONS,
  SEASON_LABEL,
  TIMES_OF_DAY,
  TIME_LABEL,
  TIME_RANGE,
  type Season,
  type TimeOfDay,
  type WhenFilter,
} from '../core/when';

/** どの画面の絞り込みか。日付の画面は季節・時間帯、色の画面は構図・質感 */
export type FilterView = 'date' | 'color';

interface Props {
  view: FilterView;
  when: WhenFilter;
  onWhen(f: WhenFilter): void;
  whenCounts: { season: Record<Season, number>; time: Record<TimeOfDay, number> };
  comp: CompositionTag | null;
  onComp(t: CompositionTag | null): void;
  compCounts: Record<CompositionTag, number>;
  tone: ToneTag | null;
  onTone(t: ToneTag | null): void;
  toneCounts: Record<ToneTag, number>;
  /** いま効いている絞り込みの数（この画面のぶん） */
  activeCount: number;
  onClear(): void;
}

interface RowProps<T extends string> {
  label: string;
  /** チップの属性（自動テストやスクリーンショットで押す対象を決める） */
  attr: string;
  tags: readonly T[];
  names: Record<T, string>;
  hints?: Record<T, string>;
  value: T | null;
  counts: Record<T, number>;
  onChange(t: T | null): void;
}

/** 候補のチップの 1 行。同じチップをもう一度押すと解除 */
function ChipRow<T extends string>({ label, attr, tags, names, hints, value, counts, onChange }: RowProps<T>) {
  return (
    <div className="filter-row" role="group" aria-label={label}>
      <span className="filter-label">{label}</span>
      {tags.map((t) => (
        <button
          key={t}
          type="button"
          className="chip"
          {...{ [`data-${attr}`]: t }}
          title={hints?.[t]}
          aria-pressed={value === t}
          disabled={counts[t] === 0 && value !== t}
          onClick={() => onChange(value === t ? null : t)}
        >
          {names[t]} <span className="num">{counts[t].toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}

/** 絞り込みのパネル（開いているときだけ出す）。日付の画面と色の画面で、候補が違う */
export function FilterPanel(p: Props) {
  return (
    <div className="filter-panel" id="filter-panel" role="region" aria-label="絞り込み">
      {p.view === 'date' ? (
        <>
          <ChipRow
            label="季節"
            attr="season"
            tags={SEASONS}
            names={SEASON_LABEL}
            value={p.when.season}
            counts={p.whenCounts.season}
            onChange={(season) => p.onWhen({ ...p.when, season })}
          />
          <ChipRow
            label="時間帯"
            attr="time"
            tags={TIMES_OF_DAY}
            names={TIME_LABEL}
            hints={TIME_RANGE}
            value={p.when.time}
            counts={p.whenCounts.time}
            onChange={(time) => p.onWhen({ ...p.when, time })}
          />
        </>
      ) : (
        <>
          <ChipRow
            label="構図"
            attr="tag"
            tags={COMPOSITION_TAGS}
            names={COMPOSITION_LABEL}
            hints={COMPOSITION_HINT}
            value={p.comp}
            counts={p.compCounts}
            onChange={p.onComp}
          />
          <ChipRow
            label="質感"
            attr="tone"
            tags={TONE_TAGS}
            names={TONE_LABEL}
            hints={TONE_HINT}
            value={p.tone}
            counts={p.toneCounts}
            onChange={p.onTone}
          />
        </>
      )}
      <button type="button" className="btn filter-clear" onClick={p.onClear} disabled={p.activeCount === 0}>
        絞り込みを解除
      </button>
    </div>
  );
}
