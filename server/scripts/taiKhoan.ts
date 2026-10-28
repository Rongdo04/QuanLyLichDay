// Quản lý tài khoản từ dòng lệnh, chạy trên máy có thư mục data/ (không cần mở web):
//   npm run tai-khoan -w server -- tao <tên đăng nhập> <mật khẩu> [email] [họ tên] [--quan-tri]
//   npm run tai-khoan -w server -- dat-lai <tên đăng nhập hoặc email> <mật khẩu mới>
//   npm run tai-khoan -w server -- ds
//   npm run tai-khoan -w server -- mo-khoa                 (xóa mọi lượt khóa do đăng nhập sai)
//   npm run tai-khoan -w server -- bam <mật khẩu>          (tạo chuỗi băm để dán vào SIEU_QUAN_TRI_MAT_KHAU trong .env)
// "dat-lai" dùng khi quản trị quên mật khẩu. Tài khoản đầu tiên luôn là quản trị và nhận dữ liệu đang có.
import '../src/moiTruong.js';
import { DATA_DIR } from '../src/db/connection.js';
import {
  bamMatKhau,
  DO_DAI_MAT_KHAU_SIEU,
  dsNguoiDung,
  suaNguoiDung,
  taoNguoiDung,
  timNguoiDung,
  xoaDemSai,
} from '../src/services/taiKhoan.js';

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
  } else if (lenh === 'mo-khoa') {
    xoaDemSai();
    console.log('Đã mở khóa đăng nhập cho mọi tài khoản / IP');
  } else if (lenh === 'bam') {
    if (!a || a.length < DO_DAI_MAT_KHAU_SIEU) dung(`Cách dùng: bam <mật khẩu ≥ ${DO_DAI_MAT_KHAU_SIEU} ký tự>`);
    console.log(`SIEU_QUAN_TRI_MAT_KHAU=${bamMatKhau(a)}`);
  } else {
    dung('Lệnh: tao | dat-lai | ds | mo-khoa | bam');
  }
} catch (e) {
  dung((e as Error).message);
}
