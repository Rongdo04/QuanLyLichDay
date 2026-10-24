// Mọi quy tắc tính tiền (đơn vị: nghìn đồng), xem SPEC mục 5

export interface BuoiTinh {
  ngay: string;
  sang: number | boolean;
  chieu: number | boolean;
  co_tien_dc: number | boolean;
}

export interface KetQuaLop {
  soBuoi: number;      // tổng ô sáng + chiều đã dạy
  soNgayDay: number;   // số ngày có ít nhất 1 buổi
  tienDay: number;
  tienDc: number;
  tong: number;
  tienDo: number | null; // soBuoi / so_buoi_ke_hoach
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

export function tinhLop(
  lop: { don_gia: number; so_buoi_ke_hoach?: number | null },
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
  const tienDay = soBuoi * lop.don_gia;
  return {
    soBuoi,
    soNgayDay,
    tienDay,
    tienDc,
    tong: tienDay + tienDc,
    tienDo: lop.so_buoi_ke_hoach ? soBuoi / lop.so_buoi_ke_hoach : null,
  };
}

// Cộng dồn nhiều kết quả (dùng cho thống kê theo trường / kỳ)
export function congKetQua(ds: Pick<KetQuaLop, 'soBuoi' | 'tienDay' | 'tienDc' | 'tong'>[]) {
  return ds.reduce(
    (a, k) => ({
      soBuoi: a.soBuoi + k.soBuoi,
      tienDay: a.tienDay + k.tienDay,
      tienDc: a.tienDc + k.tienDc,
      tong: a.tong + k.tong,
    }),
    { soBuoi: 0, tienDay: 0, tienDc: 0, tong: 0 },
  );
}
