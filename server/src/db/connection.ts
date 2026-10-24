import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { chayMigration } from './migrate.js';

// Thư mục data/ ở gốc dự án (có thể đổi bằng biến môi trường DATA_DIR)
export const DATA_DIR =
  process.env.DATA_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');
export const DB_PATH = path.join(DATA_DIR, 'giangday.db');

export function moDb(duongDan: string = DB_PATH): Database.Database {
  if (duongDan !== ':memory:') fs.mkdirSync(path.dirname(duongDan), { recursive: true });
  const db = new Database(duongDan);
  if (duongDan !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  chayMigration(db);
  return db;
}

let dbHienTai: Database.Database | null = null;

export function layDb(): Database.Database {
  if (!dbHienTai) dbHienTai = moDb();
  return dbHienTai;
}

// Dùng trong test: thay DB bằng bản trong bộ nhớ
export function datDb(db: Database.Database) {
  dbHienTai = db;
}
