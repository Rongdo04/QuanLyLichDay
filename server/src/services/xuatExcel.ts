import ExcelJS from 'exceljs';
import { dsBuoi, type Buoi } from '../repositories/buoi.js';
import { layCaiDat, type CaiDat } from '../repositories/caiDat.js';
import { dsLopThuan, type LopDayDu } from '../repositories/lop.js';
import { layTruong } from '../repositories/truong.js';
import { LoiApp } from '../utils/loi.js';
import { ngayTrongTenFile } from '../utils/chuoi.js';
import { thuCuaNgay } from '../utils/thu.js';
import { soBuoiTrongNgay, tienDcNgay, tinhLop } from './tinhTien.js';

// Xuất Excel theo đúng mẫu cũ (SPEC mục 8). Tiền giữ đơn vị nghìn đồng.

export const FONT: Partial<ExcelJS.Font> = { name: 'Times New Roman', size: 13 };
export const FONT_DAM: Partial<ExcelJS.Font> = { ...FONT, bold: true };
const VIEN_MANH: Partial<ExcelJS.Border> = { style: 'thin' };
export const VIEN: Partial<ExcelJS.Borders> = { top: VIEN_MANH, left: VIEN_MANH, bottom: VIEN_MANH, right: VIEN_MANH };
// Độ rộng cột A…K
const DO_RONG = [12.8, 12.8, 9.1, 9.1, 12.9, 11.5, 10.1, 10.3, 14.4, 9.1, 60];
const DONG_DAU = 5; // dòng dữ liệu đầu tiên

const TRAI: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle' };
const GIUA: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };

// 'YYYY-MM-DD' → Date (UTC 0h) để Excel nhận đúng ngày, không lệch múi giờ
export function ngaySangDate(ngay: string): Date {
  const [y, m, d] = ngay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function ghiO(
  ws: ExcelJS.Worksheet,
  diaChi: string,
  giaTri: ExcelJS.CellValue,
  canLe: Partial<ExcelJS.Alignment>,
  font: Partial<ExcelJS.Font> = FONT,
) {
  const o = ws.getCell(diaChi);
  o.value = giaTri;
  o.font = font;
  o.alignment = canLe;
  return o;
}

// Nội dung cột Ghi chú: địa điểm (chỉ ngày đã dạy) + ghi chú riêng của ngày
export function noiDungGhiChu(b: Buoi, tenDiaDiem: string | null): string | null {
  const phan: string[] = [];
  if (tenDiaDiem && soBuoiTrongNgay(b) > 0) phan.push(tenDiaDiem);
  if (b.ghi_chu) phan.push(b.ghi_chu);
  return phan.length ? phan.join(' - ') : null;
}

// Các dòng của khối thông tin (cột K)
export function khoiThongTin(lop: LopDayDu, caiDat: CaiDat): string[] {
  const dong: string[] = [];
  const diaDiem = lop.dia_diem_ten_day_du || lop.dia_diem_ten;
  if (diaDiem) dong.push(`Địa điểm: ${diaDiem}`);
  if (lop.ma_lop || lop.lop_van_hoa) {
    const phan = [lop.ma_lop, lop.lop_van_hoa ? `(Lớp văn hóa: ${lop.lop_van_hoa})` : null].filter(Boolean);
    dong.push(`Lớp: ${phan.join(' ')}`);
  }
  const keHoach = [lop.so_tiet && `${lop.so_tiet} tiết`, lop.so_buoi_ke_hoach && `${lop.so_buoi_ke_hoach} buổi`].filter(Boolean);
  dong.push(`Học phần: ${lop.hoc_phan}${keHoach.length ? ` (${keHoach.join(', ')})` : ''}`);
  if (lop.lich_phan_cong) dong.push(`Lịch phân công: ${lop.lich_phan_cong}`);
  dong.push(`Thời gian vào lớp: Sáng: ${caiDat.gio_sang} - Chiều: ${caiDat.gio_chieu}`);
  dong.push(`Giáo viên: :${caiDat.ma_gv} ${caiDat.ten_gv}: ${caiDat.sdt}`);
  return dong;
}

// Thêm một sheet cho một lớp
export function themSheetLop(wb: ExcelJS.Workbook, lop: LopDayDu, buoi: Buoi[], caiDat: CaiDat) {
  const ws = wb.addWorksheet(lop.ten_sheet, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });

  // Font Times New Roman 13 cho cả cột, ô gõ thêm sau này cũng đúng font
  ws.columns = DO_RONG.map((width) => ({ width, style: { font: FONT } }));

  const dsNgay = [...buoi].sort((a, b) => a.ngay.localeCompare(b.ngay));
  const last = Math.max(DONG_DAU, DONG_DAU + dsNgay.length - 1);

  // Dòng 1: A1:E1 gộp, để trống
  ws.getRow(1).height = 16.5;
  ws.mergeCells('A1:E1');

  // Tiêu đề (dòng 2–4)
  ws.mergeCells('A2:A4');
  ws.mergeCells('B2:B4');
  ws.mergeCells('C2:D2');
  ws.mergeCells('C3:C4');
  ws.mergeCells('D3:D4');
  ws.mergeCells('E2:E4');
  ws.mergeCells('F2:F4');
  ghiO(ws, 'A2', 'NGÀY', TRAI, FONT_DAM);
  ghiO(ws, 'B2', 'THỨ', GIUA, FONT_DAM);
  ghiO(ws, 'C2', 'Buổi', GIUA, FONT_DAM);
  ghiO(ws, 'C3', 'Sáng', GIUA, FONT_DAM);
  ghiO(ws, 'D3', 'Chiều', GIUA, FONT_DAM);
  ghiO(ws, 'E2', 'Ghi chú', TRAI, FONT_DAM);
  ghiO(ws, 'F2', 'Tiền DC', GIUA);
  ghiO(ws, 'G4', 'Tiền Dạy', TRAI);
  ghiO(ws, 'H4', 'Tổng', TRAI);

  // Dữ liệu từng ngày
  const tienDcDiaDiem = lop.tien_dc_dia_diem;
  dsNgay.forEach((b, i) => {
    const r = DONG_DAU + i;
    const oNgay = ghiO(ws, `A${r}`, ngaySangDate(b.ngay), TRAI);
    oNgay.numFmt = 'dd/mm/yyyy';
    ghiO(ws, `B${r}`, thuCuaNgay(b.ngay), TRAI);
    ghiO(ws, `C${r}`, b.sang ? 'x' : null, GIUA);
    ghiO(ws, `D${r}`, b.chieu ? 'x' : null, GIUA);
    ghiO(ws, `E${r}`, noiDungGhiChu(b, lop.dia_diem_ten), TRAI);
    const dc = tienDcNgay(b, tienDcDiaDiem);
    ghiO(ws, `F${r}`, dc > 0 ? dc : null, GIUA);
  });

  // Công thức tổng, kèm kết quả tính sẵn (mở bằng trình xem không tính lại vẫn đúng)
  const kq = tinhLop(lop, tienDcDiaDiem, dsNgay);
  const oTienDay = ghiO(
    ws,
    `G${DONG_DAU}`,
    { formula: `COUNTA(C${DONG_DAU}:D${last})*${lop.don_gia}`, result: kq.tienDay },
    GIUA,
  );
  oTienDay.numFmt = '#,##0';
  const oTong = ghiO(
    ws,
    `H${DONG_DAU}`,
    { formula: `SUM(F${DONG_DAU}:F${last},G${DONG_DAU})`, result: kq.tong },
    TRAI,
  );
  oTong.numFmt = '#,##0';

  // Viền mảnh vùng A1:F{last}
  for (let r = 1; r <= last; r++) {
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).border = VIEN;
  }

  // Khối thông tin ở cột K, bắt đầu từ K4
  khoiThongTin(lop, caiDat).forEach((dong, i) => {
    ghiO(ws, `K${4 + i}`, dong, TRAI);
  });

  return ws;
}

