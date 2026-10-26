import { Router } from 'express';
import { layDb } from '../db/connection.js';
import { phanTichFile, xacNhanNhap } from '../services/nhapExcel.js';
import { bocAsync, LoiApp } from '../utils/loi.js';
import { layTenFile, upload } from '../utils/taiLen.js';
import { z, zChuoiTuyChon, zId, zNgay, zTenSheet, zTrangThai } from '../utils/zod.js';

const zDongNhap = z.object({
  ngay: zNgay,
  sang: z.boolean(),
  chieu: z.boolean(),
  ghi_chu_goc: z.string().max(500).nullish().transform((v) => v ?? null),
});

const zSheetXacNhan = z.object({
  ten_sheet: zTenSheet,
  hoc_phan: z.string().trim().min(1).max(200),
  ma_lop: zChuoiTuyChon,
  lop_van_hoa: zChuoiTuyChon,
  so_tiet: z.number().int().min(1).max(2000).nullish().transform((v) => v ?? null),
  so_buoi_ke_hoach: z.number().int().min(1).nullish().transform((v) => v ?? null),
  don_gia: z.number().int().min(0),
  tinh_theo: z.enum(['buoi', 'tiet']).default('buoi'),
  tiet_moi_buoi: z.number().int().min(1).max(20).nullish().transform((v) => v ?? null),
  lich_phan_cong: zChuoiTuyChon,
  trang_thai: zTrangThai.default('dang_day'),
  dia_diem_id: zId.nullish().transform((v) => v ?? null),
  dia_diem_moi: z
    .object({ ten_ngan: z.string().trim().min(1).max(50), ten_day_du: zChuoiTuyChon })
    .nullish()
    .transform((v) => v ?? null),
  dia_diem_goi_y: zChuoiTuyChon,
  xu_ly_trung: z.enum(['bo_qua', 'ghi_de', 'tao_moi']).nullish().transform((v) => v ?? null),
  buoi: z.array(zDongNhap),
});

const schemaXacNhan = z.object({
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'Mã file không hợp lệ'),
  ten_file: z.string().trim().min(1).max(300),
  truong_id: zId,
  sheets: z.array(zSheetXacNhan).min(1, 'Chưa chọn sheet nào để nhập'),
});

export const nhapRouter = Router();

nhapRouter.post(
  '/xem-truoc',
  upload.single('file'),
  bocAsync(async (req, res) => {
    if (!req.file) throw new LoiApp(400, 'Chưa chọn file Excel');
    const tenFile = layTenFile(req);
    if (/\.xls$/i.test(tenFile))
      throw new LoiApp(400, 'File .xls (Excel 97-2003) chưa hỗ trợ. Hãy mở bằng Excel rồi "Lưu thành" dạng .xlsx');
    if (!/\.xlsx$/i.test(tenFile)) throw new LoiApp(400, 'Chỉ nhận file Excel dạng .xlsx');
    res.json(await phanTichFile(req.file.buffer, tenFile));
  }),
);

nhapRouter.post('/xac-nhan', (req, res) => {
  res.status(201).json(xacNhanNhap(schemaXacNhan.parse(req.body)));
});

nhapRouter.get('/lich-su', (_req, res) => {
  res.json(
    layDb()
      .prepare(
        `SELECT n.*, t.ma AS truong_ma FROM nhap_file n
         LEFT JOIN truong t ON t.id = n.truong_id ORDER BY n.id DESC LIMIT 50`,
      )
      .all(),
  );
});
