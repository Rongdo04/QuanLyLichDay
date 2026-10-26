import { AsyncLocalStorage } from 'node:async_hooks';
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

// Không gian dữ liệu của một người dùng: DB riêng + thư mục riêng (mẫu đề tải lên, sao lưu).
// Mỗi request đã đăng nhập chạy trong không gian của người đó (AsyncLocalStorage),
// nên layDb() / thuMucDuLieu() tự trả đúng dữ liệu của người đang dùng.
export interface KhongGian {
  nguoiDungId: number;
  laQuanTri: boolean;
  db: Database.Database;
  thuMuc: string;
}

const khongGianHienTai = new AsyncLocalStorage<KhongGian>();

export function chayTrongKhongGian<T>(kg: KhongGian, fn: () => T): T {
  return khongGianHienTai.run(kg, fn);
}

export function layKhongGian(): KhongGian | undefined {
  return khongGianHienTai.getStore();
}

let dbHienTai: Database.Database | null = null;
let batBuoc = false;

// Bật khi server chạy thật (nhiều người dùng): truy cập dữ liệu mà không xác định được người dùng
// thì báo lỗi, không bao giờ âm thầm dùng DB mặc định (của quản trị)
export function batBuocKhongGian() {
  batBuoc = true;
}

// Ngoài request (khởi động, test): DB mặc định data/giangday.db
export function layDb(): Database.Database {
  const kg = khongGianHienTai.getStore();
  if (kg) return kg.db;
  if (batBuoc) throw new Error('Không xác định được người dùng của yêu cầu này');
  return layDbMacDinh();
}

export function layDbMacDinh(): Database.Database {
  if (!dbHienTai) dbHienTai = moDb();
  return dbHienTai;
}

export function thuMucDuLieu(): string {
  const kg = khongGianHienTai.getStore();
  if (kg) return kg.thuMuc;
  if (batBuoc) throw new Error('Không xác định được người dùng của yêu cầu này');
  return DATA_DIR;
}

// Dùng trong test: thay DB bằng bản trong bộ nhớ
export function datDb(db: Database.Database) {
  dbHienTai = db;
}
