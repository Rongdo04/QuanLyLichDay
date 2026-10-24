import { Router } from 'express';
import { dsMauDe, docTepMau, layMauDe, suaMauDe, taoMauDe, thayTepMau, xoaMauDe } from '../repositories/mauDe.js';
import { layTruong } from '../repositories/truong.js';
import { ghiKhoaApi, kiemTraKhoa, trangThaiKhoa } from '../services/aiSoanCau.js';
import { docFileWord } from '../services/chuyenDoc.js';
import { CAC_O_DIEN, kiemTraMau } from '../services/mauWord.js';
import { dsDeThi, fileDeThi, goiYDeThi, layDeThi, taoDeThi, xemTruocDe, xoaDeThi } from '../services/sinhDe.js';
import { datHeaderTaiFile, MIME_DOCX } from '../utils/chuoi.js';
import { bocAsync, khongTimThay, LoiApp } from '../utils/loi.js';
import { layTenFile, upload } from '../utils/taiLen.js';
import { z, zId, zIdThamSo, zQueryId } from '../utils/zod.js';

const zDiem = z.number().positive().max(10);
const zCauTruc = z
  .array(z.object({ diem: zDiem, muc_do: z.enum(['de', 'tb', 'kho']).nullish().transform((v) => v ?? null) }))
  .min(1)
  .max(20);

const zChuoi = (max = 200) => z.string().trim().max(max).default('');
const schemaThongTin = z.object({
  truong: zChuoi(),
  dia_danh: zChuoi(50),
  hoc_phan: z.string().trim().min(1).max(200),
  ma_hoc_phan: zChuoi(50),
  nganh: zChuoi(),
  trinh_do: zChuoi(100),
  lop: zChuoi(100),
  lop_van_hoa: zChuoi(100),
  nam_hoc: zChuoi(20),
  hoc_ky: zChuoi(20),
  hinh_thuc: zChuoi(100),
  thoi_gian: z.number().int().min(5).max(600),
  ngay_thi: zChuoi(50),
  tai_lieu: z.boolean().default(false),
});

const schemaTaoDe = z.object({
  mon_id: zId,
  lop_id: zId.nullish().transform((v) => v ?? null),
  truong_id: zId.nullish().transform((v) => v ?? null),
  mau_de_id: zId,
  thong_tin: schemaThongTin,
  de: z
    .array(z.object({ cau: z.array(z.object({ cau_hoi_id: zId, diem: zDiem })).min(1).max(20) }))
    .min(1)
    .max(20),
});

// ---------------------------------------------------------------------------
// Sinh đề thi

export const deThiRouter = Router();

deThiRouter.get('/goi-y', (req, res) => {
  const q = z.object({ lopId: zQueryId, monId: zQueryId }).parse(req.query);
  res.json(goiYDeThi(q.lopId, q.monId));
});

deThiRouter.post('/xem-truoc', (req, res) => {
  const d = z.object({ mon_id: zId, so_de: z.number().int().min(1).max(20), cau_truc: zCauTruc }).parse(req.body);
  res.json(xemTruocDe(d.mon_id, d.so_de, d.cau_truc));
});

deThiRouter.get('/', (_req, res) => {
  res.json(dsDeThi());
});

deThiRouter.post('/', (req, res) => {
  const d = taoDeThi(schemaTaoDe.parse(req.body));
  res.status(201).json({ id: d.id, ten_file: d.ten_file });
});

deThiRouter.get('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const d = layDeThi(id);
  if (!d) throw khongTimThay('đề thi');
  res.json(d);
});

deThiRouter.get('/:id/tai', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const { tenFile, buffer } = fileDeThi(id);
  datHeaderTaiFile(res, tenFile, MIME_DOCX);
  res.send(buffer);
});

