import { layDb } from '../db/connection.js';
import { LoiApp } from '../utils/loi.js';
import type { DuKien } from '../services/sinhLich.js';
import { capNhat, chen, xoa } from './chung.js';

export interface Buoi {
  id: number;
  lop_id: number;
  ngay: string;
  sang: number;
  chieu: number;
  co_tien_dc: number;
  ghi_chu: string | null;
  du_kien: DuKien | null;
}

// Buổi kèm thông tin lớp/trường để hiển thị và tính tiền
export interface BuoiDayDu extends Buoi {
  ten_sheet: string;
  hoc_phan: string;
  don_gia: number;
  truong_id: number;
  truong_ma: string;
  dia_diem_ten: string | null;
  tien_dc_dia_diem: number | null;
}

export interface LocBuoi {
  tu?: string;
  den?: string;
  truongId?: number;
  lopId?: number;
}

export function dsBuoi(loc: LocBuoi = {}): BuoiDayDu[] {
  const dk: string[] = [];
  const ts: Record<string, unknown> = {};
  if (loc.tu) (dk.push('b.ngay >= @tu'), (ts.tu = loc.tu));
  if (loc.den) (dk.push('b.ngay <= @den'), (ts.den = loc.den));
  if (loc.truongId) (dk.push('l.truong_id = @truongId'), (ts.truongId = loc.truongId));
  if (loc.lopId) (dk.push('b.lop_id = @lopId'), (ts.lopId = loc.lopId));
  return layDb()
    .prepare(
      `SELECT b.*, l.ten_sheet, l.hoc_phan, l.don_gia, l.truong_id, t.ma AS truong_ma,
              d.ten_ngan AS dia_diem_ten, d.tien_dc AS tien_dc_dia_diem
       FROM buoi b
       JOIN lop l ON l.id = b.lop_id
       JOIN truong t ON t.id = l.truong_id
       LEFT JOIN dia_diem d ON d.id = l.dia_diem_id
       ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
       ORDER BY b.ngay, t.id, l.thu_tu, l.id`,
    )
    .all(ts) as BuoiDayDu[];
}

export function buoiCuaLop(lopId: number): Buoi[] {
  return layDb().prepare('SELECT * FROM buoi WHERE lop_id = ? ORDER BY ngay').all(lopId) as Buoi[];
}

export function layBuoi(id: number): Buoi | undefined {
  return layDb().prepare('SELECT * FROM buoi WHERE id = ?').get(id) as Buoi | undefined;
}

function dinhDangNgay(ngay: string) {
  const [y, m, d] = ngay.split('-');
  return `${d}/${m}/${y}`;
}

export function taoBuoi(duLieu: Omit<Buoi, 'id'>): Buoi {
  const trung = layDb().prepare('SELECT id FROM buoi WHERE lop_id = ? AND ngay = ?').get(duLieu.lop_id, duLieu.ngay);
  if (trung) throw new LoiApp(409, `Lớp đã có ngày ${dinhDangNgay(duLieu.ngay)}`);
  return layBuoi(chen('buoi', duLieu))!;
}

export function suaBuoi(id: number, duLieu: Partial<Omit<Buoi, 'id' | 'lop_id'>>): Buoi {
  if (duLieu.ngay) {
    const cu = layBuoi(id)!;
    const trung = layDb()
      .prepare('SELECT id FROM buoi WHERE lop_id = ? AND ngay = ? AND id <> ?')
      .get(cu.lop_id, duLieu.ngay, id);
    if (trung) throw new LoiApp(409, `Lớp đã có ngày ${dinhDangNgay(duLieu.ngay)}`);
  }
  capNhat('buoi', id, duLieu);
  return layBuoi(id)!;
}

export function xoaBuoi(id: number) {
  xoa('buoi', id);
}

export function xoaBuoiCuaLop(lopId: number) {
  layDb().prepare('DELETE FROM buoi WHERE lop_id = ?').run(lopId);
}

// Chèn các ngày đọc từ file Excel cũ (đã có sáng/chiều/ghi chú)
export function chenBuoiNhap(
  lopId: number,
  ds: { ngay: string; sang: number; chieu: number; ghi_chu: string | null }[],
) {
  const stmt = layDb().prepare(
    'INSERT INTO buoi (lop_id, ngay, sang, chieu, ghi_chu) VALUES (?, ?, ?, ?, ?)',
  );
  for (const b of ds) stmt.run(lopId, b.ngay, b.sang, b.chieu, b.ghi_chu);
}

// Tạo nhiều ngày một lúc, bỏ qua ngày đã có. Trả về số ngày tạo mới.
export function taoNhieuBuoi(lopId: number, ds: { ngay: string; du_kien?: DuKien | null }[]): number {
  const db = layDb();
  const stmt = db.prepare('INSERT OR IGNORE INTO buoi (lop_id, ngay, du_kien) VALUES (?, ?, ?)');
  let soMoi = 0;
  db.transaction(() => {
    for (const d of ds) soMoi += stmt.run(lopId, d.ngay, d.du_kien ?? null).changes;
  })();
  return soMoi;
}
