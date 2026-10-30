import { layDb } from '../db/connection.js';
import { LoiApp } from '../utils/loi.js';
import { tinhLop, type KetQuaLop, type TinhTheo } from '../services/tinhTien.js';
import { layCaiDat } from './caiDat.js';
import { buoiCuaLop, type Buoi } from './buoi.js';
import { capNhat, chen, xoa } from './chung.js';
import { kyHocCuaNgay } from './kyHoc.js';

export type TrangThai = 'dang_day' | 'hoan_thanh' | 'tam_dung';

export interface Lop {
  id: number;
  truong_id: number;
  dia_diem_id: number | null;
  ten_sheet: string;
  ma_lop: string | null;
  lop_van_hoa: string | null;
  hoc_phan: string;
  so_tiet: number | null;
  so_buoi_ke_hoach: number | null;
  don_gia: number;
  tinh_theo: TinhTheo;
  tiet_moi_buoi: number;
  lich_phan_cong: string | null;
  lich_tuan: string | null; // JSON {"4":"C","7":"SC"}
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
  trang_thai: TrangThai;
  da_thanh_toan: number; // 0/1: trường đã thanh toán tiền lớp này
  ky_hoc_id: number | null;
  thu_tu: number;
  tao_luc: string;
}

// Lớp kèm tên trường, địa điểm
export interface LopDayDu extends Lop {
  truong_ma: string;
  truong_ten: string;
  thue_truong: number;
  dia_diem_ten: string | null;
  dia_diem_ten_day_du: string | null;
  tien_dc_dia_diem: number | null;
  ky_hoc_ten: string | null;
}

export type DuLieuLop = Omit<Lop, 'id' | 'tao_luc' | 'thu_tu' | 'lich_tuan' | 'so_tiet' | 'tinh_theo' | 'tiet_moi_buoi' | 'da_thanh_toan' | 'ky_hoc_id'> & {
  tinh_theo?: TinhTheo;
  ky_hoc_id?: number | null; // bỏ trống khi tạo: tự xếp theo ngày bắt đầu
  da_thanh_toan?: number;
  tiet_moi_buoi?: number;
  thu_tu?: number;
  lich_tuan?: string | null;
  so_tiet?: number | null;
};

const SQL_LOP = `
  SELECT l.*, t.ma AS truong_ma, t.ten AS truong_ten, t.thue AS thue_truong,
         d.ten_ngan AS dia_diem_ten, d.ten_day_du AS dia_diem_ten_day_du, d.tien_dc AS tien_dc_dia_diem,
         k.ten AS ky_hoc_ten
  FROM lop l
  JOIN truong t ON t.id = l.truong_id
  LEFT JOIN dia_diem d ON d.id = l.dia_diem_id
  LEFT JOIN ky_hoc k ON k.id = l.ky_hoc_id`;

export interface LocLop {
  truongId?: number;
  trangThai?: TrangThai;
  ids?: number[];
}

export function dsLopThuan(loc: LocLop = {}): LopDayDu[] {
  const dk: string[] = [];
  const ts: unknown[] = [];
  if (loc.truongId) (dk.push('l.truong_id = ?'), ts.push(loc.truongId));
  if (loc.trangThai) (dk.push('l.trang_thai = ?'), ts.push(loc.trangThai));
  if (loc.ids?.length) (dk.push(`l.id IN (${loc.ids.map(() => '?').join(',')})`), ts.push(...loc.ids));
  return layDb()
    .prepare(`${SQL_LOP} ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''} ORDER BY t.da_an, t.id, l.thu_tu, l.id`)
    .all(...ts) as LopDayDu[];
}

