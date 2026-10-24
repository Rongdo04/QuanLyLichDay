import { Router } from 'express';
import { dsCauHoi, layCauHoi, suaCauHoi, taoNhieuCauHoi, xoaCauHoi } from '../repositories/cauHoi.js';
import { dsMon, hocPhanChuaCoMon, layMon, suaMon, taoMon, xoaMon } from '../repositories/mon.js';
import { soanCauHoi } from '../services/aiSoanCau.js';
import { phanTichVanBan } from '../services/phanTichCauHoi.js';
import { bocAsync, khongTimThay } from '../utils/loi.js';
import { z, zChuoiTuyChon, zIdThamSo } from '../utils/zod.js';

const zMucDo = z.enum(['de', 'tb', 'kho']);
const zDiem = z.number().positive().max(10);

const schemaMon = z.object({
  ten: z.string().trim().min(1).max(200),
  ma: zChuoiTuyChon,
  nganh: z.string().trim().min(1).max(200).default('Công nghệ thông tin'),
  trinh_do: z.string().trim().min(1).max(100).default('Trung cấp'),
  de_cuong: z.string().trim().max(20000).nullish().transform((v) => v || null),
});

const schemaCauHoi = z.object({
  chu_de: zChuoiTuyChon,
  muc_do: zMucDo.default('tb'),
  diem: zDiem.nullish().transform((v) => v ?? null),
  noi_dung: z.string().trim().min(1).max(5000),
  dap_an: z.string().trim().max(10000).default(''),
  nguon: z.enum(['tay', 'ai']).default('tay'),
});

const schemaSoan = z.object({
  so_cau: z.number().int().min(1).max(20),
  diem: z.array(zDiem).min(1).max(20),
  muc_do: z.enum(['de', 'tb', 'kho', 'tron']).default('tron'),
  chu_de: zChuoiTuyChon,
  yeu_cau_them: z.string().trim().max(1000).nullish().transform((v) => v || null),
});

export const monRouter = Router();

function layMonTuThamSo(params: unknown) {
  const { id } = zIdThamSo.parse(params);
  const mon = layMon(id);
  if (!mon) throw khongTimThay('môn');
  return mon;
}

monRouter.get('/', (_req, res) => {
  res.json({ mon: dsMon(), goi_y: hocPhanChuaCoMon() });
});

monRouter.post('/', (req, res) => {
  res.status(201).json(taoMon(schemaMon.parse(req.body)));
});

monRouter.get('/:id', (req, res) => {
  const mon = layMonTuThamSo(req.params);
  res.json({ ...mon, cau_hoi: dsCauHoi(mon.id) });
});

monRouter.put('/:id', (req, res) => {
  const mon = layMonTuThamSo(req.params);
  res.json(suaMon(mon.id, schemaMon.partial().parse(req.body)));
});

monRouter.delete('/:id', (req, res) => {
  const mon = layMonTuThamSo(req.params);
  xoaMon(mon.id);
  res.status(204).end();
});

// Thêm một hoặc nhiều câu hỏi (body là 1 câu hoặc { cau_hoi: [...] })
monRouter.post('/:id/cau-hoi', (req, res) => {
  const mon = layMonTuThamSo(req.params);
  const ds = Array.isArray(req.body?.cau_hoi)
    ? z.array(schemaCauHoi).min(1).max(500).parse(req.body.cau_hoi)
    : [schemaCauHoi.parse(req.body)];
  const ids = taoNhieuCauHoi(mon.id, ds);
  res.status(201).json({ so_cau: ids.length, ids });
});

// Tách câu hỏi từ văn bản dán vào (chỉ xem trước, chưa lưu)
monRouter.post('/:id/cau-hoi/tach-van-ban', (req, res) => {
  layMonTuThamSo(req.params);
  const { van_ban } = z.object({ van_ban: z.string().max(200_000) }).parse(req.body);
  res.json(phanTichVanBan(van_ban));
});

// AI soạn câu hỏi (chỉ trả bản nháp, chưa lưu)
monRouter.post(
  '/:id/ai-soan',
  bocAsync(async (req, res) => {
    const mon = layMonTuThamSo(req.params);
    const y = schemaSoan.parse(req.body);
    res.json(await soanCauHoi(mon, y, dsCauHoi(mon.id)));
  }),
);

export const cauHoiRouter = Router();

function layCauTuThamSo(params: unknown) {
  const { id } = zIdThamSo.parse(params);
  const c = layCauHoi(id);
  if (!c) throw khongTimThay('câu hỏi');
  return c;
}

cauHoiRouter.put('/:id', (req, res) => {
  const c = layCauTuThamSo(req.params);
  res.json(suaCauHoi(c.id, schemaCauHoi.partial().parse(req.body)));
});

cauHoiRouter.delete('/:id', (req, res) => {
  const c = layCauTuThamSo(req.params);
  xoaCauHoi(c.id);
  res.status(204).end();
});
