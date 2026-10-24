import { layDb } from '../db/connection.js';
import { capNhat, chen, xoa } from './chung.js';

export type MucDo = 'de' | 'tb' | 'kho';

export interface CauHoi {
  id: number;
  mon_id: number;
  chu_de: string | null;
  muc_do: MucDo;
  diem: number | null;
  noi_dung: string;
  dap_an: string;
  nguon: 'tay' | 'ai';
  so_lan_dung: number;
  lan_dung_cuoi: string | null;
  tao_luc: string;
}

export type DuLieuCauHoi = Pick<CauHoi, 'chu_de' | 'muc_do' | 'diem' | 'noi_dung' | 'dap_an'> & {
  nguon?: CauHoi['nguon'];
};

export function dsCauHoi(monId: number): CauHoi[] {
  return layDb().prepare('SELECT * FROM cau_hoi WHERE mon_id = ? ORDER BY chu_de, id').all(monId) as CauHoi[];
}

export function layCauHoi(id: number): CauHoi | undefined {
  return layDb().prepare('SELECT * FROM cau_hoi WHERE id = ?').get(id) as CauHoi | undefined;
}

export function layNhieuCauHoi(ids: number[]): Map<number, CauHoi> {
  if (ids.length === 0) return new Map();
  const ds = layDb()
    .prepare(`SELECT * FROM cau_hoi WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as CauHoi[];
  return new Map(ds.map((c) => [c.id, c]));
}

export function taoNhieuCauHoi(monId: number, ds: DuLieuCauHoi[]): number[] {
  const db = layDb();
  const ids: number[] = [];
  db.transaction(() => {
    for (const c of ds) ids.push(chen('cau_hoi', { nguon: 'tay', ...c, mon_id: monId }));
  })();
  return ids;
}

export function suaCauHoi(id: number, d: Partial<DuLieuCauHoi>): CauHoi {
  capNhat('cau_hoi', id, d);
  return layCauHoi(id)!;
}

export function xoaCauHoi(id: number) {
  xoa('cau_hoi', id);
}

// Ghi nhận các câu đã được dùng trong một lần sinh đề
export function ghiNhanDaDung(ids: number[]) {
  const stmt = layDb().prepare(
    "UPDATE cau_hoi SET so_lan_dung = so_lan_dung + 1, lan_dung_cuoi = datetime('now','localtime') WHERE id = ?",
  );
  for (const id of new Set(ids)) stmt.run(id);
}
