import { describe, expect, it } from 'vitest';
import { parseExifDate, readExifDate } from './exif';

/** EXIF 付きの最小の JPEG（SOI + APP1 + EOI）を組み立てる */
function buildJpeg(opts: { little?: boolean; original?: string; datetime?: string; app0First?: boolean } = {}): ArrayBuffer {
  const little = opts.little ?? true;
  const enc = new TextEncoder();
  // TIFF: ヘッダ 8 バイト + IFD0 + ExifIFD + 文字列領域
  const entries0: { tag: number; type: number; count: number; value: number | string }[] = [];
  const strings: string[] = [];
  const ifd0Entries = (opts.datetime ? 2 : 1);
  const ifd0Size = 2 + ifd0Entries * 12 + 4;
  const exifOffset = 8 + ifd0Size;
  const exifSize = 2 + (opts.original ? 1 : 0) * 12 + 4;
  let strPos = exifOffset + exifSize;
  const place = (s: string) => { const at = strPos; strings.push(s + '\0'); strPos += s.length + 1; return at; };
  const dtOffset = opts.datetime ? place(opts.datetime) : 0;
  const origOffset = opts.original ? place(opts.original) : 0;
  void entries0;

  const buf = new ArrayBuffer(8 + ifd0Size + exifSize + (strPos - exifOffset - exifSize));
  const v = new DataView(buf);
  v.setUint16(0, little ? 0x4949 : 0x4d4d);
  v.setUint16(2, 42, little);
  v.setUint32(4, 8, little);
  let p = 8;
  v.setUint16(p, ifd0Entries, little); p += 2;
  const entry = (tag: number, type: number, count: number, value: number) => {
    v.setUint16(p, tag, little); v.setUint16(p + 2, type, little); v.setUint32(p + 4, count, little); v.setUint32(p + 8, value, little); p += 12;
  };
  if (opts.datetime) entry(0x0132, 2, 20, dtOffset);
  entry(0x8769, 4, 1, exifOffset);
  v.setUint32(p, 0, little); p += 4;
  v.setUint16(p, opts.original ? 1 : 0, little); p += 2;
  if (opts.original) entry(0x9003, 2, 20, origOffset);
  v.setUint32(p, 0, little); p += 4;
  const bytes = new Uint8Array(buf);
  for (const s of strings) { bytes.set(enc.encode(s), p); p += s.length; }

  const header = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0]); // "Exif\0\0"
  const app1Len = 2 + header.length + bytes.length;
  const parts: number[] = [0xff, 0xd8];
  if (opts.app0First) parts.push(0xff, 0xe0, 0, 4, 0, 0);
  parts.push(0xff, 0xe1, app1Len >> 8, app1Len & 0xff, ...header, ...bytes, 0xff, 0xd9);
  return new Uint8Array(parts).buffer;
}

describe('parseExifDate', () => {
  it('EXIF の日時文字列をローカル時刻のミリ秒にする', () => {
    expect(parseExifDate('2025:08:14 13:22:05')).toBe(new Date(2025, 7, 14, 13, 22, 5).getTime());
  });
  it('不正な値は undefined（0000:00:00 など）', () => {
    expect(parseExifDate('0000:00:00 00:00:00')).toBeUndefined();
    expect(parseExifDate('2025:13:01 00:00:00')).toBeUndefined();
    expect(parseExifDate('abc')).toBeUndefined();
    expect(parseExifDate('')).toBeUndefined();
  });
});

describe('readExifDate', () => {
  const t = new Date(2024, 2, 9, 8, 30, 0).getTime();

  it('リトルエンディアンの DateTimeOriginal を読む', () => {
    expect(readExifDate(buildJpeg({ original: '2024:03:09 08:30:00' }))).toBe(t);
  });

  it('ビッグエンディアンも読める', () => {
    expect(readExifDate(buildJpeg({ little: false, original: '2024:03:09 08:30:00' }))).toBe(t);
  });

  it('APP0 が先にあっても APP1 を見つける', () => {
    expect(readExifDate(buildJpeg({ app0First: true, original: '2024:03:09 08:30:00' }))).toBe(t);
  });

  it('DateTimeOriginal が無ければ、IFD0 の DateTime で代用する', () => {
    expect(readExifDate(buildJpeg({ datetime: '2024:03:09 08:30:00' }))).toBe(t);
  });

  it('DateTimeOriginal を DateTime より優先する', () => {
    const r = readExifDate(buildJpeg({ original: '2024:03:09 08:30:00', datetime: '2030:01:01 00:00:00' }));
    expect(r).toBe(t);
  });

  it('日時の無い EXIF・JPEG 以外・壊れたデータは undefined', () => {
    expect(readExifDate(buildJpeg({}))).toBeUndefined();
    expect(readExifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).buffer)).toBeUndefined();
    expect(readExifDate(new ArrayBuffer(0))).toBeUndefined();
    expect(readExifDate(buildJpeg({ original: '2024:03:09 08:30:00' }).slice(0, 30))).toBeUndefined();
  });
});
