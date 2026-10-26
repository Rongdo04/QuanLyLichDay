import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import './utils/zod.js'; // đăng ký thông báo lỗi tiếng Việt
import { taoApiRouter } from './routes/index.js';
import { xuLyLoi } from './utils/loi.js';

const thuMucClient = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function taoApp({ boQuaDangNhap = false } = {}) {
  const app = express();
  // Chạy sau proxy (Cloudflare Tunnel, nginx…) trên cùng máy: tin X-Forwarded-* để biết HTTPS / IP thật
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', taoApiRouter({ boQuaDangNhap }));

  // Bản dùng thật: phục vụ giao diện đã build
  if (fs.existsSync(thuMucClient)) {
    app.use(express.static(thuMucClient));
    app.get('*', (_req, res) => res.sendFile(path.join(thuMucClient, 'index.html')));
  }

  app.use(xuLyLoi);
  return app;
}
