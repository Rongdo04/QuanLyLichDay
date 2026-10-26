import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { taoApp } from '../src/app.js';
import { datDb, moDb } from '../src/db/connection.js';
import { chiTietLop, dsLop } from '../src/repositories/lop.js';
import {
  docCongThucGia,
  docDonGia,
  goiYTruongTuTenFile,
  phanTichFile,
  tachGhiChu,
  timTruongTheoGoiY,
  xacNhanNhap,
  type KetQuaPhanTich,
  type SheetNhap,
} from '../src/services/nhapExcel.js';

// Các file Excel thật nằm cạnh thư mục dự án (D:\Các Trường\...). Không có thì bỏ qua test.
const THU_MUC =
  process.env.THU_MUC_FILE_CU ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FILE = {
  GTVT: path.join(THU_MUC, 'Trường TC GTVT', 'THỐNG KÊ GỜ GIẢNG TRƯỜNG TCGTVT- 2026-2027.xlsx'),
  GTCT: path.join(THU_MUC, 'Giao thông công chính', 'THỐNG KÊ GỜ GIẢNG TRƯỜNG GTCT 2026-2027.xlsx'),
  DANGANH: path.join(THU_MUC, 'TC Đa Ngành', 'THỐNG KÊ GỜ GIẢNG TRƯỜNG TC Đa Ngành 2026-2027.xlsx'),
  HN: path.join(THU_MUC, 'Trung Cấp Hà Nội', 'THỐNG KÊ GỜ GIẢNG TRƯỜNG TCHN- 2026-2027.xlsx'),
};
const coFile = Object.values(FILE).every((f) => fs.existsSync(f));

async function docFile(f: string) {
  return phanTichFile(fs.readFileSync(f), path.basename(f));
}

// Chuyển kết quả phân tích thành dữ liệu xác nhận (giữ nguyên gợi ý)
function xacNhanTuPhanTich(kq: KetQuaPhanTich, truongId: number, xuLy: 'bo_qua' | 'ghi_de' | 'tao_moi' | null = null) {
  return xacNhanNhap({
    hash: kq.hash,
    ten_file: kq.ten_file,
    truong_id: truongId,
    sheets: kq.sheets.map((s: SheetNhap) => ({
      ten_sheet: s.ten_sheet,
      hoc_phan: s.hoc_phan,
      ma_lop: s.ma_lop,
      lop_van_hoa: s.lop_van_hoa,
      so_tiet: s.so_tiet,
      so_buoi_ke_hoach: s.so_buoi_ke_hoach,
      don_gia: s.don_gia!,
      tinh_theo: s.tinh_theo,
      tiet_moi_buoi: s.tiet_moi_buoi,
      lich_phan_cong: s.lich_phan_cong,
      trang_thai: s.trang_thai,
      dia_diem_id: s.dia_diem_id,
      dia_diem_moi: null,
      dia_diem_goi_y: s.dia_diem_goi_y,
      xu_ly_trung: xuLy,
      buoi: s.buoi,
    })),
  });
}

beforeEach(() => {
  datDb(moDb(':memory:'));
});

describe('nhapExcel - hàm nhỏ', () => {
  it('đọc đơn giá từ công thức', () => {
    expect(docDonGia('COUNTA(C5:D110)*450')).toBe(450);
    expect(docDonGia('=COUNTA(C5:D14)* 380 ')).toBe(380);
    expect(docDonGia('SUM(F5:F67,G5)')).toBeNull();
    expect(docCongThucGia('COUNTA(C5:D14)*380')).toEqual({ don_gia: 380, tinh_theo: 'buoi', tiet_moi_buoi: null });
    expect(docCongThucGia('=COUNTA(C5:D14)*5*80')).toEqual({ don_gia: 80, tinh_theo: 'tiet', tiet_moi_buoi: 5 });
  });

  it('gợi ý trường từ tên file', () => {
    expect(goiYTruongTuTenFile('THỐNG KÊ GỜ GIẢNG TRƯỜNG GTCT 2026-2027.xlsx')).toBe('GTCT');
    expect(goiYTruongTuTenFile('THỐNG KÊ GỜ GIẢNG TRƯỜNG TCHN- 2026-2027.xlsx')).toBe('TCHN');
    expect(goiYTruongTuTenFile('THỐNG KÊ GỜ GIẢNG TRƯỜNG TC Đa Ngành 2026-2027.xlsx')).toBe('TC Đa Ngành');
    expect(goiYTruongTuTenFile('THỐNG KÊ GIẢNG DẠY TRƯỜNG GTCT_2026-2027.xlsx')).toBe('GTCT');
    expect(goiYTruongTuTenFile('Book1.xlsx')).toBeNull();
    expect(timTruongTheoGoiY('GTCT')).toBe(1);
    expect(timTruongTheoGoiY('TCGTVT')).toBe(2);
    expect(timTruongTheoGoiY('TC Đa Ngành')).toBe(3);
    expect(timTruongTheoGoiY('TCHN')).toBe(4);
    expect(timTruongTheoGoiY('XYZ')).toBeNull();
  });

  it('tách ghi chú khỏi tên địa điểm', () => {
    expect(tachGhiChu('Thạch Thất', 'Thạch Thất')).toBeNull();
    expect(tachGhiChu('Thạch Thất - dạy bù', 'Thạch Thất')).toBe('dạy bù');
    expect(tachGhiChu('Nghỉ lễ', 'Thạch Thất')).toBe('Nghỉ lễ');
    expect(tachGhiChu('Xuân Mai', null)).toBe('Xuân Mai');
  });
});

