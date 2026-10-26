// Mọi quy tắc tính tiền (đơn vị: nghìn đồng), xem SPEC mục 5

export interface BuoiTinh {
  ngay: string;
  sang: number | boolean;
  chieu: number | boolean;
  co_tien_dc: number | boolean;
}

export type TinhTheo = 'buoi' | 'tiet';

// Cách tính tiền của một lớp: theo buổi thì don_gia là giá một buổi, theo tiết thì là giá một tiết
export interface GiaLop {
  don_gia: number;
  tinh_theo?: TinhTheo | string | null;
  tiet_moi_buoi?: number | null;
}

export interface KetQuaLop {
  soBuoi: number;      // tổng ô sáng + chiều đã dạy
  soTiet: number;      // soBuoi × số tiết một buổi
  soNgayDay: number;   // số ngày có ít nhất 1 buổi
  tienDay: number;
  tienDc: number;
  tong: number;          // tiền nhận về = tiền dạy + tiền DC
  tienThue: number;      // thuế của trường tính trên tiền dạy (0 nếu trường không có thuế)
  tongCoThue: number;    // tong + tienThue
  tienDo: number | null; // soBuoi / so_buoi_ke_hoach
}

// Thuế cộng thêm trên tiền dạy, làm tròn đến nghìn đồng. VD thuế 10% của 400 → 40
export function tienThue(tienDay: number, thuePhanTram: number | null | undefined): number {
  return thuePhanTram ? Math.round((tienDay * thuePhanTram) / 100) : 0;
}

// Số buổi của một ngày: 0, 1 hoặc 2
export function soBuoiTrongNgay(b: Pick<BuoiTinh, 'sang' | 'chieu'>): number {
  return (b.sang ? 1 : 0) + (b.chieu ? 1 : 0);
}

// Tiền DC của một ngày: chỉ tính khi ngày đó đã dạy và chưa bị tắt
export function tienDcNgay(b: BuoiTinh, tienDcDiaDiem: number | null | undefined): number {
  if (!tienDcDiaDiem) return 0;
  if (!b.co_tien_dc) return 0;
  return soBuoiTrongNgay(b) > 0 ? tienDcDiaDiem : 0;
}

// Tiền dạy của một buổi (một ô sáng hoặc chiều)
export function giaMotBuoi(lop: GiaLop): number {
  return lop.tinh_theo === 'tiet' ? lop.don_gia * (lop.tiet_moi_buoi || 5) : lop.don_gia;
}

export function tinhLop(
  lop: GiaLop & { so_buoi_ke_hoach?: number | null; thue_truong?: number | null },
  tienDcDiaDiem: number | null | undefined,
  dsBuoi: BuoiTinh[],
): KetQuaLop {
  let soBuoi = 0;
  let soNgayDay = 0;
  let tienDc = 0;
  for (const b of dsBuoi) {
    const n = soBuoiTrongNgay(b);
    soBuoi += n;
    if (n > 0) soNgayDay++;
    tienDc += tienDcNgay(b, tienDcDiaDiem);
  }
  const tienDay = soBuoi * giaMotBuoi(lop);
  const thue = tienThue(tienDay, lop.thue_truong);
  return {
    soBuoi,
    soTiet: soBuoi * (lop.tiet_moi_buoi || 5),
    soNgayDay,
    tienDay,
    tienDc,
    tong: tienDay + tienDc,
    tienThue: thue,
    tongCoThue: tienDay + tienDc + thue,
    tienDo: lop.so_buoi_ke_hoach ? soBuoi / lop.so_buoi_ke_hoach : null,
  };
}

// Cộng dồn nhiều kết quả (dùng cho thống kê theo trường / kỳ)
export function congKetQua(ds: Pick<KetQuaLop, 'soBuoi' | 'tienDay' | 'tienDc' | 'tong' | 'tienThue' | 'tongCoThue'>[]) {
  return ds.reduce(
    (a, k) => ({
      soBuoi: a.soBuoi + k.soBuoi,
      tienDay: a.tienDay + k.tienDay,
      tienDc: a.tienDc + k.tienDc,
      tong: a.tong + k.tong,
      tienThue: a.tienThue + k.tienThue,
      tongCoThue: a.tongCoThue + k.tongCoThue,
    }),
    { soBuoi: 0, tienDay: 0, tienDc: 0, tong: 0, tienThue: 0, tongCoThue: 0 },
  );
}
