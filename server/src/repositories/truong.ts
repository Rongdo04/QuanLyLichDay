import { layDb } from '../db/connection.js';
import { LoiApp } from '../utils/loi.js';
import { capNhat, chen, xoa } from './chung.js';

export interface Truong {
  id: number;
  ma: string;
  ten: string;
  ghi_chu: string | null;
  da_an: number;
}

export function dsTruong(): (Truong & { so_lop: number })[] {
  return layDb()
    .prepare(
      `SELECT t.*, (SELECT count(*) FROM lop l WHERE l.truong_id = t.id) AS so_lop
       FROM truong t ORDER BY t.da_an, t.id`,
    )
    .all() as (Truong & { so_lop: number })[];
}

export function layTruong(id: number): Truong | undefined {
  return layDb().prepare('SELECT * FROM truong WHERE id = ?').get(id) as Truong | undefined;
}

function kiemTraMa(ma: string, boQuaId?: number) {
  const trung = layDb().prepare('SELECT id FROM truong WHERE ma = ? AND id <> ?').get(ma, boQuaId ?? 0);
  if (trung) throw new LoiApp(409, `Mã trường "${ma}" đã tồn tại`);
}

export function taoTruong(duLieu: Omit<Truong, 'id'>): Truong {
  kiemTraMa(duLieu.ma);
  return layTruong(chen('truong', duLieu))!;
}

export function suaTruong(id: number, duLieu: Partial<Omit<Truong, 'id'>>): Truong {
  if (duLieu.ma) kiemTraMa(duLieu.ma, id);
  capNhat('truong', id, duLieu);
  return layTruong(id)!;
}

export function xoaTruong(id: number) {
  const { n } = layDb().prepare('SELECT count(*) AS n FROM lop WHERE truong_id = ?').get(id) as { n: number };
  if (n > 0) throw new LoiApp(409, `Trường còn ${n} lớp nên không thể xóa. Hãy ẩn trường thay vì xóa.`);
  xoa('truong', id);
}
