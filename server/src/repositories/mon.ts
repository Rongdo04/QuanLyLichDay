import { layDb } from '../db/connection.js';
import { khoaSoKhop } from '../utils/chuoi.js';
import { LoiApp } from '../utils/loi.js';
import { capNhat, chen, xoa } from './chung.js';

export interface Mon {
  id: number;
  ten: string;
  ma: string | null;
  nganh: string;
  trinh_do: string;
  de_cuong: string | null;
  tao_luc: string;
}

export type DuLieuMon = Omit<Mon, 'id' | 'tao_luc'>;

export function dsMon(): (Mon & { so_cau: number; so_lop: number })[] {
  const ds = layDb()
    .prepare(
      `SELECT m.*, (SELECT count(*) FROM cau_hoi c WHERE c.mon_id = m.id) AS so_cau
       FROM mon m ORDER BY m.ten COLLATE NOCASE`,
    )
    .all() as (Mon & { so_cau: number })[];
  // Số lớp đang dạy môn này (khớp theo tên học phần, không phân biệt dấu cách / hoa thường)
  const hocPhan = layDb().prepare('SELECT hoc_phan FROM lop').all() as { hoc_phan: string }[];
  const dem = new Map<string, number>();
  for (const { hoc_phan } of hocPhan) {
    const k = khoaSoKhop(hoc_phan);
    dem.set(k, (dem.get(k) ?? 0) + 1);
  }
  return ds.map((m) => ({ ...m, so_lop: dem.get(khoaSoKhop(m.ten)) ?? 0 }));
}

export function layMon(id: number): Mon | undefined {
  return layDb().prepare('SELECT * FROM mon WHERE id = ?').get(id) as Mon | undefined;
}

export function timMonTheoTen(ten: string): Mon | undefined {
  const k = khoaSoKhop(ten);
  return (layDb().prepare('SELECT * FROM mon').all() as Mon[]).find((m) => khoaSoKhop(m.ten) === k);
}

function kiemTraTen(ten: string, boQuaId = 0) {
  const trung = timMonTheoTen(ten);
  if (trung && trung.id !== boQuaId) throw new LoiApp(409, `Đã có môn "${trung.ten}"`);
}

export function taoMon(d: DuLieuMon): Mon {
  kiemTraTen(d.ten);
  return layMon(chen('mon', d))!;
}

export function suaMon(id: number, d: Partial<DuLieuMon>): Mon {
  if (d.ten) kiemTraTen(d.ten, id);
  capNhat('mon', id, d);
  return layMon(id)!;
}

export function xoaMon(id: number) {
  xoa('mon', id);
}

// Các học phần đang dạy (từ bảng lớp) chưa có trong danh sách môn: gợi ý khi thêm môn
export function hocPhanChuaCoMon(): string[] {
  const daCo = new Set((layDb().prepare('SELECT ten FROM mon').all() as { ten: string }[]).map((m) => khoaSoKhop(m.ten)));
  const ds = layDb().prepare('SELECT DISTINCT hoc_phan FROM lop ORDER BY hoc_phan').all() as { hoc_phan: string }[];
  const kq = new Map<string, string>();
  for (const { hoc_phan } of ds) {
    const k = khoaSoKhop(hoc_phan);
    if (!daCo.has(k) && !kq.has(k)) kq.set(k, hoc_phan);
  }
  return [...kq.values()];
}
