import { exec } from 'node:child_process';
import { taoApp } from './app.js';
import { layDb } from './db/connection.js';
import { saoLuuTuDong } from './services/saoLuu.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = '127.0.0.1';
const URL = `http://localhost:${PORT}`;
const moTrinhDuyet = process.env.MO_TRINH_DUYET === '1';

function moUrl(url: string) {
  const lenh =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(lenh, () => {});
}

// Mở DB ngay khi khởi động (tạo file + chạy migration nếu cần)
layDb();

// Sao lưu tự động nếu bản gần nhất đã cũ hơn 24 giờ
try {
  const ban = saoLuuTuDong();
  if (ban) console.log(`Đã sao lưu tự động: ${ban.duong_dan}`);
} catch (e) {
  console.error('Không sao lưu tự động được:', (e as Error).message);
}

const server = taoApp().listen(PORT, HOST, () => {
  console.log(`Server chạy tại ${URL}`);
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
