import { describe, expect, it } from 'vitest';
import { NO_FILTER, countWhen, matchesWhen, seasonOf, timeOfDayOf } from './when';

// 端末のローカル時刻で作る（テストの実行環境のタイムゾーンに依存しない）
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('seasonOf', () => {
  it('月の境目で季節が変わる', () => {
    expect(seasonOf(at(2024, 2, 29))).toBe('winter');
    expect(seasonOf(at(2024, 3, 1))).toBe('spring');
    expect(seasonOf(at(2024, 5, 31))).toBe('spring');
    expect(seasonOf(at(2024, 6, 1))).toBe('summer');
    expect(seasonOf(at(2024, 8, 31))).toBe('summer');
    expect(seasonOf(at(2024, 9, 1))).toBe('autumn');
    expect(seasonOf(at(2024, 11, 30))).toBe('autumn');
    expect(seasonOf(at(2024, 12, 1))).toBe('winter');
    expect(seasonOf(at(2024, 1, 15))).toBe('winter');
  });
});

describe('timeOfDayOf', () => {
  it('時刻の境目で時間帯が変わる', () => {
    expect(timeOfDayOf(at(2024, 1, 1, 4))).toBe('night');
    expect(timeOfDayOf(at(2024, 1, 1, 5))).toBe('morning');
    expect(timeOfDayOf(at(2024, 1, 1, 9))).toBe('morning');
    expect(timeOfDayOf(at(2024, 1, 1, 10))).toBe('day');
    expect(timeOfDayOf(at(2024, 1, 1, 15))).toBe('day');
    expect(timeOfDayOf(at(2024, 1, 1, 16))).toBe('evening');
    expect(timeOfDayOf(at(2024, 1, 1, 18))).toBe('evening');
    expect(timeOfDayOf(at(2024, 1, 1, 19))).toBe('night');
    expect(timeOfDayOf(at(2024, 1, 1, 0))).toBe('night');
  });
});

describe('matchesWhen', () => {
  const summerEvening = { shotAt: at(2024, 7, 10, 17), shotFromExif: true };
  const winterMorning = { shotAt: at(2024, 1, 10, 7), shotFromExif: true };
  const noExif = { shotAt: at(2024, 7, 10, 17), shotFromExif: false };

  it('絞り込みなしなら全部通す（EXIF が無い画像も）', () => {
    expect(matchesWhen(noExif, NO_FILTER)).toBe(true);
  });
  it('季節と時間帯は両方を満たすものだけ通す', () => {
    expect(matchesWhen(summerEvening, { season: 'summer', time: null })).toBe(true);
    expect(matchesWhen(summerEvening, { season: null, time: 'evening' })).toBe(true);
    expect(matchesWhen(summerEvening, { season: 'summer', time: 'evening' })).toBe(true);
    expect(matchesWhen(summerEvening, { season: 'summer', time: 'morning' })).toBe(false);
    expect(matchesWhen(winterMorning, { season: 'summer', time: null })).toBe(false);
  });
  it('更新日時で代用している画像は、絞り込み中は除外する', () => {
    expect(matchesWhen(noExif, { season: 'summer', time: null })).toBe(false);
  });
});

describe('countWhen', () => {
  it('もう一方の絞り込みを反映して数える', () => {
    const items = [
      { shotAt: at(2024, 7, 10, 17), shotFromExif: true }, // 夏・夕方
      { shotAt: at(2024, 7, 11, 7), shotFromExif: true }, // 夏・朝
      { shotAt: at(2024, 1, 10, 7), shotFromExif: true }, // 冬・朝
      { shotAt: at(2024, 1, 10, 7), shotFromExif: false }, // 数えない
    ];
    const all = countWhen(items, NO_FILTER);
    expect(all.season).toEqual({ spring: 0, summer: 2, autumn: 0, winter: 1 });
    expect(all.time).toEqual({ morning: 2, day: 0, evening: 1, night: 0 });
    const morning = countWhen(items, { season: null, time: 'morning' });
    expect(morning.season).toEqual({ spring: 0, summer: 1, autumn: 0, winter: 1 });
    const summer = countWhen(items, { season: 'summer', time: null });
    expect(summer.time).toEqual({ morning: 1, day: 0, evening: 1, night: 0 });
  });
});
