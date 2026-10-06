/**
 * JPEG の EXIF から撮影日時を読む（純粋関数。canvas にも DOM にも依存しない）。
 * 読めない・無い場合は undefined（呼び出し側が更新日時で代用する）。
 * 時刻にタイムゾーンは記録されないので、端末のローカル時刻として扱う。
 */

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_DATETIME = 0x0132;

/** EXIF 先頭を探すために読むバイト数の目安（APP1 は通常この範囲に収まる） */
export const EXIF_HEAD_BYTES = 128 * 1024;

/** "YYYY:MM:DD HH:MM:SS" → ミリ秒。不正な値は undefined */
export function parseExifDate(text: string): number | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!m) return undefined;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return undefined;
  const t = new Date(y, mo - 1, d, h, mi, Math.min(s, 59)).getTime();
  return Number.isNaN(t) ? undefined : t;
}

export function readExifDate(buffer: ArrayBuffer): number | undefined {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return undefined; // JPEG ではない

  // セグメントを辿って、EXIF を持つ APP1 を探す
  let pos = 2;
  while (pos + 4 <= view.byteLength) {
    if (view.getUint8(pos) !== 0xff) return undefined;
    const marker = view.getUint8(pos + 1);
    if (marker === 0xd9 || marker === 0xda) return undefined; // 画像データまで来た
    const len = view.getUint16(pos + 2);
    if (len < 2) return undefined;
    if (marker === 0xe1 && pos + 10 <= view.byteLength && view.getUint32(pos + 4) === 0x45786966 /* "Exif" */) {
      return readTiff(view, pos + 10, Math.min(view.byteLength, pos + 2 + len));
    }
    pos += 2 + len;
  }
  return undefined;
}

function readTiff(view: DataView, base: number, end: number): number | undefined {
  if (base + 8 > end) return undefined;
  const order = view.getUint16(base);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return undefined;
  const u16 = (o: number) => (o + 2 <= end ? view.getUint16(o, little) : 0);
  const u32 = (o: number) => (o + 4 <= end ? view.getUint32(o, little) : 0);

  /** IFD の中のタグを探す。ASCII なら文字列、LONG なら数値の配列で返す */
  const find = (ifdOffset: number, tag: number): { value: number; count: number; type: number; at: number } | undefined => {
    const ifd = base + ifdOffset;
    if (ifd + 2 > end) return undefined;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > end) return undefined;
      if (u16(e) === tag) return { type: u16(e + 2), count: u32(e + 4), value: u32(e + 8), at: e + 8 };
    }
    return undefined;
  };
  const ascii = (e: { count: number; value: number; at: number }): string | undefined => {
    // 4 バイト以下は値そのものが入る。それより長い値は、TIFF 先頭からのオフセットが入る
    const start = e.count <= 4 ? e.at : base + e.value;
    if (start + e.count > end) return undefined;
    let s = '';
    for (let i = 0; i < e.count; i++) {
      const c = view.getUint8(start + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  const ifd0 = u32(base + 4);
  const exifPtr = find(ifd0, TAG_EXIF_IFD);
  const candidates: [number, number][] = [];
  if (exifPtr) {
    candidates.push([exifPtr.value, TAG_DATETIME_ORIGINAL], [exifPtr.value, TAG_DATETIME_DIGITIZED]);
  }
  candidates.push([ifd0, TAG_DATETIME]);
  for (const [ifd, tag] of candidates) {
    const e = find(ifd, tag);
    if (!e || e.type !== 2) continue;
    const text = ascii(e);
    const t = text ? parseExifDate(text) : undefined;
    if (t !== undefined) return t;
  }
  return undefined;
}
