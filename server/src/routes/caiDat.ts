import { Router } from 'express';
import { ghiCaiDat, layCaiDat } from '../repositories/caiDat.js';
import { z, zNgay } from '../utils/zod.js';

const schemaCaiDat = z
  .object({
    ten_gv: z.string().trim().min(1).max(100),
    ma_gv: z.string().trim().max(20),
    sdt: z.string().trim().max(20),
    gio_sang: z.string().trim().max(20),
    gio_chieu: z.string().trim().max(20),
    nam_hoc: z.string().trim().regex(/^\d{4}-\d{4}$/, 'Năm học phải có dạng 2026-2027'),
    ngay_nghi: z.array(
      z
        .object({
          tu: zNgay,
          den: zNgay.nullish().transform((v) => v ?? null),
          ten: z.string().trim().max(100).nullish().transform((v) => v || null),
        })
        .refine((n) => !n.den || n.den >= n.tu, 'Ngày nghỉ: "đến ngày" phải sau "từ ngày"'),
    ),
    thu_muc_sao_luu: z.string().trim().max(500),
  })
  .partial();

export const caiDatRouter = Router();

caiDatRouter.get('/', (_req, res) => {
  res.json(layCaiDat());
});

caiDatRouter.put('/', (req, res) => {
  const d = schemaCaiDat.parse(req.body);
  if (d.ngay_nghi) d.ngay_nghi.sort((a, b) => a.tu.localeCompare(b.tu));
  res.json(ghiCaiDat(d));
});
