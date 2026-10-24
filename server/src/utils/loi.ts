import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

// Express 4 không tự bắt lỗi của hàm async → bọc lại để chuyển lỗi cho xuLyLoi
export const bocAsync =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// Lỗi nghiệp vụ có mã HTTP và thông báo tiếng Việt
export class LoiApp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const khongTimThay = (ten: string) => new LoiApp(404, `Không tìm thấy ${ten}`);

export const xuLyLoi: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ loi: err.issues.map((i) => i.message).join('; ') });
    return;
  }
  if (err instanceof LoiApp) {
    res.status(err.status).json({ loi: err.message });
    return;
  }
  // JSON gửi lên sai cú pháp / quá lớn
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ loi: 'Dữ liệu gửi lên không phải JSON hợp lệ' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ loi: 'Dữ liệu gửi lên quá lớn' });
    return;
  }
  // Lỗi tải file lên (multer)
  if (err?.name === 'MulterError') {
    const loi =
      err.code === 'LIMIT_FILE_SIZE' ? 'File quá lớn (tối đa 20 MB)' : `Lỗi tải file lên: ${err.message}`;
    res.status(400).json({ loi });
    return;
  }
  if (typeof err?.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    const loi =
      err.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ? 'Dữ liệu bị trùng với bản ghi đã có'
        : err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
          ? 'Dữ liệu tham chiếu không tồn tại hoặc đang được dùng'
          : 'Dữ liệu vi phạm ràng buộc';
    res.status(409).json({ loi });
    return;
  }
  console.error(err);
  res.status(500).json({ loi: 'Lỗi máy chủ: ' + (err?.message ?? 'không rõ') });
};
