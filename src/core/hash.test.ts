import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';

describe('sha256Hex', () => {
  it('既知の値（"abc"）に一致する', async () => {
    const data = new TextEncoder().encode('abc').buffer as ArrayBuffer;
    expect(await sha256Hex(data)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('空のデータも扱える', async () => {
    expect(await sha256Hex(new ArrayBuffer(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('1 バイト違えば別の値になる', async () => {
    const a = new Uint8Array([1, 2, 3]).buffer as ArrayBuffer;
    const b = new Uint8Array([1, 2, 4]).buffer as ArrayBuffer;
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b));
  });
});
