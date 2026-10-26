// Quản lý tài khoản từ dòng lệnh, chạy trên máy có thư mục data/ (không cần mở web):
//   npm run tai-khoan -w server -- tao <tên đăng nhập> <mật khẩu> [email] [họ tên] [--quan-tri]
//   npm run tai-khoan -w server -- dat-lai <tên đăng nhập hoặc email> <mật khẩu mới>
//   npm run tai-khoan -w server -- ds
// "dat-lai" dùng khi quản trị quên mật khẩu. Tài khoản đầu tiên luôn là quản trị và nhận dữ liệu đang có.
import { DATA_DIR } from '../src/db/connection.js';
import { dsNguoiDung, suaNguoiDung, taoNguoiDung, timNguoiDung } from '../src/services/taiKhoan.js';

const [lenh, ...thamSo] = process.argv.slice(2);
const quanTri = thamSo.includes('--quan-tri');
const [a, b, c, d] = thamSo.filter((t) => t !== '--quan-tri');

function dung(thongBao: string): never {
  console.error(thongBao);
  process.exit(1);
}

try {
  if (lenh === 'tao') {
    if (!a || !b) dung('Cách dùng: tao <tên đăng nhập> <mật khẩu> [email] [họ tên] [--quan-tri]');
    if (!/^[a-z0-9._-]{3,32}$/.test(a.toLowerCase())) dung('Tên đăng nhập 3–32 ký tự: chữ không dấu, số, . _ -');
    if (b.length < 6) dung('Mật khẩu cần ít nhất 6 ký tự');
    const n = taoNguoiDung({ ten_dang_nhap: a.toLowerCase(), mat_khau: b, email: c?.toLowerCase() || null, ho_ten: d || a, la_quan_tri: quanTri });
    console.log(`Đã tạo tài khoản ${n.ten_dang_nhap} (${n.la_quan_tri ? 'quản trị' : 'người dùng'}) trong ${DATA_DIR}`);
  } else if (lenh === 'dat-lai') {
    if (!a || !b) dung('Cách dùng: dat-lai <tên đăng nhập hoặc email> <mật khẩu mới>');
    if (b.length < 6) dung('Mật khẩu cần ít nhất 6 ký tự');
    const n = timNguoiDung(a) ?? dung(`Không có tài khoản "${a}"`);
    suaNguoiDung(n.id, { mat_khau: b, bi_khoa: n.la_quan_tri ? undefined : false });
    console.log(`Đã đặt lại mật khẩu cho ${n.ten_dang_nhap}`);
  } else if (lenh === 'ds') {
    console.table(dsNguoiDung());
  } else {
    dung('Lệnh: tao | dat-lai | ds');
  }
} catch (e) {
  dung((e as Error).message);
}
