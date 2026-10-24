import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

const thuMucMigration = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// Chạy lần lượt các file .sql chưa áp dụng, mỗi file trong một transaction
export function chayMigration(db: Database.Database): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    ten TEXT PRIMARY KEY,
    chay_luc TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  const daChay = new Set(
    (db.prepare('SELECT ten FROM _migrations').all() as { ten: string }[]).map((r) => r.ten),
  );
  const cacFile = fs
    .readdirSync(thuMucMigration)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const moi: string[] = [];
  for (const ten of cacFile) {
    if (daChay.has(ten)) continue;
    const sql = fs.readFileSync(path.join(thuMucMigration, ten), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (ten) VALUES (?)').run(ten);
    })();
    moi.push(ten);
  }
  return moi;
}
