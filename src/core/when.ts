/** 季節（日本の区切り: 春 3〜5 月、夏 6〜8 月、秋 9〜11 月、冬 12〜2 月） */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** 時間帯（朝 5〜10 時、昼 10〜16 時、夕方 16〜19 時、夜 19〜5 時） */
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const TIMES_OF_DAY: readonly TimeOfDay[] = ['morning', 'day', 'evening', 'night'];

export const SEASON_LABEL: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
export const TIME_LABEL: Record<TimeOfDay, string> = { morning: '朝', day: '昼', evening: '夕方', night: '夜' };
export const TIME_RANGE: Record<TimeOfDay, string> = {
  morning: '5〜10 時',
  day: '10〜16 時',
  evening: '16〜19 時',
  night: '19〜5 時',
};

/** 端末のローカル時刻での季節（EXIF の時刻もローカル時刻として読んでいる） */
export function seasonOf(ts: number): Season {
  const month = new Date(ts).getMonth(); // 0〜11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/** 端末のローカル時刻での時間帯 */
export function timeOfDayOf(ts: number): TimeOfDay {
  const hour = new Date(ts).getHours();
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';
}

export interface WhenFilter {
  season: Season | null;
  time: TimeOfDay | null;
}

export const NO_FILTER: WhenFilter = { season: null, time: null };
export const isFiltering = (f: WhenFilter): boolean => f.season !== null || f.time !== null;

interface Datable {
  shotAt: number;
  /** 撮影日時（EXIF）なら true。更新日時で代用しているときは false */
  shotFromExif: boolean;
}

/**
 * 季節・時間帯で絞り込めるか。更新日時で代用している画像は撮影の時刻ではないので、
 * 絞り込み中は除外する。
 */
export function matchesWhen(item: Datable, f: WhenFilter): boolean {
  if (!isFiltering(f)) return true;
  if (!item.shotFromExif) return false;
  if (f.season !== null && seasonOf(item.shotAt) !== f.season) return false;
  if (f.time !== null && timeOfDayOf(item.shotAt) !== f.time) return false;
  return true;
}

/** 各候補の枚数（もう一方の絞り込みを反映した件数）。ボタンに添える */
export function countWhen(
  items: readonly Datable[],
  f: WhenFilter,
): { season: Record<Season, number>; time: Record<TimeOfDay, number> } {
  const season = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  const time = { morning: 0, day: 0, evening: 0, night: 0 };
  for (const it of items) {
    if (!it.shotFromExif) continue;
    const s = seasonOf(it.shotAt);
    const t = timeOfDayOf(it.shotAt);
    if (f.time === null || f.time === t) season[s]++;
    if (f.season === null || f.season === s) time[t]++;
  }
  return { season, time };
}
