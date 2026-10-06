import { describe, expect, it } from 'vitest';
import { diffKeys, refreshNotice } from './diff';

describe('diffKeys', () => {
  it('追加と削除を数える', () => {
    expect(diffKeys(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toEqual({ added: 2, removed: 1 });
  });
  it('同じなら 0', () => {
    expect(diffKeys(['a'], ['a'])).toEqual({ added: 0, removed: 0 });
    expect(diffKeys([], [])).toEqual({ added: 0, removed: 0 });
  });
  it('重複したキーは 1 つとして数える', () => {
    expect(diffKeys(['a', 'a'], ['a', 'b', 'b'])).toEqual({ added: 1, removed: 0 });
  });
});

describe('refreshNotice', () => {
  it('増減に合わせた文言にする', () => {
    expect(refreshNotice({ added: 0, removed: 0 })).toBe('変更はありません');
    expect(refreshNotice({ added: 3, removed: 0 })).toBe('3 枚追加');
    expect(refreshNotice({ added: 0, removed: 2 })).toBe('2 枚削除');
    expect(refreshNotice({ added: 1200, removed: 4 })).toBe('1,200 枚追加・4 枚削除');
  });
});
