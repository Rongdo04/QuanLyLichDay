import { Router } from 'express';
import { layCaiDat } from '../repositories/caiDat.js';
import { thongKe, thongKeThang } from '../services/thongKe.js';
import { z, zQueryId, zQueryNgay } from '../utils/zod.js';

const schemaLoc = z
  .object({ tu: zQueryNgay, den: zQueryNgay, truongId: zQueryId })
  .refine((d) => !d.tu || !d.den || d.tu <= d.den, '"Từ ngày" phải trước "Đến ngày"');

const schemaThang = z.object({
  namHoc: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().regex(/^\d{4}-\d{4}$/, 'Năm học phải có dạng 2026-2027').optional(),
  ),
});

export const thongKeRouter = Router();

thongKeRouter.get('/', (req, res) => {
  res.json(thongKe(schemaLoc.parse(req.query)));
});

thongKeRouter.get('/thang', (req, res) => {
  const { namHoc } = schemaThang.parse(req.query);
  res.json(thongKeThang(namHoc ?? layCaiDat().nam_hoc));
});
