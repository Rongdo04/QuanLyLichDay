import { Router } from 'express';
import { dsKyHoc, layKyHoc, suaKyHoc, taoKyHoc, themLopVaoKy, xoaKyHoc } from '../repositories/kyHoc.js';
import { khongTimThay } from '../utils/loi.js';
import { z, zId, zIdThamSo, zNgay } from '../utils/zod.js';

// Không nhận tên: tên tự sinh theo ngày bắt đầu (HK1_2026-2027)
const schemaKyHoc = z.object({
  ngay_bat_dau: zNgay,
  ngay_ket_thuc: zNgay.nullish().transform((v) => v ?? null),
});

export const kyHocRouter = Router();

kyHocRouter.get('/', (_req, res) => {
  res.json(dsKyHoc());
});

kyHocRouter.post('/', (req, res) => {
  res.status(201).json(taoKyHoc(schemaKyHoc.parse(req.body)));
});

kyHocRouter.put('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layKyHoc(id)) throw khongTimThay('kỳ học');
  res.json(suaKyHoc(id, schemaKyHoc.partial().parse(req.body)));
});

// Thêm các lớp đã tạo vào kỳ
kyHocRouter.post('/:id/lop', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layKyHoc(id)) throw khongTimThay('kỳ học');
  const { lop_ids } = z.object({ lop_ids: z.array(zId).min(1, 'Chưa chọn lớp nào') }).parse(req.body);
  res.json({ so_lop: themLopVaoKy(id, lop_ids) });
});

kyHocRouter.delete('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layKyHoc(id)) throw khongTimThay('kỳ học');
  xoaKyHoc(id);
  res.status(204).end();
});