describe.skipIf(!coFile)('nhapExcel - 4 file thật', () => {
  it('số liệu đọc được khớp bảng mục 14', async () => {
    const ketQua = {
      GTVT: await docFile(FILE.GTVT),
      GTCT: await docFile(FILE.GTCT),
      DANGANH: await docFile(FILE.DANGANH),
      HN: await docFile(FILE.HN),
    };
    const bang = Object.entries(ketQua).flatMap(([file, kq]) =>
      kq.sheets.map((s) => [file, s.ten_sheet_goc, s.so_ngay, s.so_buoi, s.don_gia, s.dia_diem_goi_y]),
    );
    expect(bang).toEqual([
      ['GTVT', 'TinHọcVPNC', 5, 2, 350, null],
      ['GTCT', 'Quản trị mạng', 10, 9, 380, 'Xuân Mai'],
      ['DANGANH', 'Quản trị mạng_AK', 9, 7, 450, null],
      ['DANGANH', 'Mạng Máy tính_Thanh Trì', 12, 0, 450, null],
      ['HN', 'AutoCad_TT(done)', 10, 15, 400, 'Thạch Thất'],
      ['HN', 'Thiết kế Web_TT', 12, 0, 400, 'Thạch Thất'],
      ['HN', 'Tin Học_TT', 9, 0, 400, 'Thạch Thất'],
    ]);

    // Gợi ý trường
    expect(Object.values(ketQua).map((k) => [k.goi_y_truong, k.truong_id])).toEqual([
      ['TCGTVT', 2],
      ['GTCT', 1],
      ['TC Đa Ngành', 3],
      ['TCHN', 4],
    ]);

    // Thông tin chi tiết các sheet TCHN
    const [autoCad, web, tinHoc] = ketQua.HN.sheets;
    expect(autoCad).toMatchObject({
      ten_sheet: 'AutoCad_TT',
      trang_thai: 'hoan_thanh',
      ma_lop: 'CT.10T1',
      lop_van_hoa: '11A6',
      hoc_phan: 'Vẽ kỹ thuật và Autocad',
      so_buoi_ke_hoach: 15,
      dia_diem_id: 1,
      dia_diem_ten_day_du: 'Trung tâm GDNN-GDTX Thạch Thất - Cơ sở 2',
      canh_bao: [],
    });
    expect(autoCad.buoi[0]).toEqual({ ngay: '2026-09-23', sang: false, chieu: true, ghi_chu_goc: 'Thạch Thất' });
    expect(web).toMatchObject({
      ten_sheet: 'Thiết kế Web_TT',
      trang_thai: 'dang_day',
      hoc_phan: 'Thiết kế Web',
      so_buoi_ke_hoach: 18,
      lich_phan_cong: 'Chiều T4 và ngày T7. Bắt đầu từ chiều thứ 4 28/10/2026',
    });
    expect(tinHoc).toMatchObject({ ma_lop: 'CT.11T1', lop_van_hoa: '10A8', hoc_phan: 'Tin học', so_buoi_ke_hoach: 9 });
    expect(ketQua.GTCT.sheets[0]).toMatchObject({ dia_diem_id: 3, canh_bao: expect.any(Array) });
  });

  it('xác nhận nhập: tính tiền đúng, ghi chú không lặp tên địa điểm', async () => {
    const kq = await docFile(FILE.HN);
    const r = xacNhanTuPhanTich(kq, 4);
    expect(r).toMatchObject({ tao_moi: 3, ghi_de: 0, bo_qua: 0, so_ngay: 31 });

    const ds = dsLop({ truongId: 4 });
    const autoCad = ds.find((l) => l.ten_sheet === 'AutoCad_TT')!;
    expect(autoCad).toMatchObject({ tienDay: 6000, tienDc: 660, tong: 6660, trang_thai: 'hoan_thanh' });
    const ct = chiTietLop(autoCad.id)!;
    expect(ct.buoi.every((b) => b.ghi_chu === null)).toBe(true);
    expect(ct.ngay_bat_dau).toBe('2026-09-23');
    expect(ct.ngay_ket_thuc).toBe('2026-10-24');

    const gtct = await docFile(FILE.GTCT);
    xacNhanTuPhanTich(gtct, 1);
    const qtm = dsLop({ truongId: 1 })[0];
    expect(qtm).toMatchObject({ ten_sheet: 'Quản trị mạng', don_gia: 380, dia_diem_ten: 'Xuân Mai', tienDay: 9 * 380, tienDc: 0 });
  });

  it('phát hiện file đã nhập và xử lý sheet trùng', async () => {
    const kq = await docFile(FILE.HN);
    expect(kq.da_nhap).toEqual([]);
    xacNhanTuPhanTich(kq, 4);

    const lan2 = await docFile(FILE.HN);
    expect(lan2.da_nhap).toHaveLength(1);
    expect(lan2.da_nhap[0].ten_file).toBe('THỐNG KÊ GỜ GIẢNG TRƯỜNG TCHN- 2026-2027.xlsx');

    expect(xacNhanTuPhanTich(lan2, 4, 'bo_qua')).toMatchObject({ tao_moi: 0, bo_qua: 3 });
    expect(xacNhanTuPhanTich(lan2, 4, 'ghi_de')).toMatchObject({ ghi_de: 3 });
    expect(dsLop({ truongId: 4 })).toHaveLength(3);
    const taoMoi = xacNhanTuPhanTich(lan2, 4, 'tao_moi');
    expect(taoMoi.lop.map((l) => l.ten_sheet)).toEqual(['AutoCad_TT_2', 'Thiết kế Web_TT_2', 'Tin Học_TT_2']);
    expect(dsLop({ truongId: 4 })).toHaveLength(6);
  });

  it('API: tải file lên (tên file tiếng Việt), xem trước rồi xác nhận', async () => {
    const app = taoApp({ boQuaDangNhap: true });
    const buffer = fs.readFileSync(FILE.DANGANH);
    const ten = path.basename(FILE.DANGANH);

    // Không gửi kèm ten_file: server tự sửa tên file do multer giải mã
    const r1 = await request(app).post('/api/nhap/xem-truoc').attach('file', buffer, ten).expect(200);
    expect(r1.body.ten_file).toBe(ten.normalize('NFC'));
    expect(r1.body.truong_id).toBe(3);

    // Gửi kèm ten_file
    const r2 = await request(app)
      .post('/api/nhap/xem-truoc')
      .field('ten_file', ten)
      .attach('file', buffer, 'x.xlsx')
      .expect(200);
    expect(r2.body.goi_y_truong).toBe('TC Đa Ngành');

    const sheets = r2.body.sheets.map((s: SheetNhap) => ({ ...s, xu_ly_trung: null, dia_diem_moi: null }));
    const xn = await request(app)
      .post('/api/nhap/xac-nhan')
      .send({ hash: r2.body.hash, ten_file: ten, truong_id: 3, sheets })
      .expect(201);
    expect(xn.body).toMatchObject({ tao_moi: 2, so_ngay: 21 });

    const ls = await request(app).get('/api/nhap/lich-su').expect(200);
    expect(ls.body[0]).toMatchObject({ ten_file: ten, truong_ma: 'DANGANH', so_lop: 2 });

    // Thiếu đơn giá → lỗi có số thứ tự sheet
    const loi = await request(app)
      .post('/api/nhap/xac-nhan')
      .send({ hash: r2.body.hash, ten_file: ten, truong_id: 3, sheets: [{ ...sheets[0], don_gia: null }] })
      .expect(400);
    expect(loi.body.loi).toBe('Sheet 1: Thiếu Đơn giá');
  });
});

describe('nhapExcel - lỗi', () => {
  it('file không phải xlsx', async () => {
    const app = taoApp({ boQuaDangNhap: true });
    const r = await request(app).post('/api/nhap/xem-truoc').attach('file', Buffer.from('abc'), 'a.xls').expect(400);
    expect(r.body.loi).toContain('.xls');
    const r2 = await request(app).post('/api/nhap/xem-truoc').attach('file', Buffer.from('abc'), 'a.xlsx').expect(400);
    expect(r2.body.loi).toContain('Không đọc được file Excel');
    const r3 = await request(app).post('/api/nhap/xem-truoc').expect(400);
    expect(r3.body.loi).toBe('Chưa chọn file Excel');
  });
});
