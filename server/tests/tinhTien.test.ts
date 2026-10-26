import { describe, expect, it } from 'vitest';
import { tinhLop, tienDcNgay, congKetQua, giaMotBuoi, tienThue } from '../src/services/tinhTien.js';

// Dữ liệu thật sheet AutoCad_TT(done): chiều T4, cả ngày T7
const autoCad = [
  ['2026-09-23', 0, 1], ['2026-09-26', 1, 1], ['2026-09-30', 0, 1], ['2026-10-03', 1, 1],
  ['2026-10-07', 0, 1], ['2026-10-10', 1, 1], ['2026-10-14', 0, 1], ['2026-10-17', 1, 1],
  ['2026-10-21', 0, 1], ['2026-10-24', 1, 1],
].map(([ngay, sang, chieu]) => ({ ngay: ngay as string, sang: sang as number, chieu: chieu as number, co_tien_dc: 1 }));

describe('tinhTien', () => {
  it('ví dụ AutoCad_TT(done): 6.000 / 660 / 6.660', () => {
    const kq = tinhLop({ don_gia: 400, so_buoi_ke_hoach: 15 }, 66, autoCad);
    expect(kq.soBuoi).toBe(15);
    expect(kq.soNgayDay).toBe(10);
    expect(kq.tienDay).toBe(6000);
    expect(kq.tienDc).toBe(660);
    expect(kq.tong).toBe(6660);
    expect(kq.tienDo).toBe(1);
  });

  it('tính theo tiết: 15 buổi × 5 tiết × 80 = 6.000', () => {
    const kq = tinhLop({ don_gia: 80, tinh_theo: 'tiet', tiet_moi_buoi: 5 }, 66, autoCad);
    expect(kq.soBuoi).toBe(15);
    expect(kq.soTiet).toBe(75);
    expect(kq.tienDay).toBe(6000);
    expect(kq.tong).toBe(6660);
    expect(giaMotBuoi({ don_gia: 80, tinh_theo: 'tiet', tiet_moi_buoi: 4 })).toBe(320);
    expect(giaMotBuoi({ don_gia: 400, tinh_theo: 'buoi', tiet_moi_buoi: 4 })).toBe(400);
  });

  it('ngày chưa dạy không tính tiền DC', () => {
    const ds = [...autoCad, { ngay: '2026-10-28', sang: 0, chieu: 0, co_tien_dc: 1 }];
    const kq = tinhLop({ don_gia: 400 }, 66, ds);
    expect(kq.tienDc).toBe(660);
    expect(kq.tienDo).toBeNull();
  });

  it('dạy cả sáng lẫn chiều chỉ tính DC một lần', () => {
    expect(tienDcNgay({ ngay: '2026-10-03', sang: 1, chieu: 1, co_tien_dc: 1 }, 66)).toBe(66);
  });

  it('tắt tiền DC cho một ngày', () => {
    const ds = autoCad.map((b, i) => (i === 0 ? { ...b, co_tien_dc: 0 } : b));
    expect(tinhLop({ don_gia: 400 }, 66, ds).tienDc).toBe(594);
  });

  it('lớp không có địa điểm thì tiền DC = 0', () => {
    const kq = tinhLop({ don_gia: 350 }, null, autoCad);
    expect(kq.tienDc).toBe(0);
    expect(kq.tong).toBe(15 * 350);
  });

  it('cộng dồn kết quả', () => {
    const a = tinhLop({ don_gia: 400 }, 66, autoCad);
    expect(congKetQua([a, a])).toEqual({ soBuoi: 30, tienDay: 12000, tienDc: 1320, tong: 13320, tienThue: 0, tongCoThue: 13320 });
  });

  it('thuế trường cộng 10% trên tiền dạy, không tính trên tiền DC', () => {
    const kq = tinhLop({ don_gia: 400, thue_truong: 10 }, 66, autoCad);
    expect(kq.tong).toBe(6660);
    expect(kq.tienThue).toBe(600);
    expect(kq.tongCoThue).toBe(7260);
    expect(tienThue(400, 10)).toBe(40);
    expect(tienThue(355, 10)).toBe(36); // làm tròn đến nghìn đồng
    expect(tienThue(400, 0)).toBe(0);
  });
});
