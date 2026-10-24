import { describe, expect, it } from 'vitest';
import { moDb } from '../src/db/connection.js';
import { chayMigration } from '../src/db/migrate.js';

describe('db', () => {
  it('migration tạo bảng và seed dữ liệu', () => {
    const db = moDb(':memory:');
    const gv = db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa='ma_gv'").get() as { gia_tri: string };
    expect(gv.gia_tri).toBe('G366');
    const dd = db.prepare('SELECT ten_ngan, tien_dc FROM dia_diem ORDER BY id').all();
    expect(dd).toEqual([
      { ten_ngan: 'Thạch Thất', tien_dc: 66 },
      { ten_ngan: 'Chương Mỹ', tien_dc: 75 },
      { ten_ngan: 'Xuân Mai', tien_dc: 0 },
    ]);
    expect((db.prepare('SELECT count(*) n FROM truong').get() as { n: number }).n).toBe(4);
    const cot = (db.prepare('PRAGMA table_info(buoi)').all() as { name: string }[]).map((c) => c.name);
    expect(cot).toContain('du_kien');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('chạy migration lần hai không làm gì', () => {
    const db = moDb(':memory:');
    expect(chayMigration(db)).toEqual([]);
  });
});
