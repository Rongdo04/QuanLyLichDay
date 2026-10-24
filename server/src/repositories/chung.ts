import { layDb } from '../db/connection.js';

// Các hàm SQL dùng chung. Tên cột chỉ lấy từ dữ liệu đã qua zod nên an toàn để ghép chuỗi.

export function chen(bang: string, duLieu: Record<string, unknown>): number {
  const cot = Object.keys(duLieu);
  const sql = `INSERT INTO ${bang} (${cot.join(', ')}) VALUES (${cot.map((c) => '@' + c).join(', ')})`;
  return Number(layDb().prepare(sql).run(duLieu).lastInsertRowid);
}

export function capNhat(bang: string, id: number, duLieu: Record<string, unknown>): void {
  const cot = Object.keys(duLieu).filter((c) => duLieu[c] !== undefined);
  if (cot.length === 0) return;
  const sql = `UPDATE ${bang} SET ${cot.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @__id`;
  const thamSo: Record<string, unknown> = { __id: id };
  for (const c of cot) thamSo[c] = duLieu[c];
  layDb().prepare(sql).run(thamSo);
}

export function xoa(bang: string, id: number): boolean {
  return layDb().prepare(`DELETE FROM ${bang} WHERE id = ?`).run(id).changes > 0;
}
