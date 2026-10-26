import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DATA_DIR, DB_PATH, layDbMacDinh, moDb, type KhongGian } from '../db/connection.js';
import { LoiApp } from '../utils/loi.js';

// Tài khoản người dùng và phiên đăng nhập, lưu trong data/he-thong.db (tách khỏi dữ liệu giảng dạy).
// Người dùng đầu tiên (quản trị) giữ data/giangday.db hiện có; người sau có DB riêng ở data/nguoi-dung/<id>/.

export interface NguoiDung {
  id: number;
  ten_dang_nhap: string;
  ho_ten: string;
  email: string | null; // dùng để lấy lại mật khẩu, cũng đăng nhập được bằng email
  mat_khau: string; // không bao giờ trả ra API, xem congKhai()
  la_quan_tri: number;
  bi_khoa: number;
  thu_muc: string; // tương đối với DATA_DIR; '' = chính DATA_DIR
  tao_luc: string;
}

export type NguoiDungCongKhai = Omit<NguoiDung, 'thu_muc' | 'mat_khau'>;

const THOI_HAN_PHIEN_NGAY = 30;

function moDbHeThong(duongDan: string): Database.Database {
  if (duongDan !== ':memory:') fs.mkdirSync(path.dirname(duongDan), { recursive: true });
  const db = new Database(duongDan);
  if (duongDan !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS nguoi_dung (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ten_dang_nhap TEXT NOT NULL UNIQUE COLLATE NOCASE,
      ho_ten        TEXT NOT NULL,
      email         TEXT UNIQUE COLLATE NOCASE,
      mat_khau      TEXT NOT NULL,              -- scrypt$<muối hex>$<băm hex>
      la_quan_tri   INTEGER NOT NULL DEFAULT 0,
      bi_khoa       INTEGER NOT NULL DEFAULT 0,
      thu_muc       TEXT NOT NULL,
      tao_luc       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS phien (
      ma_bam        TEXT PRIMARY KEY,           -- sha256 của mã phiên trong cookie (không lưu mã gốc)
      nguoi_dung_id INTEGER NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
      het_han       TEXT NOT NULL,
      tao_luc       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  // DB tạo trước khi có cột email
  const cot = db.prepare('PRAGMA table_info(nguoi_dung)').all() as { name: string }[];
  if (!cot.some((c) => c.name === 'email')) {
    db.exec('ALTER TABLE nguoi_dung ADD COLUMN email TEXT COLLATE NOCASE');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_nguoi_dung_email ON nguoi_dung(email)');
  }
  return db;
}

let dbHeThong: Database.Database | null = null;
const khongGianDaMo = new Map<number, KhongGian>();

function heThong(): Database.Database {
  if (!dbHeThong) dbHeThong = moDbHeThong(path.join(DATA_DIR, 'he-thong.db'));
  return dbHeThong;
}

// Dùng trong test
export function datDbHeThong(db: Database.Database | ':memory:') {
  dbHeThong?.close();
  dbHeThong = db === ':memory:' ? moDbHeThong(':memory:') : db;
  for (const kg of khongGianDaMo.values()) if (kg.db !== layDbMacDinh()) kg.db.close();
  khongGianDaMo.clear();
  lanSai.clear();
}

// ---------------------------------------------------------------------------
// Mật khẩu: scrypt + muối ngẫu nhiên, so sánh thời gian hằng số

export function bamMatKhau(matKhau: string): string {
  const muoi = crypto.randomBytes(16);
  const bam = crypto.scryptSync(matKhau, muoi, 64);
  return `scrypt$${muoi.toString('hex')}$${bam.toString('hex')}`;
}

export function dungMatKhau(matKhau: string, daLuu: string): boolean {
  const [loai, muoiHex, bamHex] = daLuu.split('$');
  if (loai !== 'scrypt' || !muoiHex || !bamHex) return false;
  const bam = crypto.scryptSync(matKhau, Buffer.from(muoiHex, 'hex'), 64);
  const goc = Buffer.from(bamHex, 'hex');
  return goc.length === bam.length && crypto.timingSafeEqual(goc, bam);
}

// ---------------------------------------------------------------------------
// Người dùng

const COT_CONG_KHAI = 'id, ten_dang_nhap, ho_ten, email, la_quan_tri, bi_khoa, tao_luc';

export function coNguoiDung(): boolean {
  return !!heThong().prepare('SELECT 1 FROM nguoi_dung LIMIT 1').get();
}

export function dsNguoiDung(): NguoiDungCongKhai[] {
  return heThong().prepare(`SELECT ${COT_CONG_KHAI} FROM nguoi_dung ORDER BY id`).all() as NguoiDungCongKhai[];
}

export function layNguoiDung(id: number): NguoiDung | undefined {
  return heThong().prepare('SELECT * FROM nguoi_dung WHERE id = ?').get(id) as NguoiDung | undefined;
}

export function congKhai(n: NguoiDung): NguoiDungCongKhai {
  const { thu_muc: _thuMuc, mat_khau: _matKhau, ...kq } = n;
  return kq;
}

function kiemTraEmail(email: string | null | undefined, boQuaId = 0) {
  if (email && heThong().prepare('SELECT 1 FROM nguoi_dung WHERE email = ? AND id <> ?').get(email, boQuaId))
    throw new LoiApp(409, `Email "${email}" đã có tài khoản khác dùng`);
}

export function taoNguoiDung(d: {
  ten_dang_nhap: string;
  ho_ten: string;
  mat_khau: string;
  email?: string | null;
  la_quan_tri?: boolean;
}): NguoiDung {
  const db = heThong();
  if (db.prepare('SELECT 1 FROM nguoi_dung WHERE ten_dang_nhap = ?').get(d.ten_dang_nhap))
    throw new LoiApp(409, `Tên đăng nhập "${d.ten_dang_nhap}" đã có người dùng`);
  kiemTraEmail(d.email);
  const dauTien = !coNguoiDung();
  const id = Number(
    db
      .prepare('INSERT INTO nguoi_dung (ten_dang_nhap, ho_ten, email, mat_khau, la_quan_tri, thu_muc) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d.ten_dang_nhap, d.ho_ten, d.email || null, bamMatKhau(d.mat_khau), dauTien || d.la_quan_tri ? 1 : 0, '__tam__')
      .lastInsertRowid,
  );
  // Người đầu tiên nhận dữ liệu đang có (data/giangday.db); người sau có thư mục riêng
  const thuMuc = dauTien ? '' : path.join('nguoi-dung', String(id));
  db.prepare('UPDATE nguoi_dung SET thu_muc = ? WHERE id = ?').run(thuMuc, id);
  const nd = layNguoiDung(id)!;
  if (!dauTien) khoiTaoDuLieuMoi(nd);
  return nd;
}

// DB mới: tạo bảng + dữ liệu mẫu (trường, địa điểm, mẫu đề), xóa thông tin giáo viên của người khác
function khoiTaoDuLieuMoi(nd: NguoiDung) {
  const { db } = khongGianCua(nd);
  const ghi = db.prepare('INSERT INTO cai_dat (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri');
  db.transaction(() => {
    ghi.run('ten_gv', nd.ho_ten);
    ghi.run('ma_gv', '');
    ghi.run('sdt', '');
  })();
}

export function timNguoiDung(tenHoacEmail: string): NguoiDung | undefined {
  return heThong()
    .prepare('SELECT * FROM nguoi_dung WHERE ten_dang_nhap = @t OR email = @t')
    .get({ t: tenHoacEmail.trim() }) as NguoiDung | undefined;
}

export function suaNguoiDung(
  id: number,
  d: { ho_ten?: string; email?: string | null; mat_khau?: string; bi_khoa?: boolean; la_quan_tri?: boolean },
) {
  const db = heThong();
  const nd = layNguoiDung(id);
  if (!nd) throw new LoiApp(404, 'Không tìm thấy người dùng');
  if ((d.bi_khoa === true || d.la_quan_tri === false) && nd.la_quan_tri) {
    const soQuanTri = (db.prepare('SELECT count(*) AS n FROM nguoi_dung WHERE la_quan_tri = 1 AND bi_khoa = 0').get() as { n: number }).n;
    if (soQuanTri <= 1) throw new LoiApp(400, 'Phải còn ít nhất một quản trị đang hoạt động');
  }
  if (d.email !== undefined) kiemTraEmail(d.email, id);
  db.transaction(() => {
    if (d.ho_ten !== undefined) db.prepare('UPDATE nguoi_dung SET ho_ten = ? WHERE id = ?').run(d.ho_ten, id);
    if (d.email !== undefined) db.prepare('UPDATE nguoi_dung SET email = ? WHERE id = ?').run(d.email || null, id);
    if (d.mat_khau !== undefined) db.prepare('UPDATE nguoi_dung SET mat_khau = ? WHERE id = ?').run(bamMatKhau(d.mat_khau), id);
    if (d.bi_khoa !== undefined) db.prepare('UPDATE nguoi_dung SET bi_khoa = ? WHERE id = ?').run(d.bi_khoa ? 1 : 0, id);
    if (d.la_quan_tri !== undefined) db.prepare('UPDATE nguoi_dung SET la_quan_tri = ? WHERE id = ?').run(d.la_quan_tri ? 1 : 0, id);
    // Đặt lại mật khẩu hoặc khóa tài khoản: đăng xuất mọi nơi
    if (d.mat_khau !== undefined || d.bi_khoa) db.prepare('DELETE FROM phien WHERE nguoi_dung_id = ?').run(id);
  })();
  const sau = layNguoiDung(id)!;
  if (khongGianDaMo.has(id)) khongGianDaMo.get(id)!.laQuanTri = !!sau.la_quan_tri;
  return congKhai(sau);
}

// Người dùng tự đổi mật khẩu: cần mật khẩu cũ; giữ phiên hiện tại, đăng xuất các nơi khác
export function doiMatKhau(id: number, cu: string, moi: string, maPhienGiuLai: string) {
  const nd = layNguoiDung(id);
  if (!nd || !dungMatKhau(cu, nd.mat_khau)) throw new LoiApp(400, 'Mật khẩu hiện tại không đúng');
  const db = heThong();
  db.transaction(() => {
    db.prepare('UPDATE nguoi_dung SET mat_khau = ? WHERE id = ?').run(bamMatKhau(moi), id);
    db.prepare('DELETE FROM phien WHERE nguoi_dung_id = ? AND ma_bam <> ?').run(id, bamPhien(maPhienGiuLai));
  })();
}

// ---------------------------------------------------------------------------
// Đăng nhập: chặn tạm sau nhiều lần sai (theo tên đăng nhập + IP)

const SO_LAN_SAI_TOI_DA = 5;
const KHOA_PHUT = 5;
const lanSai = new Map<string, { lan: number; mo: number }>();

export function dangNhap(tenDangNhap: string, matKhau: string, ip: string): NguoiDung {
  const khoa = `${tenDangNhap.toLowerCase()}|${ip}`;
  const ghi = lanSai.get(khoa);
  if (ghi && ghi.lan >= SO_LAN_SAI_TOI_DA && ghi.mo > Date.now()) {
    const phut = Math.ceil((ghi.mo - Date.now()) / 60000);
    throw new LoiApp(429, `Sai quá nhiều lần. Thử lại sau ${phut} phút`);
  }
  const nd = timNguoiDung(tenDangNhap); // tên đăng nhập hoặc email
  // Luôn băm để thời gian trả lời như nhau dù tên đăng nhập có tồn tại hay không
  const dung = dungMatKhau(matKhau, nd?.mat_khau ?? 'scrypt$00$00');
  if (!nd || !dung) {
    const lan = (ghi && ghi.mo > Date.now() ? ghi.lan : 0) + 1;
    lanSai.set(khoa, { lan, mo: Date.now() + KHOA_PHUT * 60000 });
    throw new LoiApp(401, 'Sai tên đăng nhập / email hoặc mật khẩu');
  }
  if (nd.bi_khoa) throw new LoiApp(403, 'Tài khoản đã bị khóa. Hãy liên hệ quản trị');
  lanSai.delete(khoa);
  return nd;
}

// ---------------------------------------------------------------------------
// Phiên đăng nhập: mã ngẫu nhiên trong cookie, DB chỉ lưu mã băm

const bamPhien = (ma: string) => crypto.createHash('sha256').update(ma).digest('hex');

export function taoPhien(nguoiDungId: number): { ma: string; soGiay: number } {
  const ma = crypto.randomBytes(32).toString('base64url');
  const db = heThong();
  db.prepare("DELETE FROM phien WHERE het_han < datetime('now','localtime')").run();
  db.prepare(`INSERT INTO phien (ma_bam, nguoi_dung_id, het_han) VALUES (?, ?, datetime('now','localtime','+${THOI_HAN_PHIEN_NGAY} days'))`).run(
    bamPhien(ma),
    nguoiDungId,
  );
  return { ma, soGiay: THOI_HAN_PHIEN_NGAY * 86400 };
}

export function layNguoiDungTheoPhien(ma: string | undefined): NguoiDung | undefined {
  if (!ma) return undefined;
  const nd = heThong()
    .prepare(
      `SELECT n.* FROM phien p JOIN nguoi_dung n ON n.id = p.nguoi_dung_id
       WHERE p.ma_bam = ? AND p.het_han > datetime('now','localtime')`,
    )
    .get(bamPhien(ma)) as NguoiDung | undefined;
  return nd && !nd.bi_khoa ? nd : undefined;
}

export function xoaPhien(ma: string | undefined) {
  if (ma) heThong().prepare('DELETE FROM phien WHERE ma_bam = ?').run(bamPhien(ma));
}

// ---------------------------------------------------------------------------
// Không gian dữ liệu của người dùng (mở DB một lần rồi giữ lại)

export function khongGianCua(nd: NguoiDung): KhongGian {
  let kg = khongGianDaMo.get(nd.id);
  if (!kg) {
    const thuMuc = path.resolve(DATA_DIR, nd.thu_muc);
    const duongDan = path.join(thuMuc, 'giangday.db');
    // Người dùng đầu tiên dùng chung kết nối mặc định (data/giangday.db) để không mở hai lần
    const db = duongDan === path.resolve(DB_PATH) ? layDbMacDinh() : moDb(duongDan);
    kg = { nguoiDungId: nd.id, laQuanTri: !!nd.la_quan_tri, db, thuMuc };
    khongGianDaMo.set(nd.id, kg);
  }
  return kg;
}

export function dsKhongGian(): KhongGian[] {
  return (heThong().prepare('SELECT * FROM nguoi_dung WHERE bi_khoa = 0').all() as NguoiDung[]).map(khongGianCua);
}
