import { describe, expect, it } from 'vitest';
import { thuCuaNgay, soThu } from '../src/utils/thu.js';

describe('thu', () => {
  it('đổi ngày sang thứ', () => {
    expect(thuCuaNgay('2026-10-19')).toBe('Thứ 2');
    expect(thuCuaNgay('2026-10-20')).toBe('Thứ 3');
    expect(thuCuaNgay('2026-10-24')).toBe('Thứ 7');
  });
  it('Chủ nhật là "CN", không phải "Thứ 1"', () => {
    expect(thuCuaNgay('2026-10-25')).toBe('CN');
    expect(soThu('2026-10-25')).toBe(8);
  });
});
