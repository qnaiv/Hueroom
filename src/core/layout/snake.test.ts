import { describe, expect, it } from 'vitest';
import { snakeCells, snakeIndex, snakePosition } from './snake';

describe('snake', () => {
  it('偶数行は左から右、奇数行は右から左', () => {
    expect(snakePosition(0, 4)).toEqual({ row: 0, col: 0 });
    expect(snakePosition(3, 4)).toEqual({ row: 0, col: 3 });
    expect(snakePosition(4, 4)).toEqual({ row: 1, col: 3 });
    expect(snakePosition(7, 4)).toEqual({ row: 1, col: 0 });
    expect(snakePosition(8, 4)).toEqual({ row: 2, col: 0 });
  });

  it('行の折り返しで、隣り合う番号は同じ列に並ぶ', () => {
    for (const cols of [1, 2, 5, 8]) {
      for (let i = 0; i < 100; i++) {
        const a = snakePosition(i, cols);
        const b = snakePosition(i + 1, cols);
        if (a.row !== b.row) expect(a.col).toBe(b.col);
        else expect(Math.abs(a.col - b.col)).toBe(1);
      }
    }
  });

  it('snakeIndex は snakePosition の逆変換', () => {
    for (const cols of [3, 7]) {
      for (let i = 0; i < 60; i++) {
        const { row, col } = snakePosition(i, cols);
        expect(snakeIndex(row, col, cols)).toBe(i);
      }
    }
  });

  it('snakeCells は行優先のセル配列を返し、端数の空きは null', () => {
    const cells = snakeCells([0, 1, 2, 3, 4, 5, 6], 3);
    expect(cells).toEqual([0, 1, 2, 5, 4, 3, 6, null, null]);
    // 最後の行が奇数行になる場合、空きは左側になる
    expect(snakeCells([0, 1, 2, 3], 3)).toEqual([0, 1, 2, null, null, 3]);
    expect(snakeCells([], 3)).toEqual([]);
  });
});
