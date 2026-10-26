import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { chayTrongKhongGian, layKhongGian } from '../db/connection.js';

// Nhận 1 file tải lên (giữ trong bộ nhớ, tối đa 20 MB)
const multerBoNho = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

// multer gọi tiếp từ sự kiện của luồng dữ liệu nên mất ngữ cảnh người dùng → gắn lại cho bước sau
export const upload = {
  single(ten: string) {
    const xuLy = multerBoNho.single(ten);
    return (req: Request, res: Response, next: NextFunction) => {
      const kg = layKhongGian();
      xuLy(req, res, (loi?: unknown) => (kg ? chayTrongKhongGian(kg, () => next(loi)) : next(loi)));
    };
  },
};

// Tên file gốc: ưu tiên trường ten_file client gửi kèm (UTF-8 chắc chắn đúng);
// nếu không có thì sửa tên do multer giải mã theo latin1
export function layTenFile(req: Request): string {
  const tuClient = typeof req.body?.ten_file === 'string' ? req.body.ten_file.trim() : '';
  if (tuClient) return tuClient.normalize('NFC');
  const goc = req.file!.originalname;
  if ([...goc].some((c) => c.charCodeAt(0) > 0xff)) return goc.normalize('NFC');
  const sua = Buffer.from(goc, 'latin1').toString('utf8');
  return (sua.includes('�') ? goc : sua).normalize('NFC');
}
