import { layDb } from '../db/connection.js';
import { LoiApp } from '../utils/loi.js';
import { capNhat, chen, xoa } from './chung.js';

export interface KyHoc {
  id: number;
  ten: string;
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
}

// Kỳ mới nhất lên đầu (theo ngày bắt đầu, kỳ chưa có ngày xếp cuối)
export function dsKyHoc(): (KyHoc & { so_lop: number })[] {
  return layDb()
    .prepare(
      `SELECT k.*, (SELECT count(*) FROM lop l WHERE l.ky_hoc_id = k.id) AS so_lop
       FROM ky_hoc k ORDER BY k.ngay_bat_dau IS NULL, k.ngay_bat_dau DESC, k.id DESC`,
    )
    .all() as (KyHoc & { so_lop: number })[];
}

export function layKyHoc(id: number): KyHoc | undefined {
  return layDb().prepare('SELECT * FROM ky_hoc WHERE id = ?').get(id) as KyHoc | undefined;
}

// Kỳ chứa ngày này (gợi ý kỳ cho lớp theo ngày bắt đầu); nhiều kỳ chồng nhau thì lấy kỳ bắt đầu muộn nhất
export function kyHocCuaNgay(ngay: string): KyHoc | undefined {
  return layDb()
    .prepare(
      `SELECT * FROM ky_hoc WHERE ngay_bat_dau IS NOT NULL AND ngay_bat_dau <= @ngay
         AND (ngay_ket_thuc IS NULL OR ngay_ket_thuc >= @ngay)
       ORDER BY ngay_bat_dau DESC LIMIT 1`,
    )
    .get({ ngay }) as KyHoc | undefined;
}

// Tên kỳ tự sinh theo ngày bắt đầu (cùng quy tắc với migration 011):
// tháng 8–12 → HK1 năm học bắt đầu năm đó; tháng 1 → vẫn HK1 năm học trước; tháng 2–7 → HK2
export function tenKyHoc(ngayBatDau: string): string {
  const nam = Number(ngayBatDau.slice(0, 4));
  const thang = Number(ngayBatDau.slice(5, 7));
  if (thang >= 8) return `HK1_${nam}-${nam + 1}`;
  return `${thang === 1 ? 'HK1' : 'HK2'}_${nam - 1}-${nam}`;
}

export type DuLieuKyHoc = Pick<KyHoc, 'ngay_bat_dau' | 'ngay_ket_thuc'> & { ngay_bat_dau: string };

function kiemTra(ten: string, bd: string, kt: string | null, boQuaId = 0) {
  if (kt && kt < bd) throw new LoiApp(400, 'Ngày kết thúc phải sau ngày bắt đầu');
  if (layDb().prepare('SELECT 1 FROM ky_hoc WHERE ten = ? AND id <> ?').get(ten, boQuaId))
    throw new LoiApp(409, `Kỳ học ${ten} đã có`);
}

export function taoKyHoc(d: DuLieuKyHoc): KyHoc {
  const ten = tenKyHoc(d.ngay_bat_dau);
  kiemTra(ten, d.ngay_bat_dau, d.ngay_ket_thuc);
  return layKyHoc(chen('ky_hoc', { ...d, ten }))!;
}

export function suaKyHoc(id: number, d: Partial<DuLieuKyHoc>): KyHoc {
  const cu = layKyHoc(id)!;
  const bd = d.ngay_bat_dau ?? cu.ngay_bat_dau;
  const kt = d.ngay_ket_thuc !== undefined ? d.ngay_ket_thuc : cu.ngay_ket_thuc;
  // Kỳ cũ chưa có ngày bắt đầu thì giữ tên cũ
  const ten = bd ? tenKyHoc(bd) : cu.ten;
  if (bd) kiemTra(ten, bd, kt, id);
  capNhat('ky_hoc', id, { ...d, ten });
  return layKyHoc(id)!;
}

// Đưa nhiều lớp vào kỳ (lớp đang ở kỳ khác thì chuyển sang). Trả về số lớp đã đổi
export function themLopVaoKy(id: number, lopIds: number[]): number {
  const db = layDb();
  const sua = db.prepare('UPDATE lop SET ky_hoc_id = ? WHERE id = ?');
  return db.transaction(() => lopIds.reduce((n, lopId) => n + sua.run(id, lopId).changes, 0))();
}

// Xóa kỳ không xóa lớp: các lớp của kỳ chuyển về "Chưa xếp kỳ"
export function xoaKyHoc(id: number) {
  xoa('ky_hoc', id);
}
