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
    -- Phiên của siêu quản trị (không có dòng trong nguoi_dung). dau_van đổi khi sửa .env → phiên cũ hết hiệu lực
    CREATE TABLE IF NOT EXISTS phien_sieu (
      ma_bam        TEXT PRIMARY KEY,
      dau_van       TEXT NOT NULL,
      het_han       TEXT NOT NULL
    );
    -- Đếm đăng nhập sai phía server: xóa cookie / đổi trình duyệt / khởi động lại server đều không xóa được
    CREATE TABLE IF NOT EXISTS dang_nhap_sai (
      khoa          TEXT PRIMARY KEY,           -- 'tk-ip:<tên>|<ip>', 'ip:<ip>', 'tk:<tên>'
      lan           INTEGER NOT NULL,
      cuoi          INTEGER NOT NULL            -- thời điểm sai gần nhất (ms)
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
}

// ---------------------------------------------------------------------------
// Siêu quản trị: không nằm trong DB, khai báo trong file .env (không ghi vào code vì repo công khai)
//   SIEU_QUAN_TRI_TEN=admin
//   SIEU_QUAN_TRI_MAT_KHAU=<mật khẩu ≥ 10 ký tự, hoặc chuỗi scrypt$... tạo bằng "npm run tai-khoan -w server -- bam">
// Có dữ liệu riêng ở data/sieu-quan-tri/ (không đụng dữ liệu của ai), luôn là quản trị, không bị khóa từ trong app.

const ID_SIEU = 0;
const THU_MUC_SIEU = 'sieu-quan-tri';
export const DO_DAI_MAT_KHAU_SIEU = 10;

function cauHinhSieu(): { ten: string; matKhau: string } | undefined {
  const ten = process.env.SIEU_QUAN_TRI_TEN?.trim().toLowerCase();
  const matKhau = process.env.SIEU_QUAN_TRI_MAT_KHAU ?? '';
  if (!ten || !matKhau) return undefined;
  if (!matKhau.startsWith('scrypt$') && matKhau.length < DO_DAI_MAT_KHAU_SIEU) return undefined; // quá ngắn: tắt
  return { ten, matKhau };
}

// Lý do không bật được (để báo khi khởi động), undefined = bình thường
export function loiCauHinhSieu(): string | undefined {
  const ten = process.env.SIEU_QUAN_TRI_TEN?.trim();
  const matKhau = process.env.SIEU_QUAN_TRI_MAT_KHAU ?? '';
  if (!ten && !matKhau) return undefined;
  if (!ten || !matKhau) return 'cần đủ cả SIEU_QUAN_TRI_TEN và SIEU_QUAN_TRI_MAT_KHAU';
  if (!cauHinhSieu()) return `mật khẩu cần ít nhất ${DO_DAI_MAT_KHAU_SIEU} ký tự`;
  return undefined;
}

export function sieuQuanTri(): NguoiDung | undefined {
  const ch = cauHinhSieu();
  if (!ch) return undefined;
  return {
    id: ID_SIEU,
    ten_dang_nhap: ch.ten,
    ho_ten: 'Siêu quản trị',
    email: null,
    mat_khau: '',
    la_quan_tri: 1,
    bi_khoa: 0,
    thu_muc: THU_MUC_SIEU,
    tao_luc: '',
  };
}

export const laSieuQuanTri = (id: number) => id === ID_SIEU;

function dungMatKhauSieu(matKhau: string, daLuu: string): boolean {
  if (daLuu.startsWith('scrypt$')) return dungMatKhau(matKhau, daLuu);
  const a = crypto.createHash('sha256').update(matKhau).digest();
  const b = crypto.createHash('sha256').update(daLuu).digest();
  return crypto.timingSafeEqual(a, b);
}

const dauVanSieu = () => {
  const ch = cauHinhSieu();
  return ch ? crypto.createHash('sha256').update(`${ch.ten}\0${ch.matKhau}`).digest('hex') : '';
};

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

