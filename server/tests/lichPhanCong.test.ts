import { describe, expect, it } from 'vitest';
import { moTaThu, phanTichLichPhanCong, taoLichPhanCong } from '../src/utils/lichPhanCong.js';

describe('lichPhanCong', () => {
  it('mô tả các thứ', () => {
    expect(moTaThu({ 4: 'C', 7: 'SC' })).toBe('Chiều T4 và cả ngày T7');
    expect(moTaThu({ 2: 'S', 4: 'S' })).toBe('Sáng T2, T4');
    expect(moTaThu({ 2: 'S', 4: 'C', 8: 'SC' })).toBe('Sáng T2, chiều T4 và cả ngày CN');
    expect(moTaThu({})).toBe('');
  });

  it('tạo chuỗi lịch phân công', () => {
    expect(taoLichPhanCong({ 4: 'C', 7: 'SC' }, { ngay: '2026-10-28', du_kien: 'C' })).toBe(
      'Chiều T4 và cả ngày T7. Bắt đầu từ chiều thứ 4 28/10/2026',
    );
    expect(taoLichPhanCong({ 8: 'SC' }, { ngay: '2026-10-25', du_kien: 'SC' })).toBe(
      'Cả ngày CN. Bắt đầu từ ngày chủ nhật 25/10/2026',
    );
  });

  it('đọc chuỗi lịch phân công trong file cũ', () => {
    expect(phanTichLichPhanCong('Chiều T4 và ngày T7. Bắt đầu từ chiều thứ 4  28/10/2026')).toEqual({
      thu: { 4: 'C', 7: 'SC' },
      batDau: '2026-10-28',
    });
    expect(phanTichLichPhanCong('Sáng T2, T4 hàng tuần. Bắt đầu từ sáng thứ 2 26/10/2026  ')).toEqual({
      thu: { 2: 'S', 4: 'S' },
      batDau: '2026-10-26',
    });
    expect(phanTichLichPhanCong('Sáng T5 và chiều T5, cả ngày CN')).toEqual({
      thu: { 5: 'SC', 8: 'SC' },
      batDau: null,
    });
    expect(phanTichLichPhanCong('Ngày T5, Ngày T6 từ 29/5/2026')).toEqual({
      thu: { 5: 'SC', 6: 'SC' },
      batDau: '2026-05-29',
    });
    expect(phanTichLichPhanCong(null)).toEqual({ thu: {}, batDau: null });
  });
});
