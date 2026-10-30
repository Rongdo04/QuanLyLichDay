import { Router } from 'express';
import { layDb } from '../db/connection.js';
import { buoiCuaLop, taoNhieuBuoi } from '../repositories/buoi.js';
import { layCaiDat } from '../repositories/caiDat.js';
import { chiTietLop, dongBoTrangThai, dsLop, layLop, nhanBanLop, suaLop, taoLop, xoaLop } from '../repositories/lop.js';
import { doiLichTheoMau, sinhLichChiTiet, soBuoiDuKien, type DuKien } from '../services/sinhLich.js';
import { khongTimThay, LoiApp } from '../utils/loi.js';
import { moTaThu, phanTichLichPhanCong, taoLichPhanCong } from '../utils/lichPhanCong.js';
import { z, zChuoiTuyChon, zCo, zId, zIdThamSo, zNgay, zQueryId, zTenSheet, zTrangThai } from '../utils/zod.js';

const zDuKien = z.enum(['S', 'C', 'SC']);
const zThu = z.enum(['2', '3', '4', '5', '6', '7', '8']);

// Lịch hằng tuần {"4":"C","7":"SC"} → lưu dạng chuỗi JSON; rỗng → null
const zLichTuan = z
  .record(zThu, zDuKien)
  .nullish()
  .transform((v) => (v && Object.keys(v).length ? JSON.stringify(v) : null));

const schemaLop = z.object({
  truong_id: zId,
  dia_diem_id: zId.nullish().transform((v) => v ?? null),
  ten_sheet: zTenSheet,
  ma_lop: zChuoiTuyChon,
  lop_van_hoa: zChuoiTuyChon,
  hoc_phan: z.string().trim().min(1).max(200),
  so_tiet: z.number().int().min(1).max(2000).nullish().transform((v) => v ?? null),
  so_buoi_ke_hoach: z.number().int().min(1).nullish().transform((v) => v ?? null),
  don_gia: z.number().int().min(0),
  tinh_theo: z.enum(['buoi', 'tiet']).optional(),
  tiet_moi_buoi: z.number().int().min(1).max(20).optional(),
  lich_phan_cong: zChuoiTuyChon,
  lich_tuan: zLichTuan,
  ngay_bat_dau: zNgay.nullish().transform((v) => v ?? null),
  ngay_ket_thuc: zNgay.nullish().transform((v) => v ?? null),
  trang_thai: zTrangThai.default('dang_day'),
  da_thanh_toan: zCo.optional(),
  ky_hoc_id: zId.nullish(), // không gửi: tự xếp theo ngày bắt đầu; null: chưa xếp kỳ
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
    thu: z.record(zThu, zDuKien),
    boQuaNgayNghi: z.boolean().default(true),
  })
  .refine((d) => d.ketThuc || d.soBuoi, 'Cần nhập ngày kết thúc hoặc số buổi')
  .refine((d) => !d.ketThuc || d.ketThuc >= d.batDau, 'Ngày kết thúc phải sau ngày bắt đầu')
  .refine((d) => Object.keys(d.thu).length > 0, 'Cần chọn ít nhất một thứ trong tuần');

const schemaTaoLich = z.object({
  ngay: z.array(z.object({ ngay: zNgay, du_kien: zDuKien.nullish() })).min(1),
});

function docLichTuan(json: string): Partial<Record<number, DuKien>> {
  const thu: Partial<Record<number, DuKien>> = {};
  for (const [k, v] of Object.entries(JSON.parse(json) as Record<string, DuKien>)) thu[Number(k)] = v;
  return thu;
}

function layLopHoac404(id: number) {
  const lop = layLop(id);
  if (!lop) throw khongTimThay('lớp');
  return lop;
}

export const lopRouter = Router();

lopRouter.get('/', (req, res) => {
  res.json(dsLop(schemaLocLop.parse(req.query)));
});

// Tạo lớp; có lịch hằng tuần thì tự sinh các ngày dạy từ ngày bắt đầu đến ngày kết thúc (hoặc đủ số buổi kế hoạch)
const schemaTaoLop = schemaLop.extend({
  tu_sinh_lich: z.boolean().default(true),
  bo_qua_ngay_nghi: z.boolean().default(true),
});

lopRouter.post('/', (req, res) => {
  const { tu_sinh_lich, bo_qua_ngay_nghi, ...d } = schemaTaoLop.parse(req.body);
  if (!tu_sinh_lich || !d.lich_tuan) {
    res.status(201).json({ ...taoLop(d), so_ngay_sinh: 0 });
    return;
  }
  if (!d.ngay_bat_dau) throw new LoiApp(400, 'Để tự sinh lịch, cần nhập ngày bắt đầu');
  if (!d.ngay_ket_thuc && !d.so_buoi_ke_hoach)
    throw new LoiApp(400, 'Để tự sinh lịch, cần nhập ngày kết thúc hoặc số buổi kế hoạch');
  if (d.ngay_ket_thuc && d.ngay_ket_thuc < d.ngay_bat_dau) throw new LoiApp(400, 'Ngày kết thúc phải sau ngày bắt đầu');

  const thu = docLichTuan(d.lich_tuan);
  const { ngay, boQua } = sinhLichChiTiet({
    batDau: d.ngay_bat_dau,
    ketThuc: d.ngay_ket_thuc,
    soBuoi: d.so_buoi_ke_hoach, // có cả hai thì dừng ở mốc đến trước
    thu,
    ngayNghi: bo_qua_ngay_nghi ? layCaiDat().ngay_nghi : [],
  });
  const kq = layDb().transaction(() => {
    const lop = taoLop({
      ...d,
      lich_phan_cong: d.lich_phan_cong ?? (ngay.length ? taoLichPhanCong(thu, ngay[0]) : moTaThu(thu)),
      ngay_ket_thuc: d.ngay_ket_thuc ?? ngay.at(-1)?.ngay ?? null,
    });
    taoNhieuBuoi(lop.id, ngay);
    return layLop(lop.id)!;
  })();
  res.status(201).json({ ...kq, so_ngay_sinh: ngay.length, ngay_bo_qua: boQua });
});

