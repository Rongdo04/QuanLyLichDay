import { describe, expect, it } from 'vitest';
import { doiLichTheoMau, sinhLich, sinhLichChiTiet, soBuoiDuKien } from '../src/services/sinhLich.js';

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

describe('doiLichTheoMau: dư buổi thì bỏ lần lượt từ cuối', () => {
  const ts = { batDau: '2026-10-06', ketThuc: '2026-11-03', soBuoi: 13, thu: { 2: 'S', 3: 'SC' } as const };

  it('sáng T2 + cả ngày T3, 13 buổi: giữ 02/11, 03/11 chỉ còn sáng', () => {
    const kq = doiLichTheoMau(ts, []);
    expect(kq.lich).toHaveLength(9);
    expect(kq.lich.slice(-2)).toMatchObject([
      { ngay: '2026-11-02', du_kien: 'S' },
      { ngay: '2026-11-03', du_kien: 'S' },
    ]);
    expect(kq).toMatchObject({ tongBuoi: 13, thieu: 0, ketThuc: '2026-11-03' });
  });

  it('ngày đã có cả ngày ở cuối → đổi dự kiến sang sáng, không xóa ngày trước đó', () => {
    const daCo = [
      { id: 1, ngay: '2026-11-02', sang: 0, chieu: 0, ghi_chu: null, du_kien: 'S' as const },
      { id: 2, ngay: '2026-11-03', sang: 0, chieu: 0, ghi_chu: null, du_kien: 'SC' as const },
    ];
    const kq = doiLichTheoMau(ts, daCo);
    expect(kq.xoa).toEqual([]);
    expect(kq.doiDuKien).toEqual([{ id: 2, ngay: '2026-11-03', du_kien: 'S', cu: 'SC' }]);
  });

  it('dư nhiều hơn một buổi: bỏ chiều rồi bỏ cả ngày, lùi dần từ cuối', () => {
    const kq = doiLichTheoMau({ ...ts, soBuoi: 10 }, []);
    expect(kq.lich.at(-1)).toMatchObject({ ngay: '2026-10-27', du_kien: 'S' });
    expect(kq.tongBuoi).toBe(10);
  });

  it('tạo lịch theo số buổi: buổi cuối cả ngày chỉ còn thiếu 1 thì chỉ dạy sáng', () => {
    const { ngay } = sinhLichChiTiet({ batDau: '2026-10-06', soBuoi: 13, thu: { 2: 'S', 3: 'SC' } });
    expect(ngay.at(-1)).toMatchObject({ ngay: '2026-11-03', du_kien: 'S' });
    expect(ngay.reduce((s, n) => s + soBuoiDuKien(n.du_kien), 0)).toBe(13);
  });
});

describe('doiLichTheoMau: ngày đã chấm tính theo số buổi thực dạy', () => {
  it('Quản trị mạng_AK: 12 buổi, 06/10 chỉ chấm sáng → 02/11 sáng, 03/11 chỉ còn sáng (giữ ngày)', () => {
    const cham = (id: number, ngay: string, sang: number, chieu: number) =>
      ({ id, ngay, sang, chieu, ghi_chu: null, du_kien: null }) as const;
    const daCo = [
      cham(1, '2026-10-06', 1, 0),
      cham(2, '2026-10-12', 1, 0),
      cham(3, '2026-10-13', 1, 1),
      cham(4, '2026-10-19', 1, 0),
      cham(5, '2026-10-20', 1, 1),
      cham(6, '2026-10-26', 1, 0),
      cham(7, '2026-10-27', 1, 1),
      { id: 8, ngay: '2026-11-02', sang: 0, chieu: 0, ghi_chu: null, du_kien: 'S' as const },
      { id: 9, ngay: '2026-11-03', sang: 0, chieu: 0, ghi_chu: null, du_kien: 'SC' as const },
    ];
    const kq = doiLichTheoMau(
      { batDau: '2026-10-06', ketThuc: '2026-11-03', soBuoi: 12, thu: { 2: 'S', 3: 'SC' } },
      daCo,
    );
    expect(kq.xoa).toEqual([]);
    expect(kq.them).toEqual([]);
    expect(kq.doiDuKien).toEqual([{ id: 9, ngay: '2026-11-03', du_kien: 'S', cu: 'SC' }]);
    expect(kq).toMatchObject({ tongBuoi: 12, thieu: 0, ketThuc: '2026-11-03' });
  });
});
