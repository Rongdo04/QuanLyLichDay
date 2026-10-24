import { Router } from 'express';
import { buoiCuaLop, taoNhieuBuoi } from '../repositories/buoi.js';
import { layCaiDat } from '../repositories/caiDat.js';
import { chiTietLop, dsLop, layLop, nhanBanLop, suaLop, taoLop, xoaLop } from '../repositories/lop.js';
import { sinhLichChiTiet, soBuoiDuKien, type DuKien } from '../services/sinhLich.js';
import { khongTimThay, LoiApp } from '../utils/loi.js';
import { z, zChuoiTuyChon, zId, zIdThamSo, zNgay, zQueryId, zTenSheet, zTrangThai } from '../utils/zod.js';

const zDuKien = z.enum(['S', 'C', 'SC']);

const schemaLop = z.object({
  truong_id: zId,
  dia_diem_id: zId.nullish().transform((v) => v ?? null),
  ten_sheet: zTenSheet,
  ma_lop: zChuoiTuyChon,
  lop_van_hoa: zChuoiTuyChon,
  hoc_phan: z.string().trim().min(1).max(200),
  so_buoi_ke_hoach: z.number().int().min(1).nullish().transform((v) => v ?? null),
  don_gia: z.number().int().min(0),
  lich_phan_cong: zChuoiTuyChon,
  ngay_bat_dau: zNgay.nullish().transform((v) => v ?? null),
  ngay_ket_thuc: zNgay.nullish().transform((v) => v ?? null),
  trang_thai: zTrangThai.default('dang_day'),
  thu_tu: z.number().int().min(0).optional(),
});

const schemaLocLop = z.object({
  truongId: zQueryId,
  trangThai: z.preprocess((v) => (v === '' ? undefined : v), zTrangThai.optional()),
});

const schemaSinhLich = z
  .object({
    batDau: zNgay,
    ketThuc: zNgay.nullish(),
    soBuoi: z.number().int().min(1).max(500).nullish(),
    thu: z.record(z.enum(['2', '3', '4', '5', '6', '7', '8']), zDuKien),
    boQuaNgayNghi: z.boolean().default(true),
  })
  .refine((d) => d.ketThuc || d.soBuoi, 'Cần nhập ngày kết thúc hoặc số buổi')
  .refine((d) => !d.ketThuc || d.ketThuc >= d.batDau, 'Ngày kết thúc phải sau ngày bắt đầu')
  .refine((d) => Object.keys(d.thu).length > 0, 'Cần chọn ít nhất một thứ trong tuần');

const schemaTaoLich = z.object({
  ngay: z.array(z.object({ ngay: zNgay, du_kien: zDuKien.nullish() })).min(1),
});

function layLopHoac404(id: number) {
  const lop = layLop(id);
  if (!lop) throw khongTimThay('lớp');
  return lop;
}

export const lopRouter = Router();

lopRouter.get('/', (req, res) => {
  res.json(dsLop(schemaLocLop.parse(req.query)));
});

lopRouter.post('/', (req, res) => {
  res.status(201).json(taoLop(schemaLop.parse(req.body)));
});

lopRouter.get('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const ct = chiTietLop(id);
  if (!ct) throw khongTimThay('lớp');
  res.json(ct);
});

lopRouter.put('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  layLopHoac404(id);
  res.json(suaLop(id, schemaLop.partial().parse(req.body)));
});

lopRouter.delete('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  layLopHoac404(id);
  xoaLop(id);
  res.status(204).end();
});

lopRouter.post('/:id/nhan-ban', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  layLopHoac404(id);
  const ghiDe = schemaLop.partial().parse(req.body ?? {});
  res.status(201).json(nhanBanLop(id, ghiDe));
});

lopRouter.post('/:id/sinh-lich/xem-truoc', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  layLopHoac404(id);
  const ts = schemaSinhLich.parse(req.body);
  const thu: Partial<Record<number, DuKien>> = {};
  for (const [k, v] of Object.entries(ts.thu)) thu[Number(k)] = v;
  let kq: ReturnType<typeof sinhLichChiTiet>;
  try {
    kq = sinhLichChiTiet({
      batDau: ts.batDau,
      ketThuc: ts.ketThuc,
      soBuoi: ts.soBuoi,
      thu,
      ngayNghi: ts.boQuaNgayNghi ? layCaiDat().ngay_nghi : [],
      ngayDaCo: buoiCuaLop(id).map((b) => b.ngay),
    });
  } catch (e) {
    throw new LoiApp(400, (e as Error).message);
  }
  res.json({
    ngay: kq.ngay,
    boQua: kq.boQua,
    soNgay: kq.ngay.length,
    tongBuoi: kq.ngay.reduce((s, d) => s + soBuoiDuKien(d.du_kien), 0),
  });
});

lopRouter.post('/:id/sinh-lich', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const lop = layLopHoac404(id);
  const { ngay } = schemaTaoLich.parse(req.body);
  const soMoi = taoNhieuBuoi(id, ngay);

  // Cập nhật ngày bắt đầu / kết thúc của lớp nếu khoảng mới rộng hơn
  const cacNgay = ngay.map((n) => n.ngay).sort();
  const capNhat: { ngay_bat_dau?: string; ngay_ket_thuc?: string } = {};
  if (!lop.ngay_bat_dau || cacNgay[0] < lop.ngay_bat_dau) capNhat.ngay_bat_dau = cacNgay[0];
  if (!lop.ngay_ket_thuc || cacNgay.at(-1)! > lop.ngay_ket_thuc) capNhat.ngay_ket_thuc = cacNgay.at(-1)!;
  suaLop(id, capNhat);

  res.status(201).json({ soMoi, boQua: ngay.length - soMoi });
});