export interface TuyChonXuat {
  lopIds?: number[];
  tu?: string;
  den?: string;
}

export function tenFileTruong(maTruong: string, namHoc: string, tu?: string, den?: string): string {
  const ky = tu || den ? `_${tu ? ngayTrongTenFile(tu) : '...'}-${den ? ngayTrongTenFile(den) : '...'}` : '';
  return `THỐNG KÊ GIẢNG DẠY TRƯỜNG ${maTruong}_${namHoc}${ky}.xlsx`;
}

// Tạo workbook cho một trường: mỗi lớp một sheet, theo thứ tự thu_tu
export async function xuatFileTruong(truongId: number, tuyChon: TuyChonXuat = {}) {
  const truong = layTruong(truongId);
  if (!truong) throw new LoiApp(404, 'Không tìm thấy trường');
  let dsLop = dsLopThuan({ truongId });
  if (tuyChon.lopIds?.length) {
    const chon = new Set(tuyChon.lopIds);
    dsLop = dsLop.filter((l) => chon.has(l.id));
  }
  if (dsLop.length === 0) throw new LoiApp(400, 'Không có lớp nào để xuất');

  const caiDat = layCaiDat();
  const tatCaBuoi = dsBuoi({ truongId, tu: tuyChon.tu, den: tuyChon.den });
  const wb = new ExcelJS.Workbook();
  wb.creator = caiDat.ten_gv;
  wb.created = new Date();
  for (const lop of dsLop) {
    themSheetLop(
      wb,
      lop,
      tatCaBuoi.filter((b) => b.lop_id === lop.id),
      caiDat,
    );
  }
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { tenFile: tenFileTruong(truong.ma, caiDat.nam_hoc, tuyChon.tu, tuyChon.den), buffer };
}
