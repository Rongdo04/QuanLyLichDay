import { Router } from 'express';
import { dsBanSaoLuu, saoLuuNgay, thuMucSaoLuu } from '../services/saoLuu.js';

export const saoLuuRouter = Router();

saoLuuRouter.get('/', (_req, res) => {
  res.json({ thu_muc: thuMucSaoLuu(), ban: dsBanSaoLuu() });
});

saoLuuRouter.post('/', (_req, res) => {
  res.status(201).json(saoLuuNgay());
});