// Danh sách lớp kèm số liệu tổng (toàn bộ các ngày của lớp)
export function dsLop(loc: LocLop = {}): (LopDayDu & KetQuaLop & { soNgay: number })[] {
  const dsL = dsLopThuan(loc);
  if (dsL.length === 0) return [];
  const tatCaBuoi = layDb()
    .prepare(`SELECT * FROM buoi WHERE lop_id IN (${dsL.map(() => '?').join(',')})`)
    .all(...dsL.map((l) => l.id)) as Buoi[];
  const theoLop = new Map<number, Buoi[]>();
  for (const b of tatCaBuoi) {
    if (!theoLop.has(b.lop_id)) theoLop.set(b.lop_id, []);
    theoLop.get(b.lop_id)!.push(b);
  }
  return dsL.map((l) => {
    const ds = theoLop.get(l.id) ?? [];
    return { ...l, ...tinhLop(l, l.tien_dc_dia_diem, ds), soNgay: ds.length };
  });
}

export function layLop(id: number): LopDayDu | undefined {
  return layDb().prepare(`${SQL_LOP} WHERE l.id = ?`).get(id) as LopDayDu | undefined;
}

// Chi tiết lớp kèm danh sách buổi và số liệu
export function chiTietLop(id: number) {
  const lop = layLop(id);
  if (!lop) return undefined;
  const buoi = buoiCuaLop(id);
  return { ...lop, ...tinhLop(lop, lop.tien_dc_dia_diem, buoi), soNgay: buoi.length, buoi };
}

// Tên sheet Excel: ≤ 31 ký tự, không chứa : \ / ? * [ ], không trùng trong một trường
export function kiemTraTenSheet(truongId: number, tenSheet: string, boQuaId?: number) {
  const trung = layDb()
    .prepare('SELECT id FROM lop WHERE truong_id = ? AND lower(ten_sheet) = lower(?) AND id <> ?')
    .get(truongId, tenSheet, boQuaId ?? 0);
  if (trung) throw new LoiApp(409, `Trường này đã có lớp với tên sheet "${tenSheet}"`);
}

function kiemTraThamChieu(d: Partial<DuLieuLop>) {
  const db = layDb();
  if (d.truong_id !== undefined && !db.prepare('SELECT 1 FROM truong WHERE id = ?').get(d.truong_id))
    throw new LoiApp(400, 'Trường không tồn tại');
  if (d.dia_diem_id != null && !db.prepare('SELECT 1 FROM dia_diem WHERE id = ?').get(d.dia_diem_id))
    throw new LoiApp(400, 'Địa điểm không tồn tại');
  if (d.ky_hoc_id != null && !db.prepare('SELECT 1 FROM ky_hoc WHERE id = ?').get(d.ky_hoc_id))
    throw new LoiApp(400, 'Kỳ học không tồn tại');
}

function thuTuTiepTheo(truongId: number): number {
  const { m } = layDb().prepare('SELECT coalesce(max(thu_tu), 0) AS m FROM lop WHERE truong_id = ?').get(truongId) as {
    m: number;
  };
  return m + 1;
}

export function taoLop(d: DuLieuLop): LopDayDu {
  kiemTraThamChieu(d);
  kiemTraTenSheet(d.truong_id, d.ten_sheet);
  const id = chen('lop', {
    ...d,
    tinh_theo: d.tinh_theo ?? 'buoi',
    tiet_moi_buoi: d.tiet_moi_buoi ?? layCaiDat().tiet_moi_buoi,
    da_thanh_toan: d.da_thanh_toan ?? 0,
    ky_hoc_id: d.ky_hoc_id !== undefined ? d.ky_hoc_id : d.ngay_bat_dau ? (kyHocCuaNgay(d.ngay_bat_dau)?.id ?? null) : null,
    thu_tu: d.thu_tu ?? thuTuTiepTheo(d.truong_id),
  });
  return layLop(id)!;
}

export function suaLop(id: number, d: Partial<DuLieuLop>): LopDayDu {
  const cu = layLop(id)!;
  kiemTraThamChieu(d);
  if (d.ten_sheet !== undefined || d.truong_id !== undefined)
    kiemTraTenSheet(d.truong_id ?? cu.truong_id, d.ten_sheet ?? cu.ten_sheet, id);
  capNhat('lop', id, d);
  return layLop(id)!;
}

