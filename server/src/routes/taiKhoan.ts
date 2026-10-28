import { Router, type NextFunction, type Request, type Response } from 'express';
import { chayTrongKhongGian, layKhongGian } from '../db/connection.js';
import {
  congKhai,
  dangNhap,
  doiMatKhau,
  dsNguoiDung,
  khongGianCua,
  laSieuQuanTri,
  layNguoiDungTheoPhien,
  suaNguoiDung,
  taoNguoiDung,
  taoPhien,
  xoaPhien,
  type NguoiDung,
} from '../services/taiKhoan.js';
import { LoiApp } from '../utils/loi.js';
import { z, zIdThamSo } from '../utils/zod.js';

const TEN_COOKIE = 'phien';

const zTenDangNhap = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, 'Tên đăng nhập 3–32 ký tự, chỉ gồm chữ không dấu, số và . _ -');
const zMatKhau = z.string().min(6, 'Mật khẩu cần ít nhất 6 ký tự').max(200);
const zHoTen = z.string().trim().min(1).max(100);
const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((s) => s === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), 'Email không hợp lệ')
  .nullish()
  .transform((v) => v || null);

// Cookie không cần thư viện: chỉ đọc một khóa
function docCookie(req: Request, ten: string): string | undefined {
  for (const phan of (req.headers.cookie ?? '').split(';')) {
    const i = phan.indexOf('=');
    if (i > 0 && phan.slice(0, i).trim() === ten) return decodeURIComponent(phan.slice(i + 1).trim());
  }
  return undefined;
}

function ghiCookie(req: Request, res: Response, giaTri: string, soGiay: number) {
  const phan = [`${TEN_COOKIE}=${encodeURIComponent(giaTri)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${soGiay}`];
  if (req.secure) phan.push('Secure'); // chạy qua HTTPS (Cloudflare, host có SSL)
  res.setHeader('Set-Cookie', phan.join('; '));
}

function dangNhapVao(req: Request, res: Response, nd: NguoiDung) {
  const { ma, soGiay } = taoPhien(nd.id);
  ghiCookie(req, res, ma, soGiay);
  res.json({ nguoi_dung: congKhai(nd) });
}

// Gắn vào mọi API dữ liệu: cần đăng nhập, rồi chạy trong không gian dữ liệu của người đó
export function canDangNhap(req: Request, res: Response, next: NextFunction) {
  const nd = layNguoiDungTheoPhien(docCookie(req, TEN_COOKIE));
  if (!nd) {
    res.status(401).json({ loi: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
    return;
  }
  chayTrongKhongGian(khongGianCua(nd), () => next());
}

function canQuanTri(_req: Request, _res: Response, next: NextFunction) {
  if (!layKhongGian()?.laQuanTri) throw new LoiApp(403, 'Chỉ quản trị mới làm được việc này');
  next();
}

export const taiKhoanRouter = Router();

// Trạng thái hiện tại: đang đăng nhập là ai. Không có đăng ký: tài khoản do quản trị tạo
// (siêu quản trị trong .env, hoặc lệnh "npm run tai-khoan" trên máy chủ)
taiKhoanRouter.get('/toi', (req, res) => {
  const nd = layNguoiDungTheoPhien(docCookie(req, TEN_COOKIE));
  res.json({ nguoi_dung: nd ? congKhai(nd) : null });
});

taiKhoanRouter.post('/dang-nhap', (req, res) => {
  const d = z.object({ ten_dang_nhap: z.string().trim(), mat_khau: z.string() }).parse(req.body);
  dangNhapVao(req, res, dangNhap(d.ten_dang_nhap, d.mat_khau, req.ip ?? ''));
});

taiKhoanRouter.post('/dang-xuat', (req, res) => {
  xoaPhien(docCookie(req, TEN_COOKIE));
  ghiCookie(req, res, '', 0);
  res.status(204).end();
});

// Siêu quản trị không có trong DB: đổi tên / mật khẩu trong file .env
function khongPhaiSieu(_req: Request, _res: Response, next: NextFunction) {
  if (laSieuQuanTri(layKhongGian()!.nguoiDungId))
    throw new LoiApp(400, 'Tài khoản siêu quản trị đổi tên / mật khẩu trong file .env trên máy chủ');
  next();
}

// Hồ sơ: người dùng tự sửa họ tên, email của mình
taiKhoanRouter.put('/toi', canDangNhap, khongPhaiSieu, (req, res) => {
  const d = z.object({ ho_ten: zHoTen, email: zEmail }).partial().parse(req.body);
  res.json(suaNguoiDung(layKhongGian()!.nguoiDungId, d));
});

taiKhoanRouter.put('/mat-khau', canDangNhap, khongPhaiSieu, (req, res) => {
  const d = z.object({ mat_khau_cu: z.string(), mat_khau_moi: zMatKhau }).parse(req.body);
  doiMatKhau(layKhongGian()!.nguoiDungId, d.mat_khau_cu, d.mat_khau_moi, docCookie(req, TEN_COOKIE)!);
  res.status(204).end();
});

// --- Quản trị: tạo tài khoản cho bạn bè, đặt lại mật khẩu, khóa / mở khóa

taiKhoanRouter.get('/nguoi-dung', canDangNhap, canQuanTri, (_req, res) => {
  res.json(dsNguoiDung());
});

taiKhoanRouter.post('/nguoi-dung', canDangNhap, canQuanTri, (req, res) => {
  const d = z
    .object({ ten_dang_nhap: zTenDangNhap, ho_ten: zHoTen, email: zEmail, mat_khau: zMatKhau, la_quan_tri: z.boolean().default(false) })
    .parse(req.body);
  res.status(201).json(congKhai(taoNguoiDung(d)));
});

taiKhoanRouter.put('/nguoi-dung/:id', canDangNhap, canQuanTri, (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const d = z
    .object({ ho_ten: zHoTen, email: zEmail, mat_khau: zMatKhau, bi_khoa: z.boolean(), la_quan_tri: z.boolean() })
    .partial()
    .parse(req.body);
  if (id === layKhongGian()!.nguoiDungId && (d.bi_khoa || d.la_quan_tri === false))
    throw new LoiApp(400, 'Không tự khóa hoặc tự bỏ quyền quản trị của mình được');
  res.json(suaNguoiDung(id, d));
});
