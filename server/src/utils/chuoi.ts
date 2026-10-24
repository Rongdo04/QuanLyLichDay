import type { Response } from 'express';

// Bỏ dấu tiếng Việt: "Đa Ngành" → "Da Nganh"
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Chuẩn hóa để so khớp: bỏ dấu, viết hoa, chỉ giữ chữ và số
export function khoaSoKhop(s: string): string {
  return boDau(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// 'YYYY-MM-DD' → 'dd.mm.yyyy' (dùng trong tên file)
export function ngayTrongTenFile(ngay: string): string {
  const [y, m, d] = ngay.split('-');
  return `${d}.${m}.${y}`;
}

// Header tải file, tên file tiếng Việt mã hóa UTF-8 (RFC 5987)
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function datHeaderTaiFile(res: Response, tenFile: string, loai: string = MIME_XLSX) {
  const ascii = boDau(tenFile).replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  res.setHeader('Content-Type', loai);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(tenFile)}`,
  );
}
