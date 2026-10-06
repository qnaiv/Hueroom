/**
 * 蛇行配置。行ごとに左右を反転して、行の折り返しで色が飛ばないようにする。
 * 仮想スクロールとカラーバーの両方がこの対応表に依存する。
 */

/** 並び順の番号 → 表示セル（行・列）。奇数行は右から左へ並ぶ */
export function snakePosition(index: number, cols: number): { row: number; col: number } {
  const row = Math.floor(index / cols);
  const c = index % cols;
  return { row, col: row % 2 === 1 ? cols - 1 - c : c };
}

/** 表示セルの番号（row * cols + col）→ 並び順の番号。逆変換 */
export function snakeIndex(row: number, col: number, cols: number): number {
  return row * cols + (row % 2 === 1 ? cols - 1 - col : col);
}

/**
 * 並び順の配列を、表示セル順（行優先）の配列にする。
 * 最後の行が埋まらない場合の空きは null（流れの続きになるよう、奇数行では左側が空く）。
 */
export function snakeCells<T>(items: readonly T[], cols: number): (T | null)[] {
  const rows = Math.ceil(items.length / cols);
  const cells: (T | null)[] = new Array(rows * cols).fill(null);
  items.forEach((item, i) => {
    const { row, col } = snakePosition(i, cols);
    cells[row * cols + col] = item;
  });
  return cells;
}
