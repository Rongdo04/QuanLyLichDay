import { describe, expect, it } from 'vitest';
import { sinhLich, sinhLichChiTiet } from '../src/services/sinhLich.js';

describe('sinhLich', () => {
  it('Mạng Máy tính_Thanh Trì: T5+T6 từ 29/10 đến 04/12/2026 ra 12 ngày', () => {
    const ds = sinhLich({ batDau: '2026-10-29', ketThuc: '2026-12-04', thu: { 5: 'S', 6: 'S' } });
    expect(ds).toHaveLength(12);
    expect(ds[0]).toEqual({ ngay: '2026-10-29', thu: 'Thứ 5', du_kien: 'S' });
    expect(ds.at(-1)!.ngay).toBe('2026-12-04');
  });

  it('bỏ qua ngày nghỉ (một ngày và khoảng ngày)', () => {
    const ds = sinhLich({
      batDau: '2026-10-29',
      ketThuc: '2026-12-04',
      thu: { 5: 'S', 6: 'S' },
      ngayNghi: ['2026-11-20', { tu: '2026-11-26', den: '2026-11-27', ten: 'Nghỉ' }],
    });
    expect(ds).toHaveLength(9);
    expect(ds.map((d) => d.ngay)).not.toContain('2026-11-20');
  });

  it('đủ N buổi: chiều T4 + cả ngày T7, 15 buổi', () => {
    const ds = sinhLich({ batDau: '2026-09-23', soBuoi: 15, thu: { 4: 'C', 7: 'SC' } });
    // 5 ngày T4 (5 buổi) + 5 ngày T7 (10 buổi) = 15 buổi
    expect(ds).toHaveLength(10);
    expect(ds.at(-1)!.ngay).toBe('2026-10-24');
  });

  it('không tạo trùng ngày đã có', () => {
    const ds = sinhLich({
      batDau: '2026-10-29',
      ketThuc: '2026-11-06',
      thu: { 5: 'S', 6: 'S' },
      ngayDaCo: ['2026-10-30'],
    });
    expect(ds.map((d) => d.ngay)).toEqual(['2026-10-29', '2026-11-05', '2026-11-06']);
  });

  it('có Chủ nhật', () => {
    const ds = sinhLich({ batDau: '2026-10-19', ketThuc: '2026-10-25', thu: { 8: 'SC' } });
    expect(ds).toEqual([{ ngay: '2026-10-25', thu: 'CN', du_kien: 'SC' }]);
  });

  it('trả về các ngày bị bỏ qua kèm lý do', () => {
    const kq = sinhLichChiTiet({
      batDau: '2026-11-16',
      ketThuc: '2026-11-22',
      thu: { 5: 'S', 6: 'S' },
      ngayNghi: [{ tu: '2026-11-20', ten: 'Nhà giáo VN' }],
      ngayDaCo: ['2026-11-19'],
    });
    expect(kq.ngay).toEqual([]);
    expect(kq.boQua).toEqual([
      { ngay: '2026-11-19', thu: 'Thứ 5', ly_do: 'Đã có trong lịch' },
      { ngay: '2026-11-20', thu: 'Thứ 6', ly_do: 'Nghỉ: Nhà giáo VN' },
    ]);
  });

  it('báo lỗi khi thiếu cả ngày kết thúc lẫn số buổi', () => {
    expect(() => sinhLich({ batDau: '2026-10-19', thu: { 2: 'S' } })).toThrow();
  });
});
