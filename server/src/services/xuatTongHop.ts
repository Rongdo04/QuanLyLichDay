import ExcelJS from 'exceljs';
import { layCaiDat } from '../repositories/caiDat.js';
import { LoiApp } from '../utils/loi.js';
import { ngayTrongTenFile } from '../utils/chuoi.js';
import { khoangNamHoc, thongKe, thongKeTheoThang } from './thongKe.js';
import { FONT, FONT_DAM, VIEN } from './xuatExcel.js';

// File tổng hợp (SPEC mục 8.4): sheet "Tổng hợp" và "Theo tháng". Đơn vị nghìn đồng.

const SO_TIEN = '#,##0';
const NEN_TIEU_DE: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEF7' } };

const dinhDangNgay = (ngay: string) => ngay.split('-').reverse().join('/');

function dongTieuDe(ws: ExcelJS.Worksheet, r: number, cot: string[]) {
  const row = ws.getRow(r);
  cot.forEach((ten, i) => {
    const o = row.getCell(i + 1);
    o.value = ten;
    o.font = FONT_DAM;
    o.fill = NEN_TIEU_DE;
    o.border = VIEN;
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 36;
}

function ghiChuDonVi(ws: ExcelJS.Worksheet, ky: string, tenGv: string) {
  ws.getCell('A1').value = 'Đơn vị: nghìn đồng';
  ws.getCell('A1').font = { ...FONT, italic: true };
  ws.getCell('A2').value = `Giáo viên: ${tenGv} — ${ky}`;
  ws.getCell('A2').font = FONT;
}

// Công thức SUM kèm kết quả; không có dòng dữ liệu thì ghi 0
function oTong(cot: string, tu: number, den: number, ketQua: number): ExcelJS.CellValue {
  return den >= tu ? { formula: `SUM(${cot}${tu}:${cot}${den})`, result: ketQua } : 0;
}

export async function xuatTongHop(loc: { tu?: string; den?: string } = {}) {
  const caiDat = layCaiDat();
  const namHoc = khoangNamHoc(caiDat.nam_hoc);
  const tu = loc.tu ?? namHoc.tu;
  const den = loc.den ?? namHoc.den;
  if (tu > den) throw new LoiApp(400, 'Khoảng ngày không hợp lệ');
  const ky = loc.tu || loc.den
    ? `Từ ${dinhDangNgay(tu)} đến ${dinhDangNgay(den)}`
    : `Năm học ${caiDat.nam_hoc} (${dinhDangNgay(tu)} – ${dinhDangNgay(den)})`;

  const wb = new ExcelJS.Workbook();
  wb.creator = caiDat.ten_gv;
  wb.created = new Date();

  // --- Sheet "Tổng hợp": mỗi lớp một dòng ---
  const ws = wb.addWorksheet('Tổng hợp', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [36, 26, 30, 11, 9, 10, 13, 11, 14].map((width) => ({ width, style: { font: FONT } }));
  ghiChuDonVi(ws, ky, caiDat.ten_gv);
  const COT = ['Trường', 'Lớp', 'Học phần', 'Số buổi KH', 'Đã dạy', 'Đơn giá', 'Tiền dạy', 'Tiền DC', 'Tổng'];
  dongTieuDe(ws, 4, COT);

  const tk = thongKe({ tu, den });
  let r = 5;
  for (const t of tk.truong) {
    for (const l of t.lop) {
      const row = ws.getRow(r++);
      row.values = [t.ten, l.ten_sheet, l.hoc_phan, l.so_buoi_ke_hoach, l.soBuoi, l.don_gia, l.tienDay, l.tienDc, l.tong];
    }
  }
  const dongCuoi = r - 1;
  const rowTong = ws.getRow(r);
  rowTong.getCell(1).value = 'Tổng cộng';
  rowTong.getCell(5).value = oTong('E', 5, dongCuoi, tk.tong.soBuoi);
  rowTong.getCell(7).value = oTong('G', 5, dongCuoi, tk.tong.tienDay);
  rowTong.getCell(8).value = oTong('H', 5, dongCuoi, tk.tong.tienDc);
  rowTong.getCell(9).value = oTong('I', 5, dongCuoi, tk.tong.tong);
  for (let rr = 5; rr <= r; rr++) {
    for (let c = 1; c <= COT.length; c++) {
      const o = ws.getCell(rr, c);
      o.border = VIEN;
      o.font = rr === r ? FONT_DAM : FONT;
      if (c >= 6) o.numFmt = SO_TIEN;
      o.alignment = { vertical: 'middle', horizontal: c >= 4 ? (c >= 6 ? 'right' : 'center') : 'left' };
    }
  }

  // --- Sheet "Theo tháng": tháng × trường, giá trị là tổng tiền ---
  const wt = wb.addWorksheet('Theo tháng', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const theoThang = thongKeTheoThang(tu, den);
  const soTruong = theoThang.truong.length;
  wt.columns = [14, ...theoThang.truong.map(() => 14), 15].map((width) => ({ width, style: { font: FONT } }));
  ghiChuDonVi(wt, ky, caiDat.ten_gv);
  dongTieuDe(wt, 4, ['Tháng', ...theoThang.truong.map((t) => t.ma), 'Tổng']);
  const cotTong = soTruong + 2;
  const tenCot = (c: number) => wt.getColumn(c).letter;

  let rt = 5;
  for (const th of theoThang.thang) {
    const row = wt.getRow(rt);
    row.getCell(1).value = th.nhan;
    theoThang.truong.forEach((t, i) => {
      const tien = th.theoTruong[t.id]?.tong ?? 0;
      row.getCell(i + 2).value = tien || null;
    });
    row.getCell(cotTong).value =
      soTruong > 0 ? { formula: `SUM(B${rt}:${tenCot(cotTong - 1)}${rt})`, result: th.tong.tong } : 0;
    rt++;
  }
  const dongCuoiT = rt - 1;
  const rowTongT = wt.getRow(rt);
  rowTongT.getCell(1).value = 'Tổng cộng';
  theoThang.truong.forEach((t, i) => {
    const tong = theoThang.thang.reduce((s, th) => s + (th.theoTruong[t.id]?.tong ?? 0), 0);
    rowTongT.getCell(i + 2).value = oTong(tenCot(i + 2), 5, dongCuoiT, tong);
  });
  rowTongT.getCell(cotTong).value = oTong(tenCot(cotTong), 5, dongCuoiT, theoThang.tong.tong);
  for (let rr = 5; rr <= rt; rr++) {
    for (let c = 1; c <= cotTong; c++) {
      const o = wt.getCell(rr, c);
      o.border = VIEN;
      o.font = rr === rt || c === cotTong ? FONT_DAM : FONT;
      o.alignment = { vertical: 'middle', horizontal: c === 1 ? 'center' : 'right' };
      if (c > 1) o.numFmt = SO_TIEN;
    }
  }

  const tenKy = loc.tu || loc.den ? `${ngayTrongTenFile(tu)}-${ngayTrongTenFile(den)}` : caiDat.nam_hoc;
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { tenFile: `TỔNG HỢP GIẢNG DẠY_${tenKy}.xlsx`, buffer };
}
