import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layDb, thuMucDuLieu } from '../db/connection.js';
import { LoiApp } from '../utils/loi.js';
import { capNhat, chen } from './chung.js';

export interface MauDe {
  id: number;
  ten: string;
  truong_id: number | null;
  tep: string;
  co_san: number;
  cau_truc: string; // JSON mảng điểm
  thoi_gian: number;
  tao_luc: string;
}

export interface MauDeDayDu extends Omit<MauDe, 'cau_truc'> {
  cau_truc: number[];
  truong_ma: string | null;
  truong_ten: string | null;
}

// Mẫu có sẵn nằm trong server/mau-de; mẫu tải lên nằm trong data/mau-de (đi cùng dữ liệu khi chép máy)
export const THU_MUC_MAU_SAN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mau-de');
export const thuMucMauTaiLen = () => path.join(thuMucDuLieu(), 'mau-de');

function docCauTruc(s: string): number[] {
  try {
    const a = JSON.parse(s);
    if (Array.isArray(a) && a.every((x) => typeof x === 'number')) return a;
  } catch {
    /* dữ liệu hỏng: dùng mặc định */
  }
  return [3, 3, 4];
}

const SQL = `SELECT m.*, t.ma AS truong_ma, t.ten AS truong_ten FROM mau_de m LEFT JOIN truong t ON t.id = m.truong_id`;
const chuyen = (m: MauDe & { truong_ma: string | null; truong_ten: string | null }): MauDeDayDu => ({
  ...m,
  cau_truc: docCauTruc(m.cau_truc),
});

export function dsMauDe(): MauDeDayDu[] {
  return (layDb().prepare(`${SQL} ORDER BY m.truong_id IS NULL, t.ma, m.id`).all() as Parameters<typeof chuyen>[0][]).map(chuyen);
}

export function layMauDe(id: number): MauDeDayDu | undefined {
  const m = layDb().prepare(`${SQL} WHERE m.id = ?`).get(id) as Parameters<typeof chuyen>[0] | undefined;
  return m && chuyen(m);
}

// Mẫu dùng cho một trường: mẫu riêng mới nhất của trường, không có thì mẫu chung
export function mauChoTruong(truongId: number | null): MauDeDayDu | undefined {
  const ds = dsMauDe();
  return (
    (truongId ? ds.filter((m) => m.truong_id === truongId).sort((a, b) => b.id - a.id)[0] : undefined) ??
    ds.find((m) => m.truong_id === null && m.co_san) ??
    ds.find((m) => m.truong_id === null)
  );
}

export function duongDanTep(m: Pick<MauDe, 'tep'>): string {
  const [loai, ten] = [m.tep.slice(0, 4), m.tep.slice(4)];
  if (path.basename(ten) !== ten) throw new LoiApp(500, 'Tên file mẫu không hợp lệ');
  return path.join(loai === 'san:' ? THU_MUC_MAU_SAN : thuMucMauTaiLen(), ten);
}

export function docTepMau(m: Pick<MauDe, 'tep' | 'ten'>): Buffer {
  const p = duongDanTep(m);
  if (!fs.existsSync(p)) throw new LoiApp(404, `Không tìm thấy file của mẫu "${m.ten}". Hãy tải mẫu lên lại.`);
  return fs.readFileSync(p);
}

export interface DuLieuMauDe {
  ten: string;
  truong_id: number | null;
  cau_truc: number[];
  thoi_gian: number;
}

export function taoMauDe(d: DuLieuMauDe, noiDung: Buffer): MauDeDayDu {
  fs.mkdirSync(thuMucMauTaiLen(), { recursive: true });
  const tenTep = `mau_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.docx`;
  fs.writeFileSync(path.join(thuMucMauTaiLen(), tenTep), noiDung);
  const id = chen('mau_de', { ...d, cau_truc: JSON.stringify(d.cau_truc), tep: `tai:${tenTep}`, co_san: 0 });
  return layMauDe(id)!;
}

export function suaMauDe(id: number, d: Partial<DuLieuMauDe>): MauDeDayDu {
  capNhat('mau_de', id, { ...d, cau_truc: d.cau_truc ? JSON.stringify(d.cau_truc) : undefined });
  return layMauDe(id)!;
}

// Thay file Word của mẫu tải lên (giữ nguyên cấu hình)
export function thayTepMau(id: number, noiDung: Buffer) {
  const m = layMauDe(id)!;
  if (m.co_san) throw new LoiApp(400, 'Không thay được file của mẫu có sẵn. Hãy tải lên thành mẫu mới.');
  fs.writeFileSync(duongDanTep(m), noiDung);
}

export function xoaMauDe(id: number) {
  const m = layMauDe(id)!;
  if (m.co_san) throw new LoiApp(400, 'Không xóa được mẫu có sẵn của phần mềm');
  layDb().prepare('DELETE FROM mau_de WHERE id = ?').run(id);
  try {
    fs.unlinkSync(duongDanTep(m));
  } catch {
    /* file đã mất: bỏ qua */
  }
}
