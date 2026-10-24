import { Router } from 'express';
import { dsDiaDiem, layDiaDiem, suaDiaDiem, taoDiaDiem, xoaDiaDiem } from '../repositories/diaDiem.js';
import { khongTimThay } from '../utils/loi.js';
import { z, zChuoiTuyChon, zIdThamSo } from '../utils/zod.js';

const schemaDiaDiem = z.object({
  ten_ngan: z.string().trim().min(1).max(50),
  ten_day_du: zChuoiTuyChon,
  tien_dc: z.number().int().min(0).default(0),
});

export const diaDiemRouter = Router();

diaDiemRouter.get('/', (_req, res) => {
  res.json(dsDiaDiem());
});

diaDiemRouter.post('/', (req, res) => {
  res.status(201).json(taoDiaDiem(schemaDiaDiem.parse(req.body)));
});

diaDiemRouter.put('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layDiaDiem(id)) throw khongTimThay('địa điểm');
  res.json(suaDiaDiem(id, schemaDiaDiem.partial().parse(req.body)));
});

diaDiemRouter.delete('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layDiaDiem(id)) throw khongTimThay('địa điểm');
  xoaDiaDiem(id);
  res.status(204).end();
});
