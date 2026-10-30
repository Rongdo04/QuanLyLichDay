import { Router } from 'express';
import { dsBuoi, layBuoi, suaBuoi, taoBuoi, xoaBuoi } from '../repositories/buoi.js';
import { dongBoTrangThai, layLop, soBuoiDaDay } from '../repositories/lop.js';
import { khongTimThay, LoiApp } from '../utils/loi.js';
import { z, zChuoiTuyChon, zCo, zId, zIdThamSo, zNgay, zQueryId, zQueryNgay } from '../utils/zod.js';

const zDuKien = z.enum(['S', 'C', 'SC']).nullish().transform((v) => v ?? null);

const schemaTaoBuoi = z.object({
  lop_id: zId,
  ngay: zNgay,
  sang: zCo.default(0),
  chieu: zCo.default(0),
  co_tien_dc: zCo.default(1),
  ghi_chu: zChuoiTuyChon,
  du_kien: zDuKien,
});

const schemaSuaBuoi = z
  .object({
    ngay: zNgay,
    sang: zCo,
    chieu: zCo,
    co_tien_dc: zCo,
    ghi_chu: zChuoiTuyChon,
    du_kien: zDuKien,
  })
  .partial();

const schemaLocBuoi = z.object({
  tu: zQueryNgay,
  den: zQueryNgay,
  truongId: zQueryId,
  lopId: zQueryId,
});

export const buoiRouter = Router();

buoiRouter.get('/', (req, res) => {
  res.json(dsBuoi(schemaLocBuoi.parse(req.query)));
});

buoiRouter.post('/', (req, res) => {
  const d = schemaTaoBuoi.parse(req.body);
  if (!layLop(d.lop_id)) throw new LoiApp(400, 'Lớp không tồn tại');
  const buoi = taoBuoi(d);
  dongBoTrangThai(d.lop_id);
  res.status(201).json(buoi);
});

buoiRouter.patch('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const cu = layBuoi(id);
  if (!cu) throw khongTimThay('ngày dạy');
  const truoc = soBuoiDaDay(cu.lop_id);
  const buoi = suaBuoi(id, schemaSuaBuoi.parse(req.body));
  dongBoTrangThai(cu.lop_id, truoc);
  res.json(buoi);
});

buoiRouter.delete('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const cu = layBuoi(id);
  if (!cu) throw khongTimThay('ngày dạy');
  const truoc = soBuoiDaDay(cu.lop_id);
  xoaBuoi(id);
  dongBoTrangThai(cu.lop_id, truoc);
  res.status(204).end();
});