deThiRouter.delete('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  if (!layDeThi(id)) throw khongTimThay('đề thi');
  xoaDeThi(id);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Mẫu đề (file Word theo trường)

const schemaMauDe = z.object({
  ten: z.string().trim().min(1).max(200),
  truong_id: zId.nullish().transform((v) => v ?? null),
  cau_truc: z.array(zDiem).min(1).max(20).default([3, 3, 4]),
  thoi_gian: z.number().int().min(5).max(600).default(60),
});

// Form multipart gửi mọi trường dạng chuỗi
function tuForm(body: Record<string, unknown>) {
  let cauTruc: unknown;
  if (typeof body.cau_truc === 'string' && body.cau_truc) {
    try {
      cauTruc = JSON.parse(body.cau_truc);
    } catch {
      throw new LoiApp(400, 'Điểm các câu không hợp lệ');
    }
  }
  return {
    ten: body.ten,
    truong_id: body.truong_id ? Number(body.truong_id) : null,
    cau_truc: cauTruc,
    thoi_gian: body.thoi_gian ? Number(body.thoi_gian) : undefined,
  };
}

function kiemTraTruong(truongId: number | null | undefined) {
  if (truongId && !layTruong(truongId)) throw new LoiApp(400, 'Trường không tồn tại');
}

export const mauDeRouter = Router();

mauDeRouter.get('/', (_req, res) => {
  res.json({ mau: dsMauDe(), o_dien: CAC_O_DIEN });
});

// Tải mẫu mới lên (.docx hoặc .doc)
mauDeRouter.post(
  '/',
  upload.single('file'),
  bocAsync(async (req, res) => {
    if (!req.file) throw new LoiApp(400, 'Chưa chọn file Word');
    const d = schemaMauDe.parse(tuForm(req.body));
    kiemTraTruong(d.truong_id);
    const docx = await docFileWord(req.file.buffer, layTenFile(req));
    const { canh_bao } = kiemTraMau(docx);
    res.status(201).json({ ...taoMauDe(d, docx), canh_bao });
  }),
);

// Kiểm tra file trước khi tải lên (không lưu)
mauDeRouter.post(
  '/kiem-tra',
  upload.single('file'),
  bocAsync(async (req, res) => {
    if (!req.file) throw new LoiApp(400, 'Chưa chọn file Word');
    const docx = await docFileWord(req.file.buffer, layTenFile(req));
    res.json(kiemTraMau(docx));
  }),
);

function layMauTuThamSo(params: unknown) {
  const { id } = zIdThamSo.parse(params);
  const m = layMauDe(id);
  if (!m) throw khongTimThay('mẫu đề');
  return m;
}

mauDeRouter.put('/:id', (req, res) => {
  const m = layMauTuThamSo(req.params);
  const d = schemaMauDe.partial().parse(req.body);
  kiemTraTruong(d.truong_id);
  res.json(suaMauDe(m.id, d));
});

// Thay file Word của mẫu đã tải lên
mauDeRouter.put(
  '/:id/tep',
  upload.single('file'),
  bocAsync(async (req, res) => {
    const m = layMauTuThamSo(req.params);
    if (!req.file) throw new LoiApp(400, 'Chưa chọn file Word');
    const docx = await docFileWord(req.file.buffer, layTenFile(req));
    const { canh_bao } = kiemTraMau(docx);
    thayTepMau(m.id, docx);
    res.json({ ...layMauDe(m.id), canh_bao });
  }),
);

// Tải file mẫu về để sửa trong Word
mauDeRouter.get('/:id/tai', (req, res) => {
  const m = layMauTuThamSo(req.params);
  datHeaderTaiFile(res, `${m.ten.replace(/[\\/:*?"<>|]+/g, '-')}.docx`, MIME_DOCX);
  res.send(docTepMau(m));
});

mauDeRouter.delete('/:id', (req, res) => {
  const m = layMauTuThamSo(req.params);
  xoaMauDe(m.id);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// API key cho AI

export const aiRouter = Router();

aiRouter.get('/', (_req, res) => {
  res.json(trangThaiKhoa());
});

aiRouter.put(
  '/',
  bocAsync(async (req, res) => {
    const { khoa } = z
      .object({ khoa: z.string().trim().max(300).nullish().transform((v) => v || null) })
      .parse(req.body);
    if (khoa) await kiemTraKhoa(khoa); // chỉ lưu key gọi được
    ghiKhoaApi(khoa);
    res.json(trangThaiKhoa());
  }),
);
