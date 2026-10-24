import { Router } from 'express';
import { xuatFileTruong } from '../services/xuatExcel.js';
import { xuatTongHop } from '../services/xuatTongHop.js';
import { datHeaderTaiFile } from '../utils/chuoi.js';
import { bocAsync } from '../utils/loi.js';
import { z, zId, zIdThamSo, zQueryNgay } from '../utils/zod.js';

const kiemTraKhoang = (d: { tu?: string; den?: string }) => !d.tu || !d.den || d.tu <= d.den;
const LOI_KHOANG = '"Từ ngày" phải trước "Đến ngày"';

const schemaXuatTruong = z
  .object({
    lopIds: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()) : undefined),
      z.array(zId).optional(),
    ),
    tu: zQueryNgay,
    den: zQueryNgay,
  })
  .refine(kiemTraKhoang, LOI_KHOANG);

const schemaKhoang = z.object({ tu: zQueryNgay, den: zQueryNgay }).refine(kiemTraKhoang, LOI_KHOANG);

export const xuatRouter = Router();

xuatRouter.get(
  '/truong/:id',
  bocAsync(async (req, res) => {
    const { id } = zIdThamSo.parse(req.params);
    const { tenFile, buffer } = await xuatFileTruong(id, schemaXuatTruong.parse(req.query));
    datHeaderTaiFile(res, tenFile);
    res.send(buffer);
  }),
);

xuatRouter.get(
  '/tong-hop',
  bocAsync(async (req, res) => {
    const { tenFile, buffer } = await xuatTongHop(schemaKhoang.parse(req.query));
    datHeaderTaiFile(res, tenFile);
    res.send(buffer);
  }),
);
