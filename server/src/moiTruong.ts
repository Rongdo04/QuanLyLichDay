import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Đọc file .env ở gốc dự án nếu có (siêu quản trị, khóa API AI, PORT…). Biến đã đặt sẵn ngoài shell được giữ nguyên.
const tep = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
if (fs.existsSync(tep)) process.loadEnvFile(tep);
