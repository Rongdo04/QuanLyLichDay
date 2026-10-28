import './moiTruong.js'; // đọc .env trước mọi thứ khác
import { exec } from 'node:child_process';
import { taoApp } from './app.js';
import { batBuocKhongGian, chayTrongKhongGian, layDb } from './db/connection.js';
import { saoLuuTuDong } from './services/saoLuu.js';
import { coNguoiDung, dsKhongGian, loiCauHinhSieu, sieuQuanTri } from './services/taiKhoan.js';

const PORT = Number(process.env.PORT ?? 3000);
// Mặc định chỉ nhận kết nối từ máy này (Cloudflare Tunnel vẫn chạy được). HOST=0.0.0.0 để máy khác vào thẳng.
const HOST = process.env.HOST ?? '127.0.0.1';
const URL = `http://localhost:${PORT}`;
const moTrinhDuyet = process.env.MO_TRINH_DUYET === '1';

function moUrl(url: string) {
  const lenh =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(lenh, () => {});
}

// Mở DB ngay khi khởi động (tạo file + chạy migration nếu cần)
layDb();

// Sao lưu tự động cho từng người dùng nếu bản gần nhất đã cũ hơn 24 giờ
// (chưa có tài khoản nào thì sao lưu dữ liệu đang có)
const dsCanSaoLuu = [...(coNguoiDung() ? [] : [null]), ...dsKhongGian()];
for (const kg of dsCanSaoLuu) {
  try {
    const ban = kg ? chayTrongKhongGian(kg, saoLuuTuDong) : saoLuuTuDong();
    if (ban) console.log(`Đã sao lưu tự động: ${ban.duong_dan}`);
  } catch (e) {
    console.error('Không sao lưu tự động được:', (e as Error).message);
  }
}
batBuocKhongGian();

const server = taoApp().listen(PORT, HOST, () => {
  console.log(`Server chạy tại ${URL}`);
  const loiSieu = loiCauHinhSieu();
  if (loiSieu) console.warn(`Chưa bật siêu quản trị: ${loiSieu} (xem file .env)`);
  else if (sieuQuanTri()) console.log(`Siêu quản trị: ${sieuQuanTri()!.ten_dang_nhap}`);
  if (!coNguoiDung() && !sieuQuanTri())
    console.warn(
      'Chưa có tài khoản nào: đặt SIEU_QUAN_TRI_TEN / SIEU_QUAN_TRI_MAT_KHAU trong file .env rồi chạy lại, ' +
        'hoặc chạy "npm run tai-khoan -w server -- tao <tên> <mật khẩu> --quan-tri"',
    );
  if (moTrinhDuyet) moUrl(URL);
});

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Cổng ${PORT} đang được dùng. Có thể phần mềm đã chạy rồi, hãy mở ${URL}`);
    if (moTrinhDuyet) moUrl(URL);
    process.exit(1);
  }
  throw e;
});
