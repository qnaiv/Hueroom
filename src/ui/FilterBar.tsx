import { SEASONS, SEASON_LABEL, TIMES_OF_DAY, TIME_LABEL, TIME_RANGE, type Season, type TimeOfDay, type WhenFilter } from '../core/when';

interface Props {
  filter: WhenFilter;
  onChange(f: WhenFilter): void;
  counts: { season: Record<Season, number>; time: Record<TimeOfDay, number> };
}

/** 季節・時間帯で絞り込む。同じ候補をもう一度押すと解除 */
export function FilterBar({ filter, onChange, counts }: Props) {
  return (
    <div className="filterbar" role="group" aria-label="いつ撮った写真か">
      <div className="filter-group" role="group" aria-label="季節">
        <span className="filter-label">季節</span>
        {SEASONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            data-season={s}
            aria-pressed={filter.season === s}
            disabled={counts.season[s] === 0 && filter.season !== s}
            onClick={() => onChange({ ...filter, season: filter.season === s ? null : s })}
          >
            {SEASON_LABEL[s]} <span className="num">{counts.season[s].toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="filter-group" role="group" aria-label="時間帯">
        <span className="filter-label">時間帯</span>
        {TIMES_OF_DAY.map((t) => (
          <button
            key={t}
            type="button"
            className="chip"
            data-time={t}
            title={TIME_RANGE[t]}
            aria-pressed={filter.time === t}
            disabled={counts.time[t] === 0 && filter.time !== t}
            onClick={() => onChange({ ...filter, time: filter.time === t ? null : t })}
          >
            {TIME_LABEL[t]} <span className="num">{counts.time[t].toLocaleString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