// Tổng ô sáng + chiều đã chấm của lớp
export function soBuoiDaDay(lopId: number): number {
  const r = layDb()
    .prepare('SELECT COALESCE(SUM((sang <> 0) + (chieu <> 0)), 0) AS n FROM buoi WHERE lop_id = ?')
    .get(lopId) as { n: number };
  return r.n;
}

// Chấm đủ số buổi kế hoạch → tự chuyển "hoàn thành". Truyền daDayTruoc (số buổi trước khi sửa) thì
// bỏ chấm làm tụt từ đủ xuống thiếu → trả về "đang dạy". Lớp "tạm dừng" và lớp không có kế hoạch giữ nguyên.
export function dongBoTrangThai(lopId: number, daDayTruoc?: number) {
  const lop = layLop(lopId);
  const keHoach = lop?.so_buoi_ke_hoach;
  if (!lop || !keHoach) return;
  const daDay = soBuoiDaDay(lopId);
  if (lop.trang_thai === 'dang_day' && daDay >= keHoach) capNhat('lop', lopId, { trang_thai: 'hoan_thanh' });
  else if (lop.trang_thai === 'hoan_thanh' && daDayTruoc !== undefined && daDayTruoc >= keHoach && daDay < keHoach)
    capNhat('lop', lopId, { trang_thai: 'dang_day' });
}

export function xoaLop(id: number) {
  xoa('lop', id);
}

export function timLopTheoTenSheet(truongId: number, tenSheet: string): Lop | undefined {
  return layDb()
    .prepare('SELECT * FROM lop WHERE truong_id = ? AND lower(ten_sheet) = lower(?)')
    .get(truongId, tenSheet) as Lop | undefined;
}

// Tạo tên sheet chưa dùng: "Tên_2", "Tên_3"… (cắt cho vừa 31 ký tự)
export function tenSheetMoi(truongId: number, goc: string): string {
  const db = layDb();
  const daCo = (ten: string) =>
    !!db.prepare('SELECT 1 FROM lop WHERE truong_id = ? AND lower(ten_sheet) = lower(?)').get(truongId, ten);
  for (let i = 2; i < 1000; i++) {
    const duoi = `_${i}`;
    const ten = goc.slice(0, 31 - duoi.length) + duoi;
    if (!daCo(ten)) return ten;
  }
  throw new LoiApp(409, 'Không tạo được tên sheet mới');
}

// Nhân bản: giữ thông tin lớp, không chép các ngày dạy
export function nhanBanLop(id: number, ghiDe: Partial<DuLieuLop> = {}): LopDayDu {
  const l = layLop(id)!;
  const truongId = ghiDe.truong_id ?? l.truong_id;
  const tenSheet = ghiDe.ten_sheet ?? tenSheetMoi(truongId, l.ten_sheet);
  return taoLop({
    truong_id: truongId,
    dia_diem_id: l.dia_diem_id,
    ten_sheet: tenSheet,
    ma_lop: l.ma_lop,
    lop_van_hoa: l.lop_van_hoa,
    hoc_phan: l.hoc_phan,
    so_tiet: l.so_tiet,
    so_buoi_ke_hoach: l.so_buoi_ke_hoach,
    don_gia: l.don_gia,
    tinh_theo: l.tinh_theo,
    tiet_moi_buoi: l.tiet_moi_buoi,
    lich_phan_cong: null,
    lich_tuan: l.lich_tuan,
    ngay_bat_dau: null,
    ngay_ket_thuc: null,
    trang_thai: 'dang_day',
    da_thanh_toan: 0,
    ky_hoc_id: l.ky_hoc_id, // học phần mới của cùng lớp: thường cùng kỳ
    ...ghiDe,
  });
}
