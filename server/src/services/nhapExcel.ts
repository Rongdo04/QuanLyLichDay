import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { layDb } from '../db/connection.js';
import { chenBuoiNhap, xoaBuoiCuaLop } from '../repositories/buoi.js';
import { dsDiaDiem, taoDiaDiem, timDiaDiemTheoTen } from '../repositories/diaDiem.js';
import { suaLop, taoLop, tenSheetMoi, timLopTheoTenSheet } from '../repositories/lop.js';
import { dsTruong, layTruong } from '../repositories/truong.js';
import { khoaSoKhop } from '../utils/chuoi.js';
import { LoiApp } from '../utils/loi.js';

// Nhập dữ liệu từ các file Excel thống kê cũ (SPEC mục 9)

export interface DongNhap {
  ngay: string;
  sang: boolean;
  chieu: boolean;
  ghi_chu_goc: string | null; // nội dung cột E nguyên bản
}

export interface SheetNhap {
  ten_sheet_goc: string;
  ten_sheet: string;
  trang_thai: 'dang_day' | 'hoan_thanh';
  hoc_phan: string;
  ma_lop: string | null;
  lop_van_hoa: string | null;
  so_buoi_ke_hoach: number | null;
  don_gia: number | null;
  lich_phan_cong: string | null;
  dia_diem_goi_y: string | null;      // giá trị cột E phổ biến nhất (tên địa điểm)
  dia_diem_ten_day_du: string | null; // từ dòng "Địa điểm: …"
  dia_diem_id: number | null;         // khớp được với bảng dia_diem
  buoi: DongNhap[];
  so_ngay: number;
  so_buoi: number;
  canh_bao: string[];
}

export interface KetQuaPhanTich {
  hash: string;
  ten_file: string;
  goi_y_truong: string | null;
  truong_id: number | null;
  da_nhap: { ten_file: string; nhap_luc: string }[];
  sheets: SheetNhap[];
  bo_qua: { ten_sheet: string; ly_do: string }[];
}

const chuan = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

// Lấy giá trị thật của ô: kết quả công thức, rich text, hyperlink…
function giaTriO(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== 'object') return v;
  if ('result' in v) return giaTriO(v.result as ExcelJS.CellValue);
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('text' in v) return giaTriO(v.text as ExcelJS.CellValue);
  if ('formula' in v || 'sharedFormula' in v) return null;
  return null;
}

function vanBanThoO(v: ExcelJS.CellValue): string {
  const g = giaTriO(v);
  if (g === null || g === undefined) return '';
  if (g instanceof Date) return g.toISOString().slice(0, 10);
  return String(g);
}

const vanBanO = (v: ExcelJS.CellValue) => chuan(vanBanThoO(v));

// Một ô có thể chứa cả khối thông tin: nhiều dòng (Alt+Enter), hoặc một dòng dài nối nhau
// "Học phần: … Lớp: … Lịch phân công: …" → tách trước mỗi nhãn đã biết (phân biệt hoa thường)
const RE_TRUOC_NHAN = /\s+(?=(?:Học phần|Lớp|Lịch phân công|Địa điểm|Thời gian[^:]*|Giáo viên)\s*:)/u;
const cacDongTrongO = (v: ExcelJS.CellValue) =>
  vanBanThoO(v)
    .normalize('NFC')
    .split(/\r?\n/)
    .flatMap((dong) => dong.split(RE_TRUOC_NHAN))
    .map(chuan)
    .filter(Boolean);

const pad = (n: number) => String(n).padStart(2, '0');

