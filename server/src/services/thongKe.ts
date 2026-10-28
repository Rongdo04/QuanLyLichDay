import dayjs from 'dayjs';
import { dsBuoi, type BuoiDayDu } from '../repositories/buoi.js';
import { dsLopThuan } from '../repositories/lop.js';
import { dsTruong } from '../repositories/truong.js';
import { congKetQua, giaMotBuoi, soBuoiTrongNgay, tienDcNgay, tienThue, tinhLop } from './tinhTien.js';

export interface LocThongKe {
  tu?: string;
  den?: string;
  truongId?: number;
}

// Tổng hợp theo trường → lớp trong một khoảng ngày (chỉ các lớp có ngày trong kỳ)
export function thongKe(loc: LocThongKe) {
  const buoi = dsBuoi(loc);
  const theoLop = new Map<number, BuoiDayDu[]>();
  for (const b of buoi) {
    if (!theoLop.has(b.lop_id)) theoLop.set(b.lop_id, []);
    theoLop.get(b.lop_id)!.push(b);
  }
  const dsLop = dsLopThuan({ truongId: loc.truongId, ids: [...theoLop.keys()] }).filter((l) => theoLop.has(l.id));

  const truong = dsTruong()
    .filter((t) => !loc.truongId || t.id === loc.truongId)
    .map((t) => {
      const lop = dsLop
        .filter((l) => l.truong_id === t.id)
        .map((l) => ({
          id: l.id,
          ten_sheet: l.ten_sheet,
          hoc_phan: l.hoc_phan,
          ma_lop: l.ma_lop,
          don_gia: l.don_gia,
          tinh_theo: l.tinh_theo,
          tiet_moi_buoi: l.tiet_moi_buoi,
          so_buoi_ke_hoach: l.so_buoi_ke_hoach,
          trang_thai: l.trang_thai,
          da_thanh_toan: l.da_thanh_toan,
          dia_diem_ten: l.dia_diem_ten,
          soNgay: theoLop.get(l.id)!.length,
          ...tinhLop(l, l.tien_dc_dia_diem, theoLop.get(l.id)!),
        }));
      return { id: t.id, ma: t.ma, ten: t.ten, thue: t.thue, ...congKetQua(lop), daThanhToan: congKetQua(lop.filter((l) => l.da_thanh_toan)), lop };
    })
    .filter((t) => t.lop.length > 0);

  return {
    tu: loc.tu ?? null,
    den: loc.den ?? null,
    tong: congKetQua(truong),
    daThanhToan: congKetQua(truong.map((t) => t.daThanhToan)),
    truong,
  };
}

// '2026-2027' → 01/09/2026 … 31/08/2027
export function khoangNamHoc(namHoc: string): { tu: string; den: string } {
  const m = /^(\d{4})\s*-\s*(\d{4})$/.exec(namHoc.trim());
  const nam = m ? Number(m[1]) : dayjs().month() >= 8 ? dayjs().year() : dayjs().year() - 1;
  return { tu: `${nam}-09-01`, den: `${nam + 1}-08-31` };
}

// Tổng tiền theo từng tháng × trường trong một năm học
export function thongKeThang(namHoc: string) {
  const { tu, den } = khoangNamHoc(namHoc);
  return { namHoc, ...thongKeTheoThang(tu, den) };
}

// Tổng tiền theo từng tháng × trường trong khoảng ngày bất kỳ
export function thongKeTheoThang(tu: string, den: string) {
  const buoi = dsBuoi({ tu, den });
  const dsT = dsTruong();

  const rong = () => ({ soBuoi: 0, tienDay: 0, tienDc: 0, tong: 0, tienThue: 0, tongCoThue: 0 });
  const thang: { thang: string; nhan: string; theoTruong: Record<number, ReturnType<typeof rong>>; tong: ReturnType<typeof rong> }[] = [];
  const thangCuoi = dayjs(den).startOf('month');
  for (let d = dayjs(tu).startOf('month'); !d.isAfter(thangCuoi); d = d.add(1, 'month')) {
    thang.push({ thang: d.format('YYYY-MM'), nhan: d.format('MM/YYYY'), theoTruong: {}, tong: rong() });
  }
  const viTri = new Map(thang.map((t, i) => [t.thang, i]));

  for (const b of buoi) {
    const dong = thang[viTri.get(b.ngay.slice(0, 7))!];
    const n = soBuoiTrongNgay(b);
    const dc = tienDcNgay(b, b.tien_dc_dia_diem);
    const tienDay = n * giaMotBuoi(b);
    const thue = tienThue(tienDay, b.thue_truong);
    for (const o of [(dong.theoTruong[b.truong_id] ??= rong()), dong.tong]) {
      o.soBuoi += n;
      o.tienDay += tienDay;
      o.tienDc += dc;
      o.tong += tienDay + dc;
      o.tienThue += thue;
      o.tongCoThue += tienDay + dc + thue;
    }
  }

  const coDuLieu = new Set(buoi.map((b) => b.truong_id));
  return {
    tu,
    den,
    truong: dsT.filter((t) => coDuLieu.has(t.id) || !t.da_an).map((t) => ({ id: t.id, ma: t.ma, ten: t.ten })),
    thang,
    tong: congKetQua(thang.map((t) => t.tong)),
  };
}