// du_lieu_goc = 1: tài khoản giữ data/giangday.db (không xóa được, xem xoaNguoiDung)
export function dsNguoiDung(): (NguoiDungCongKhai & { du_lieu_goc: number })[] {
  return heThong()
    .prepare(`SELECT ${COT_CONG_KHAI}, (thu_muc = '') AS du_lieu_goc FROM nguoi_dung ORDER BY id`)
    .all() as (NguoiDungCongKhai & { du_lieu_goc: number })[];
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
  if (
    db.prepare('SELECT 1 FROM nguoi_dung WHERE ten_dang_nhap = ?').get(d.ten_dang_nhap) ||
    d.ten_dang_nhap.toLowerCase() === sieuQuanTri()?.ten_dang_nhap
  )
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
  if (!dauTien) khoiTaoDuLieuMoi(khongGianCua(nd).db, nd.ho_ten);
  return nd;
}

// DB mới: migration có sẵn dữ liệu của người dùng đầu tiên. Người mới tự nhập trường, địa điểm của mình:
// bỏ thông tin giáo viên, trường, địa điểm và mẫu đề gắn với các trường đó; giữ mẫu đề chung
export function khoiTaoDuLieuMoi(db: Database.Database, hoTen: string) {
  const ghi = db.prepare('INSERT INTO cai_dat (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri');
  db.transaction(() => {
    ghi.run('ten_gv', hoTen);
    ghi.run('ma_gv', '');
    ghi.run('sdt', '');
    db.prepare('DELETE FROM mau_de WHERE truong_id IS NOT NULL').run();
    db.prepare('DELETE FROM truong').run();
    db.prepare('DELETE FROM dia_diem').run();
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

// Xóa tài khoản: đăng xuất mọi nơi, đóng DB, chuyển thư mục dữ liệu vào data/da-xoa/ (khôi phục được bằng tay).
// Không xóa tài khoản giữ dữ liệu gốc (data/giangday.db): thư mục đó chứa cả dữ liệu hệ thống
export function xoaNguoiDung(id: number): { thu_muc_luu: string } {
  const db = heThong();
  const nd = layNguoiDung(id);
  if (!nd) throw new LoiApp(404, 'Không tìm thấy người dùng');
  if (!nd.thu_muc) throw new LoiApp(400, 'Tài khoản này giữ dữ liệu gốc (data/giangday.db) nên không xóa được. Hãy khóa tài khoản thay vì xóa');
  if (nd.la_quan_tri && !nd.bi_khoa) {
    const soQuanTri = (db.prepare('SELECT count(*) AS n FROM nguoi_dung WHERE la_quan_tri = 1 AND bi_khoa = 0').get() as { n: number }).n;
    if (soQuanTri <= 1 && !sieuQuanTri()) throw new LoiApp(400, 'Phải còn ít nhất một quản trị đang hoạt động');
  }
  const kg = khongGianDaMo.get(id);
  if (kg && kg.db !== layDbMacDinh()) kg.db.close();
  khongGianDaMo.delete(id);
  db.prepare('DELETE FROM nguoi_dung WHERE id = ?').run(id); // phiên đăng nhập xóa theo (ON DELETE CASCADE)

  const goc = path.resolve(DATA_DIR, nd.thu_muc);
  const luu = path.join(DATA_DIR, 'da-xoa', `${nd.ten_dang_nhap}-${id}-${Date.now()}`);
  if (fs.existsSync(goc)) {
    fs.mkdirSync(path.dirname(luu), { recursive: true });
    fs.renameSync(goc, luu);
  }
  return { thu_muc_luu: path.relative(DATA_DIR, luu) };
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
// Đăng nhập: chặn tạm sau nhiều lần sai, càng sai nhiều càng chờ lâu.
// Đếm ở server theo 3 khóa, nên xóa cookie / đổi trình duyệt / ẩn danh đều không giúp đoán tiếp:
//   - tên đăng nhập + IP: theo BAC_KHOA
//   - một IP thử nhiều tên khác nhau: gấp 3 số lần
//   - một tài khoản bị nhiều IP cùng đoán (botnet): gấp 4 số lần
// Không sai thêm lần nào trong 24 giờ thì xóa đếm. Đăng nhập đúng thì xóa đếm của tên + IP đó.

// Từ lần sai thứ `tu`, mỗi lần sai phải chờ `phut` phút
export const BAC_KHOA = [
  { tu: 5, phut: 5 },
  { tu: 10, phut: 30 },
  { tu: 15, phut: 120 },
  { tu: 20, phut: 24 * 60 },
];
const QUEN_SAU_MS = 24 * 3600_000;

function phutKhoa(lan: number, heSo: number): number {
  let phut = 0;
  for (const b of BAC_KHOA) if (lan >= b.tu * heSo) phut = b.phut;
  return phut;
}

const docSai = (khoa: string) => {
  const r = heThong().prepare('SELECT lan, cuoi FROM dang_nhap_sai WHERE khoa = ?').get(khoa) as { lan: number; cuoi: number } | undefined;
  return r && Date.now() - r.cuoi < QUEN_SAU_MS ? r : undefined;
};

function choBaoLau(khoa: string, heSo: number): number {
  const r = docSai(khoa);
  if (!r) return 0;
  return Math.max(0, r.cuoi + phutKhoa(r.lan, heSo) * 60000 - Date.now());
}

function ghiSai(khoa: string): number {
  const lan = (docSai(khoa)?.lan ?? 0) + 1;
  heThong()
    .prepare('INSERT INTO dang_nhap_sai (khoa, lan, cuoi) VALUES (?, ?, ?) ON CONFLICT(khoa) DO UPDATE SET lan = excluded.lan, cuoi = excluded.cuoi')
    .run(khoa, lan, Date.now());
  return lan;
}

const docThoiGian = (ms: number) => {
  const phut = Math.ceil(ms / 60000);
  return phut >= 60 ? `${Math.ceil(phut / 60)} giờ` : `${phut} phút`;
};

// Mở khóa đăng nhập (lệnh "npm run tai-khoan -w server -- mo-khoa")
export function xoaDemSai() {
  heThong().prepare('DELETE FROM dang_nhap_sai').run();
}

export function dangNhap(tenDangNhap: string, matKhau: string, ip: string): NguoiDung {
  const ten = tenDangNhap.trim().toLowerCase();
  const cacKhoa = [
    { khoa: `tk-ip:${ten}|${ip}`, heSo: 1 },
    { khoa: `ip:${ip}`, heSo: 3 },
    { khoa: `tk:${ten}`, heSo: 4 },
  ];
  // Đang bị khóa: không kiểm tra mật khẩu, cũng không đếm thêm
  const cho = Math.max(...cacKhoa.map((k) => choBaoLau(k.khoa, k.heSo)));
  if (cho > 0) throw new LoiApp(429, `Sai quá nhiều lần. Thử lại sau ${docThoiGian(cho)}`);

  const sieu = sieuQuanTri();
  const laSieu = !!sieu && ten === sieu.ten_dang_nhap;
  const nd = laSieu ? sieu : timNguoiDung(ten); // tên đăng nhập hoặc email
  // Luôn băm để thời gian trả lời như nhau dù tên đăng nhập có tồn tại hay không
  const dung = laSieu ? dungMatKhauSieu(matKhau, cauHinhSieu()!.matKhau) : dungMatKhau(matKhau, nd?.mat_khau ?? 'scrypt$00$00');
  if (!nd || !dung) {
    const lan = heThong().transaction(() => cacKhoa.map((k) => ghiSai(k.khoa)))()[0];
    const tiepTheo = BAC_KHOA.find((b) => b.tu > lan);
    const dangKhoa = phutKhoa(lan, 1);
    let thongBao = 'Sai tên đăng nhập / email hoặc mật khẩu';
    if (dangKhoa) thongBao += `. Sai ${lan} lần, hãy chờ ${docThoiGian(dangKhoa * 60000)} rồi thử lại`;
    else if (tiepTheo) thongBao += `. Còn ${tiepTheo.tu - lan} lần thử trước khi bị khóa ${docThoiGian(tiepTheo.phut * 60000)}`;
    throw new LoiApp(401, thongBao);
  }
  if (nd.bi_khoa) throw new LoiApp(403, 'Tài khoản đã bị khóa. Hãy liên hệ quản trị');
  heThong().prepare('DELETE FROM dang_nhap_sai WHERE khoa = ?').run(cacKhoa[0].khoa);
  return nd;
}

// ---------------------------------------------------------------------------
// Phiên đăng nhập: mã ngẫu nhiên trong cookie, DB chỉ lưu mã băm

const bamPhien = (ma: string) => crypto.createHash('sha256').update(ma).digest('hex');

export function taoPhien(nguoiDungId: number): { ma: string; soGiay: number } {
  const ma = crypto.randomBytes(32).toString('base64url');
  const db = heThong();
  const hetHan = `datetime('now','localtime','+${THOI_HAN_PHIEN_NGAY} days')`;
  db.prepare("DELETE FROM phien WHERE het_han < datetime('now','localtime')").run();
  db.prepare("DELETE FROM phien_sieu WHERE het_han < datetime('now','localtime')").run();
  if (laSieuQuanTri(nguoiDungId))
    db.prepare(`INSERT INTO phien_sieu (ma_bam, dau_van, het_han) VALUES (?, ?, ${hetHan})`).run(bamPhien(ma), dauVanSieu());
  else db.prepare(`INSERT INTO phien (ma_bam, nguoi_dung_id, het_han) VALUES (?, ?, ${hetHan})`).run(bamPhien(ma), nguoiDungId);
  return { ma, soGiay: THOI_HAN_PHIEN_NGAY * 86400 };
}

export function layNguoiDungTheoPhien(ma: string | undefined): NguoiDung | undefined {
  if (!ma) return undefined;
  const db = heThong();
  const nd = db
    .prepare(
      `SELECT n.* FROM phien p JOIN nguoi_dung n ON n.id = p.nguoi_dung_id
       WHERE p.ma_bam = ? AND p.het_han > datetime('now','localtime')`,
    )
    .get(bamPhien(ma)) as NguoiDung | undefined;
  if (nd) return nd.bi_khoa ? undefined : nd;
  const sieu = sieuQuanTri();
  if (!sieu) return undefined;
  const p = db
    .prepare("SELECT dau_van FROM phien_sieu WHERE ma_bam = ? AND het_han > datetime('now','localtime')")
    .get(bamPhien(ma)) as { dau_van: string } | undefined;
  return p?.dau_van === dauVanSieu() ? sieu : undefined;
}

export function xoaPhien(ma: string | undefined) {
  if (!ma) return;
  heThong().prepare('DELETE FROM phien WHERE ma_bam = ?').run(bamPhien(ma));
  heThong().prepare('DELETE FROM phien_sieu WHERE ma_bam = ?').run(bamPhien(ma));
}

// ---------------------------------------------------------------------------
// Không gian dữ liệu của người dùng (mở DB một lần rồi giữ lại)

export function khongGianCua(nd: NguoiDung): KhongGian {
  let kg = khongGianDaMo.get(nd.id);
  if (!kg) {
    const thuMuc = path.resolve(DATA_DIR, nd.thu_muc);
    const duongDan = path.join(thuMuc, 'giangday.db');
    // Người dùng đầu tiên dùng chung kết nối mặc định (data/giangday.db) để không mở hai lần
    const moi = !fs.existsSync(duongDan);
    const db = duongDan === path.resolve(DB_PATH) ? layDbMacDinh() : moDb(duongDan);
    // Siêu quản trị không đi qua taoNguoiDung: khởi tạo dữ liệu lần đầu mở
    if (moi && laSieuQuanTri(nd.id)) khoiTaoDuLieuMoi(db, nd.ho_ten);
    kg = { nguoiDungId: nd.id, laQuanTri: !!nd.la_quan_tri, db, thuMuc };
    khongGianDaMo.set(nd.id, kg);
  }
  return kg;
}

export function dsKhongGian(): KhongGian[] {
  const ds = (heThong().prepare('SELECT * FROM nguoi_dung WHERE bi_khoa = 0').all() as NguoiDung[]).map(khongGianCua);
  const sieu = sieuQuanTri();
  if (sieu) ds.push(khongGianCua(sieu));
  return ds;
}