// Đọc ô ngày: Date, số serial Excel hoặc chuỗi dd/mm/yyyy
export function docNgay(v: ExcelJS.CellValue): string | null {
  const g = giaTriO(v);
  let d: Date | null = null;
  if (g instanceof Date) d = g;
  else if (typeof g === 'number' && g > 36526 && g < 73051) {
    d = new Date(Math.round((g - 25569) * 86400000));
  } else if (typeof g === 'string') {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(g.trim());
    if (m) d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  // exceljs tạo Date theo UTC; làm tròn về 0h để tránh sai số dấu phẩy động
  const t = new Date(Math.round(d.getTime() / 86400000) * 86400000);
  const y = t.getUTCFullYear();
  if (y < 2000 || y > 2100) return null;
  return `${y}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// Đơn giá từ công thức "=COUNTA(C5:D14)*380"
export function docDonGia(congThuc: string | undefined | null): number | null {
  if (!congThuc) return null;
  const m = /\*\s*(\d+)\s*$/.exec(congThuc.trim());
  return m ? Number(m[1]) : null;
}

// "TRƯỜNG GTCT 2026-2027" → "GTCT"; "TRƯỜNG TCHN- 2026-2027" → "TCHN"
export function goiYTruongTuTenFile(tenFile: string): string | null {
  const m = /TRƯỜNG\s+(.+?)[-_ ]*_?\d{4}/iu.exec(tenFile.normalize('NFC'));
  return m ? m[1].trim() : null;
}

// Khớp chuỗi gợi ý với trường đã có: so mã (bỏ tiền tố "TC"), rồi so đuôi tên trường
export function timTruongTheoGoiY(goiY: string | null): number | null {
  if (!goiY) return null;
  const k = khoaSoKhop(goiY);
  const ungVien = [...new Set([k, k.replace(/^TRUONG/, ''), k.replace(/^TRUNGCAP/, ''), k.replace(/^TC/, '')])].filter(
    (s) => s.length >= 2,
  );
  const ds = dsTruong();
  for (const u of ungVien) {
    const t = ds.find((t) => khoaSoKhop(t.ma) === u);
    if (t) return t.id;
  }
  for (const u of ungVien.filter((s) => s.length >= 4)) {
    const t = ds.find((t) => khoaSoKhop(t.ten).endsWith(u));
    if (t) return t.id;
  }
  return null;
}

const RE_LOP = /^Lớp\s*:\s*(.*)$/iu;
const RE_VAN_HOA = /\(\s*Lớp\s+văn\s+h(?:óa|oá)\s*:\s*([^)]*)\)/iu;
const RE_HOC_PHAN = /^Học\s+phần\s*:\s*(.*)$/iu;
const RE_SO_BUOI = /\(\s*(\d+)\s*buổi\s*\)\s*$/iu;
const RE_DIA_DIEM = /^Địa\s+điểm\s*:\s*(.*)$/iu;
const RE_LICH = /^Lịch\s+phân\s+công\s*:\s*(.*)$/iu;
const RE_DONE = /\(\s*done\s*\)/iu; // không dùng cờ g: .test() với cờ g giữ lastIndex giữa các lần gọi

export function phanTichSheet(ws: ExcelJS.Worksheet): SheetNhap | { loi: string } {
  // 1. Tìm ô "NGÀY" ở cột A (dòng 1 hoặc 2, quét rộng hơn cho chắc)
  let dongTieuDe = 0;
  for (let r = 1; r <= 6; r++) {
    if (vanBanO(ws.getCell(r, 1).value).toUpperCase() === 'NGÀY') {
      dongTieuDe = r;
      break;
    }
  }
  if (!dongTieuDe) return { loi: 'Không tìm thấy ô "NGÀY" ở cột A' };
  const dongDau = dongTieuDe + 3;

  // 2. Đọc các dòng ngày cho đến khi cột A không còn là ngày
  const canhBao: string[] = [];
  const theoNgay = new Map<string, DongNhap>();
  let dongCuoi = dongDau - 1;
  for (let r = dongDau; r <= Math.max(ws.rowCount, dongDau); r++) {
    const ngay = docNgay(ws.getCell(r, 1).value);
    if (!ngay) break;
    dongCuoi = r;
    const dong: DongNhap = {
      ngay,
      sang: vanBanO(ws.getCell(r, 3).value) !== '',
      chieu: vanBanO(ws.getCell(r, 4).value) !== '',
      ghi_chu_goc: vanBanO(ws.getCell(r, 5).value) || null,
    };
    const cu = theoNgay.get(ngay);
    if (cu) {
      // Ngày bị lặp: gộp lại
      cu.sang ||= dong.sang;
      cu.chieu ||= dong.chieu;
      if (dong.ghi_chu_goc && dong.ghi_chu_goc !== cu.ghi_chu_goc)
        cu.ghi_chu_goc = [cu.ghi_chu_goc, dong.ghi_chu_goc].filter(Boolean).join('; ');
      canhBao.push(`Ngày ${ngay.split('-').reverse().join('/')} bị lặp, đã gộp làm một`);
    } else theoNgay.set(ngay, dong);
  }
  const buoi = [...theoNgay.values()].sort((a, b) => a.ngay.localeCompare(b.ngay));
  const soBuoi = buoi.reduce((s, b) => s + (b.sang ? 1 : 0) + (b.chieu ? 1 : 0), 0);

  // 3. Đơn giá: công thức ở cột G (thường là G5)
  let donGia: number | null = null;
  for (let r = dongDau; r <= Math.max(dongCuoi, dongDau); r++) {
    const o = ws.getCell(r, 7);
    donGia = docDonGia(o.formula);
    if (donGia) break;
    // Không có công thức: thử chia kết quả cho số buổi
    const g = giaTriO(o.value);
    if (typeof g === 'number' && g > 0 && soBuoi > 0 && Number.isInteger(g / soBuoi)) {
      donGia = g / soBuoi;
      break;
    }
  }
  if (!donGia) canhBao.push('Không đọc được đơn giá, hãy nhập tay');

  // 4. Khối thông tin ở các cột I…M
  let maLop: string | null = null;
  let lopVanHoa: string | null = null;
  let hocPhan: string | null = null;
  let soBuoiKeHoach: number | null = null;
  let tenDayDu: string | null = null;
  let lichPhanCong: string | null = null;
  const docDongThongTin = (t: string) => {
    let m: RegExpExecArray | null;
    if ((m = RE_DIA_DIEM.exec(t))) tenDayDu = m[1].trim() || null;
    else if ((m = RE_LICH.exec(t))) lichPhanCong = m[1].trim() || null;
    else if ((m = RE_HOC_PHAN.exec(t))) {
      const sb = RE_SO_BUOI.exec(m[1]);
      soBuoiKeHoach = sb ? Number(sb[1]) : null;
      hocPhan = m[1].replace(RE_SO_BUOI, '').trim() || null;
    } else if ((m = RE_LOP.exec(t))) {
      const vh = RE_VAN_HOA.exec(m[1]);
      lopVanHoa = vh ? vh[1].trim() || null : null;
      maLop = m[1].replace(RE_VAN_HOA, '').trim() || null;
    }
  };
  for (let r = 1; r <= ws.rowCount; r++) {
    for (let c = 9; c <= 13; c++) cacDongTrongO(ws.getCell(r, c).value).forEach(docDongThongTin);
  }

  // 5. Tên sheet: "(done)" → hoàn thành
  const tenGoc = ws.name;
  const xong = RE_DONE.test(tenGoc);
  const tenSheet = chuan(tenGoc.replace(RE_DONE, '')) || tenGoc;
  if (!hocPhan) canhBao.push('Không đọc được học phần, tạm lấy theo tên sheet');

  // 6. Địa điểm: giá trị cột E xuất hiện nhiều nhất (ít nhất một nửa số dòng)
  const dem = new Map<string, number>();
  for (const b of buoi) {
    if (!b.ghi_chu_goc) continue;
    // "Thạch Thất - dạy bù" → tính là "Thạch Thất"
    const ten = b.ghi_chu_goc.split(/\s+[-–]\s+/)[0];
    dem.set(ten, (dem.get(ten) ?? 0) + 1);
  }
  let diaDiemGoiY: string | null = null;
  const [phoBien] = [...dem].sort((a, b) => b[1] - a[1]);
  if (phoBien && phoBien[1] * 2 >= buoi.length) diaDiemGoiY = phoBien[0];

  let diaDiemId: number | null = null;
  if (diaDiemGoiY) diaDiemId = timDiaDiemTheoTen(diaDiemGoiY)?.id ?? null;
  if (!diaDiemId && tenDayDu) {
    const k = khoaSoKhop(tenDayDu);
    diaDiemId = dsDiaDiem().find((d) => d.ten_day_du && khoaSoKhop(d.ten_day_du) === k)?.id ?? null;
  }
  if (diaDiemGoiY && !diaDiemId) canhBao.push(`Địa điểm "${diaDiemGoiY}" chưa có trong danh sách`);

  return {
    ten_sheet_goc: tenGoc,
    ten_sheet: tenSheet.slice(0, 31),
    trang_thai: xong ? 'hoan_thanh' : 'dang_day',
    hoc_phan: hocPhan ?? tenSheet,
    ma_lop: maLop,
    lop_van_hoa: lopVanHoa,
    so_buoi_ke_hoach: soBuoiKeHoach,
    don_gia: donGia,
    lich_phan_cong: lichPhanCong,
    dia_diem_goi_y: diaDiemGoiY,
    dia_diem_ten_day_du: tenDayDu,
    dia_diem_id: diaDiemId,
    buoi,
    so_ngay: buoi.length,
    so_buoi: soBuoi,
    canh_bao: canhBao,
  };
}

export const bamFile = (buffer: Buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export async function phanTichFile(buffer: Buffer, tenFile: string): Promise<KetQuaPhanTich> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch (e) {
    throw new LoiApp(400, `Không đọc được file Excel: ${(e as Error).message}`);
  }
  const hash = bamFile(buffer);
  const sheets: SheetNhap[] = [];
  const boQua: { ten_sheet: string; ly_do: string }[] = [];
  for (const ws of wb.worksheets) {
    const kq = phanTichSheet(ws);
    if ('loi' in kq) boQua.push({ ten_sheet: ws.name, ly_do: kq.loi });
    else sheets.push(kq);
  }
  const ten = tenFile.normalize('NFC');
  const goiY = goiYTruongTuTenFile(ten);
  const daNhap = layDb()
    .prepare('SELECT ten_file, nhap_luc FROM nhap_file WHERE hash = ? ORDER BY id')
    .all(hash) as { ten_file: string; nhap_luc: string }[];
  return { hash, ten_file: ten, goi_y_truong: goiY, truong_id: timTruongTheoGoiY(goiY), da_nhap: daNhap, sheets, bo_qua: boQua };
}

// ---------------------------------------------------------------------------
// Xác nhận nhập

export type XuLyTrung = 'bo_qua' | 'ghi_de' | 'tao_moi';

export interface SheetXacNhan {
  ten_sheet: string;
  hoc_phan: string;
  ma_lop: string | null;
  lop_van_hoa: string | null;
  so_buoi_ke_hoach: number | null;
  don_gia: number;
  lich_phan_cong: string | null;
  trang_thai: 'dang_day' | 'hoan_thanh' | 'tam_dung';
  dia_diem_id: number | null;
  dia_diem_moi: { ten_ngan: string; ten_day_du: string | null } | null; // tạo địa điểm mới khi nhập
  dia_diem_goi_y: string | null;
  xu_ly_trung: XuLyTrung | null;
  buoi: DongNhap[];
}

export interface DuLieuXacNhan {
  hash: string;
  ten_file: string;
  truong_id: number;
  sheets: SheetXacNhan[];
}

// Ghi chú của một ngày: bỏ phần tên địa điểm ở đầu ("Thạch Thất - dạy bù" → "dạy bù")
export function tachGhiChu(goc: string | null, tenDiaDiem: string | null): string | null {
  if (!goc) return null;
  if (tenDiaDiem && goc.toLowerCase().startsWith(tenDiaDiem.toLowerCase())) {
    return goc.slice(tenDiaDiem.length).replace(/^[\s\-–:,;.]+/, '').trim() || null;
  }
  return goc;
}

export function xacNhanNhap(d: DuLieuXacNhan) {
  if (!layTruong(d.truong_id)) throw new LoiApp(400, 'Trường không tồn tại');
  const db = layDb();
  const ketQua = { tao_moi: 0, ghi_de: 0, bo_qua: 0, so_ngay: 0, lop: [] as { id: number; ten_sheet: string; hanh_dong: string }[] };

  // Lớp vừa tạo trong lần nhập này (hai sheet cùng tên trong một file → sheet sau tạo tên mới)
  const taoTrongLanNay = new Set<number>();

  db.transaction(() => {
    for (const s of d.sheets) {
      // Địa điểm: chọn sẵn, hoặc tạo mới (dùng lại nếu đã có cùng tên)
      let diaDiemId = s.dia_diem_id;
      if (s.dia_diem_moi) {
        const co = timDiaDiemTheoTen(s.dia_diem_moi.ten_ngan);
        diaDiemId = co ? co.id : taoDiaDiem({ ten_ngan: s.dia_diem_moi.ten_ngan, ten_day_du: s.dia_diem_moi.ten_day_du, tien_dc: 0 }).id;
      }
      // Có địa điểm thì tên địa điểm ở cột E không phải ghi chú
      const tenCanBo = diaDiemId != null ? s.dia_diem_goi_y : null;
      const dsBuoi = s.buoi.map((b) => ({
        ngay: b.ngay,
        sang: b.sang ? 1 : 0,
        chieu: b.chieu ? 1 : 0,
        ghi_chu: tachGhiChu(b.ghi_chu_goc, tenCanBo),
      }));
      const thongTin = {
        truong_id: d.truong_id,
        dia_diem_id: diaDiemId,
        ma_lop: s.ma_lop,
        lop_van_hoa: s.lop_van_hoa,
        hoc_phan: s.hoc_phan,
        so_buoi_ke_hoach: s.so_buoi_ke_hoach,
        don_gia: s.don_gia,
        lich_phan_cong: s.lich_phan_cong,
        ngay_bat_dau: dsBuoi[0]?.ngay ?? null,
        ngay_ket_thuc: dsBuoi.at(-1)?.ngay ?? null,
        trang_thai: s.trang_thai,
      };

      const trung = timLopTheoTenSheet(d.truong_id, s.ten_sheet);
      const xuLy: XuLyTrung = trung && taoTrongLanNay.has(trung.id) ? 'tao_moi' : (s.xu_ly_trung ?? 'bo_qua');
      if (trung && xuLy === 'bo_qua') {
        ketQua.bo_qua++;
        ketQua.lop.push({ id: trung.id, ten_sheet: trung.ten_sheet, hanh_dong: 'Bỏ qua (đã có)' });
        continue;
      }
      if (trung && xuLy === 'ghi_de') {
        suaLop(trung.id, { ...thongTin, ten_sheet: s.ten_sheet });
        xoaBuoiCuaLop(trung.id);
        chenBuoiNhap(trung.id, dsBuoi);
        ketQua.ghi_de++;
        ketQua.so_ngay += dsBuoi.length;
        ketQua.lop.push({ id: trung.id, ten_sheet: s.ten_sheet, hanh_dong: 'Ghi đè' });
        continue;
      }
      const tenSheet = trung ? tenSheetMoi(d.truong_id, s.ten_sheet) : s.ten_sheet;
      const lop = taoLop({ ...thongTin, ten_sheet: tenSheet });
      taoTrongLanNay.add(lop.id);
      chenBuoiNhap(lop.id, dsBuoi);
      ketQua.tao_moi++;
      ketQua.so_ngay += dsBuoi.length;
      ketQua.lop.push({ id: lop.id, ten_sheet: tenSheet, hanh_dong: 'Tạo mới' });
    }
    db.prepare('INSERT INTO nhap_file (hash, ten_file, truong_id, so_lop) VALUES (?, ?, ?, ?)').run(
      d.hash,
      d.ten_file,
      d.truong_id,
      ketQua.tao_moi + ketQua.ghi_de,
    );
  })();
  return ketQua;
}
