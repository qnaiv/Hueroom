import { TONE_HINT, TONE_LABEL, TONE_TAGS, type ToneTag } from '../core/tone';

interface Props {
  tag: ToneTag | null;
  onChange(t: ToneTag | null): void;
  counts: Record<ToneTag, number>;
}

/** 明るさ・コントラスト・彩度の質感で絞り込む。同じチップをもう一度押すと解除 */
export function ToneBar({ tag, onChange, counts }: Props) {
  return (
    <div className="tonebar" role="group" aria-label="質感">
      <span className="tone-label">質感</span>
      {TONE_TAGS.map((t) => (
        <button
          key={t}
          type="button"
          className="tone-chip"
          data-tone={t}
          title={TONE_HINT[t]}
          aria-pressed={tag === t}
          disabled={counts[t] === 0 && tag !== t}
          onClick={() => onChange(tag === t ? null : t)}
        >
          {TONE_LABEL[t]} <span className="num">{counts[t].toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}
