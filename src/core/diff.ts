/** フォルダを読み直したときの、画像の増減を数える */
export function diffKeys(prev: Iterable<string>, next: Iterable<string>): { added: number; removed: number } {
  const a = new Set(prev);
  const b = new Set(next);
  let added = 0;
  let removed = 0;
  for (const k of b) if (!a.has(k)) added++;
  for (const k of a) if (!b.has(k)) removed++;
  return { added, removed };
}

/** 読み直した結果をユーザーに伝える文言 */
export function refreshNotice({ added, removed }: { added: number; removed: number }): string {
  if (added === 0 && removed === 0) return '変更はありません';
  const parts: string[] = [];
  if (added > 0) parts.push(`${added.toLocaleString()} 枚追加`);
  if (removed > 0) parts.push(`${removed.toLocaleString()} 枚削除`);
  return parts.join('・');
}
