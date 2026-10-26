import { Router } from 'express';
import { dsTruong, layTruong, suaTruong, taoTruong, xoaTruong } from '../repositories/truong.js';
import { khongTimThay } from '../utils/loi.js';
import { z, zChuoiTuyChon, zCo, zIdThamSo } from '../utils/zod.js';

const schemaTruong = z.object({
  ma: z.string().trim().min(1).max(20),
  ten: z.string().trim().min(1).max(200),
  ghi_chu: zChuoiTuyChon,
  da_an: zCo.default(0),
  thue: z.number().int().min(0).max(100).default(10),
});

export const truongRouter = Router();

truongRouter.get('/', (_req, res) => {
  res.json(dsTruong());
});

truongRouter.post('/', (req, res) => {
  res.status(201).json(taoTruong(schemaTruong.parse(req.body)));
});

truongRouter.put('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layTruong(id)) throw khongTimThay('trường');
  res.json(suaTruong(id, schemaTruong.partial().parse(req.body)));
});

truongRouter.delete('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layTruong(id)) throw khongTimThay('trường');
  xoaTruong(id);
  res.status(204).end();
});