lopRouter.get('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const ct = chiTietLop(id);
  if (!ct) throw khongTimThay('lớp');
  res.json(ct);
});

const schemaSuaLop = schemaLop
  .partial()
  .extend({ dong_bo_lich: z.boolean().default(false), keo_dai_lich: z.boolean().default(false) });

const cungThu = (a: Partial<Record<number, DuKien>>, b: Partial<Record<number, DuKien>>) =>
  [2, 3, 4, 5, 6, 7, 8].every((t) => (a[t] ?? null) === (b[t] ?? null));

// Sửa lớp; dong_bo_lich = true thì đổi các ngày đã có cho khớp lịch tuần / ngày bắt đầu, kết thúc mới:
// thêm ngày mới, xóa ngày chưa chấm không còn đúng lịch, giữ nguyên ngày đã chấm, giữ ngày kết thúc làm buổi cuối.
// keo_dai_lich = true: đến ngày kết thúc chưa đủ số buổi kế hoạch thì sinh tiếp đến khi đủ (dời ngày kết thúc)
lopRouter.put('/:id', (req, res) => {
  const { id } = zIdThamSo.parse(req.params);
  const cu = layLopHoac404(id);
  const { dong_bo_lich, keo_dai_lich, ...d } = schemaSuaLop.parse(req.body);
  // Đổi số buổi kế hoạch (không đổi tay trạng thái) → lớp đã chấm đủ thì tự chuyển "hoàn thành"
  const doiKeHoach =
    d.so_buoi_ke_hoach !== undefined &&
    d.so_buoi_ke_hoach !== cu.so_buoi_ke_hoach &&
    (d.trang_thai ?? cu.trang_thai) === cu.trang_thai;
  if (!dong_bo_lich) {
    suaLop(id, d);
    if (doiKeHoach) dongBoTrangThai(id);
    res.json(layLop(id));
    return;
  }
  const lichTuan = d.lich_tuan !== undefined ? d.lich_tuan : cu.lich_tuan;
  const batDau = d.ngay_bat_dau !== undefined ? d.ngay_bat_dau : cu.ngay_bat_dau;
  const ketThuc = d.ngay_ket_thuc !== undefined ? d.ngay_ket_thuc : cu.ngay_ket_thuc;
  const soTiet = d.so_tiet !== undefined ? d.so_tiet : cu.so_tiet;
  const soBuoi =
    (d.so_buoi_ke_hoach !== undefined ? d.so_buoi_ke_hoach : cu.so_buoi_ke_hoach) ??
    (soTiet ? Math.ceil(soTiet / (d.tiet_moi_buoi ?? cu.tiet_moi_buoi)) : null);
  if (!lichTuan) throw new LoiApp(400, 'Để cập nhật lịch, cần chọn thứ dạy trong tuần');
  if (!batDau) throw new LoiApp(400, 'Để cập nhật lịch, cần nhập ngày bắt đầu');
  if (!ketThuc && !soBuoi) throw new LoiApp(400, 'Để cập nhật lịch, cần nhập ngày kết thúc hoặc số buổi kế hoạch');
  if (ketThuc && ketThuc < batDau) throw new LoiApp(400, 'Ngày kết thúc phải sau ngày bắt đầu');

  const thu = docLichTuan(lichTuan);
  const kq = doiLichTheoMau(
    { batDau, ketThuc, soBuoi, thu, ngayNghi: layCaiDat().ngay_nghi, keoDai: keo_dai_lich },
    buoiCuaLop(id),
  );
  // "Lịch phân công" đang mô tả đúng lịch cũ (tự viết) và không bị sửa tay → viết lại theo lịch mới
  const lpcCu = d.lich_phan_cong !== undefined ? d.lich_phan_cong : cu.lich_phan_cong;
  const thuCu = cu.lich_tuan ? docLichTuan(cu.lich_tuan) : phanTichLichPhanCong(cu.lich_phan_cong).thu;
  const tuViet = !lpcCu || (lpcCu === cu.lich_phan_cong && cungThu(phanTichLichPhanCong(lpcCu).thu, thuCu));

  const db = layDb();
  const lop = db.transaction(() => {
    const xoaBuoi = db.prepare('DELETE FROM buoi WHERE id = ?');
    for (const b of kq.xoa) xoaBuoi.run(b.id);
    const doiDuKien = db.prepare('UPDATE buoi SET du_kien = ? WHERE id = ?');
    for (const b of kq.doiDuKien) doiDuKien.run(b.du_kien, b.id);
    taoNhieuBuoi(id, kq.them);
    suaLop(id, {
      ...d,
      ...(tuViet ? { lich_phan_cong: kq.lich.length ? taoLichPhanCong(thu, kq.lich[0]) : moTaThu(thu) } : {}),
      ngay_ket_thuc: (keo_dai_lich ? kq.ketThuc : ketThuc) ?? kq.ketThuc,
    });
    if (doiKeHoach) dongBoTrangThai(id);
    return layLop(id)!;
  })();
  res.json({
    ...lop,
    doi_lich: {
      them: kq.them.length,
      xoa: kq.xoa.length,
      doi_du_kien: kq.doiDuKien.length,
      giu_da_cham: kq.giuDaCham.length,
      tong_buoi: kq.tongBuoi,
      thieu: kq.thieu,
    },
  });
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
