import { layDb } from '../db/connection.js';
import { LoiApp } from '../utils/loi.js';
import { capNhat, chen, xoa } from './chung.js';

export interface DiaDiem {
  id: number;
  ten_ngan: string;
  ten_day_du: string | null;
  tien_dc: number;
}

export function dsDiaDiem(): (DiaDiem & { so_lop: number })[] {
  return layDb()
    .prepare(
      `SELECT d.*, (SELECT count(*) FROM lop l WHERE l.dia_diem_id = d.id) AS so_lop
       FROM dia_diem d ORDER BY d.id`,
    )
    .all() as (DiaDiem & { so_lop: number })[];
}

export function layDiaDiem(id: number): DiaDiem | undefined {
  return layDb().prepare('SELECT * FROM dia_diem WHERE id = ?').get(id) as DiaDiem | undefined;
}

export function timDiaDiemTheoTen(tenNgan: string): DiaDiem | undefined {
  return layDb()
    .prepare('SELECT * FROM dia_diem WHERE lower(trim(ten_ngan)) = lower(trim(?))')
    .get(tenNgan) as DiaDiem | undefined;
}

function kiemTraTen(ten: string, boQuaId?: number) {
  const trung = layDb().prepare('SELECT id FROM dia_diem WHERE ten_ngan = ? AND id <> ?').get(ten, boQuaId ?? 0);
  if (trung) throw new LoiApp(409, `Địa điểm "${ten}" đã tồn tại`);
}

export function taoDiaDiem(duLieu: Omit<DiaDiem, 'id'>): DiaDiem {
  kiemTraTen(duLieu.ten_ngan);
  return layDiaDiem(chen('dia_diem', duLieu))!;
}

export function suaDiaDiem(id: number, duLieu: Partial<Omit<DiaDiem, 'id'>>): DiaDiem {
  if (duLieu.ten_ngan) kiemTraTen(duLieu.ten_ngan, id);
  capNhat('dia_diem', id, duLieu);
  return layDiaDiem(id)!;
}

export function xoaDiaDiem(id: number) {
  const { n } = layDb().prepare('SELECT count(*) AS n FROM lop WHERE dia_diem_id = ?').get(id) as { n: number };
  if (n > 0) throw new LoiApp(409, `Địa điểm đang được ${n} lớp sử dụng nên không thể xóa`);
  xoa('dia_diem', id);
}
