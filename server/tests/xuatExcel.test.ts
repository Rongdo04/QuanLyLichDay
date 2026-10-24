import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { taoApp } from '../src/app.js';
import { datDb, moDb } from '../src/db/connection.js';
import { taoBuoi } from '../src/repositories/buoi.js';
import { taoLop } from '../src/repositories/lop.js';
import { tenFileTruong, xuatFileTruong } from '../src/services/xuatExcel.js';
import { xuatTongHop } from '../src/services/xuatTongHop.js';

// Lớp mẫu AutoCad_TT(done): chiều T4, cả ngày T7, 10 ngày, 15 buổi, Thạch Thất
const NGAY_AUTOCAD: [string, number, number][] = [
  ['2026-09-23', 0, 1], ['2026-09-26', 1, 1], ['2026-09-30', 0, 1], ['2026-10-03', 1, 1],
  ['2026-10-07', 0, 1], ['2026-10-10', 1, 1], ['2026-10-14', 0, 1], ['2026-10-17', 1, 1],
  ['2026-10-21', 0, 1], ['2026-10-24', 1, 1],
];

function taoLopAutoCad() {
  const lop = taoLop({
    truong_id: 4,
    dia_diem_id: 1,
    ten_sheet: 'AutoCad_TT',
    ma_lop: 'CT.10T1',
    lop_van_hoa: '11A6',
    hoc_phan: 'Vẽ kỹ thuật và Autocad',
    so_buoi_ke_hoach: 15,
    don_gia: 400,
    lich_phan_cong: null,
    ngay_bat_dau: null,
    ngay_ket_thuc: null,
    trang_thai: 'hoan_thanh',
  });
  for (const [ngay, sang, chieu] of NGAY_AUTOCAD) {
    taoBuoi({ lop_id: lop.id, ngay, sang, chieu, co_tien_dc: 1, ghi_chu: ngay === '2026-10-03' ? 'dạy bù' : null, du_kien: null });
  }
  // Một ngày đã lên lịch nhưng chưa dạy
  taoBuoi({ lop_id: lop.id, ngay: '2026-10-28', sang: 0, chieu: 0, co_tien_dc: 1, ghi_chu: null, du_kien: 'C' });
  return lop;
}

async function docLai(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

beforeEach(() => {
  datDb(moDb(':memory:'));
});

describe('xuatExcel', () => {
  it('xuất đúng bố cục mẫu cũ và khớp tinhTien', async () => {
    taoLopAutoCad();
    const { tenFile, buffer } = await xuatFileTruong(4);
    expect(tenFile).toBe('THỐNG KÊ GIẢNG DẠY TRƯỜNG HN_2026-2027.xlsx');

    const wb = await docLai(buffer);
    const ws = wb.getWorksheet('AutoCad_TT')!;
    expect(ws).toBeTruthy();

    // Ô gộp
    const gop = ws.model.merges;
    for (const vung of ['A1:E1', 'A2:A4', 'B2:B4', 'C2:D2', 'C3:C4', 'D3:D4', 'E2:E4', 'F2:F4']) {
      expect(gop).toContain(vung);
    }

    // Tiêu đề
    expect(ws.getCell('A2').value).toBe('NGÀY');
    expect(ws.getCell('B2').value).toBe('THỨ');
    expect(ws.getCell('C2').value).toBe('Buổi');
    expect(ws.getCell('C3').value).toBe('Sáng');
    expect(ws.getCell('D3').value).toBe('Chiều');
    expect(ws.getCell('E2').value).toBe('Ghi chú');
    expect(ws.getCell('F2').value).toBe('Tiền DC');
    expect(ws.getCell('G4').value).toBe('Tiền Dạy');
    expect(ws.getCell('H4').value).toBe('Tổng');
    expect(ws.getCell('A2').font.bold).toBe(true);
    expect(ws.getCell('F2').font.bold).toBeFalsy();
    expect(ws.getCell('G4').border?.top).toBeUndefined();

    // Dòng dữ liệu đầu: 23/09/2026, Thứ 4, chỉ chiều
    const a5 = ws.getCell('A5');
    expect(a5.value).toEqual(new Date(Date.UTC(2026, 8, 23)));
    expect(a5.numFmt).toBe('dd/mm/yyyy');
    expect(ws.getCell('B5').value).toBe('Thứ 4');
    expect(ws.getCell('C5').value).toBeNull();
    expect(ws.getCell('D5').value).toBe('x');
    expect(ws.getCell('E5').value).toBe('Thạch Thất');
    expect(ws.getCell('F5').value).toBe(66);
    // 26/09: cả ngày, Thứ 7, tiền DC chỉ tính 1 lần
    expect(ws.getCell('B6').value).toBe('Thứ 7');
    expect(ws.getCell('C6').value).toBe('x');
    expect(ws.getCell('D6').value).toBe('x');
    expect(ws.getCell('F6').value).toBe(66);
    // 03/10: ghi chú nối sau địa điểm
    expect(ws.getCell('E8').value).toBe('Thạch Thất - dạy bù');
    // 28/10: chưa dạy → không ghi địa điểm, không tiền DC
    expect(ws.getCell('A15').value).toEqual(new Date(Date.UTC(2026, 9, 28)));
    expect(ws.getCell('C15').value).toBeNull();
    expect(ws.getCell('E15').value).toBeNull();
    expect(ws.getCell('F15').value).toBeNull();
    expect(ws.getCell('A16').value).toBeNull();

    // Công thức theo dòng cuối thực tế (15), kèm kết quả
    const g5 = ws.getCell('G5').value as ExcelJS.CellFormulaValue;
    expect(g5.formula).toBe('COUNTA(C5:D15)*400');
    expect(g5.result).toBe(6000);
    const h5 = ws.getCell('H5').value as ExcelJS.CellFormulaValue;
    expect(h5.formula).toBe('SUM(F5:F15,G5)');
    expect(h5.result).toBe(6660);
    expect(ws.getCell('G5').numFmt).toBe('#,##0');

    // Khối thông tin cột K
    expect(ws.getCell('K4').value).toBe('Địa điểm: Trung tâm GDNN-GDTX Thạch Thất - Cơ sở 2');
    expect(ws.getCell('K5').value).toBe('Lớp: CT.10T1 (Lớp văn hóa: 11A6)');
    expect(ws.getCell('K6').value).toBe('Học phần: Vẽ kỹ thuật và Autocad (15 buổi)');
    expect(ws.getCell('K7').value).toBe('Thời gian vào lớp: Sáng: 07h30 - Chiều: 13h30');
    expect(ws.getCell('K8').value).toBe('Giáo viên: :G366 Đặng Mạnh Hiền: 0329615098');

    // Định dạng chung
    expect(ws.getCell('A5').font.name).toBe('Times New Roman');
    expect(ws.getCell('A5').font.size).toBe(13);
    expect(ws.getCell('F15').border?.bottom?.style).toBe('thin');
    expect(ws.getCell('A1').border?.top?.style).toBe('thin');
    expect(ws.getColumn('A').width).toBe(12.8);
    expect(ws.getColumn('K').width).toBe(60);
    expect(ws.getRow(1).height).toBe(16.5);
    expect(ws.pageSetup.paperSize).toBe(9);
    expect(ws.pageSetup.orientation).toBe('portrait');
    expect(ws.pageSetup.fitToWidth).toBe(1);
  });

  it('có lịch phân công thì thêm dòng, lọc theo khoảng ngày', async () => {
    const lop = taoLopAutoCad();
    const { suaLop } = await import('../src/repositories/lop.js');
    suaLop(lop.id, { lich_phan_cong: 'Chiều T4 và ngày T7' });
    const { buffer } = await xuatFileTruong(4, { tu: '2026-10-01', den: '2026-10-31' });
    const ws = (await docLai(buffer)).getWorksheet('AutoCad_TT')!;
    expect(ws.getCell('K7').value).toBe('Lịch phân công: Chiều T4 và ngày T7');
    expect(ws.getCell('K9').value).toBe('Giáo viên: :G366 Đặng Mạnh Hiền: 0329615098');
    // Tháng 10: 03, 07, 10, 14, 17, 21, 24 (dạy) + 28 (chưa dạy) = 8 dòng, 11 buổi
    expect(ws.getCell('A5').value).toEqual(new Date(Date.UTC(2026, 9, 3)));
    const g5 = ws.getCell('G5').value as ExcelJS.CellFormulaValue;
    expect(g5.formula).toBe('COUNTA(C5:D12)*400');
    expect(g5.result).toBe(11 * 400);
    expect((ws.getCell('H5').value as ExcelJS.CellFormulaValue).result).toBe(11 * 400 + 7 * 66);
  });

  it('nhiều lớp theo thứ tự, lớp không có ngày vẫn có sheet', async () => {
    taoLopAutoCad();
    taoLop({
      truong_id: 4, dia_diem_id: null, ten_sheet: 'Tin Học_TT', ma_lop: null, lop_van_hoa: null,
      hoc_phan: 'Tin học', so_buoi_ke_hoach: null, don_gia: 400, lich_phan_cong: null,
      ngay_bat_dau: null, ngay_ket_thuc: null, trang_thai: 'dang_day', thu_tu: 0,
    });
    const wb = await docLai((await xuatFileTruong(4)).buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tin Học_TT', 'AutoCad_TT']);
    const ws = wb.getWorksheet('Tin Học_TT')!;
    expect((ws.getCell('G5').value as ExcelJS.CellFormulaValue).formula).toBe('COUNTA(C5:D5)*400');
    // File có <v>0</v>, nhưng bộ đọc của exceljs bỏ qua kết quả bằng 0 nên result = undefined
    expect((ws.getCell('H5').value as ExcelJS.CellFormulaValue).result ?? 0).toBe(0);
    expect(ws.getCell('K4').value).toBe('Học phần: Tin học');
  });

  it('tên file khi có khoảng ngày', () => {
    expect(tenFileTruong('GTCT', '2026-2027', '2026-10-01', '2026-10-31')).toBe(
      'THỐNG KÊ GIẢNG DẠY TRƯỜNG GTCT_2026-2027_01.10.2026-31.10.2026.xlsx',
    );
  });

  it('API trả file với tên tiếng Việt mã hóa UTF-8', async () => {
    const lop = taoLopAutoCad();
    const r = await request(taoApp())
      .get(`/api/xuat/truong/4?lopIds=${lop.id}`)
      .buffer(true)
      .parse((res, cb) => {
        const parts: Buffer[] = [];
        res.on('data', (c: Buffer) => parts.push(c));
        res.on('end', () => cb(null, Buffer.concat(parts)));
      })
      .expect(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');
    expect(r.headers['content-disposition']).toContain(
      "filename*=UTF-8''" + encodeURIComponent('THỐNG KÊ GIẢNG DẠY TRƯỜNG HN_2026-2027.xlsx'),
    );
    const wb = await docLai(r.body as Buffer);
    expect(wb.worksheets).toHaveLength(1);

    const loi = await request(taoApp()).get('/api/xuat/truong/1').expect(400);
    expect(loi.body.loi).toBe('Không có lớp nào để xuất');
  });

  // Mở thử bằng LibreOffice headless nếu máy có cài
  const soffice = timLibreOffice();
  it.skipIf(!soffice)('LibreOffice mở được file xuất', async () => {
    taoLopAutoCad();
    const thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'xuat-'));
    const file = path.join(thuMuc, 'thu.xlsx');
    fs.writeFileSync(file, (await xuatFileTruong(4)).buffer);
    execFileSync(soffice!, ['--headless', '--convert-to', 'csv', '--outdir', thuMuc, file], { timeout: 60000 });
    const csv = fs.readFileSync(path.join(thuMuc, 'thu.csv'), 'utf8');
    expect(csv).toContain('6660');
  });
});

describe('xuatTongHop', () => {
  it('sheet Tổng hợp và Theo tháng', async () => {
    taoLopAutoCad();
    const { tenFile, buffer } = await xuatTongHop();
    expect(tenFile).toBe('TỔNG HỢP GIẢNG DẠY_2026-2027.xlsx');
    const wb = await docLai(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng hợp', 'Theo tháng']);

    const ws = wb.getWorksheet('Tổng hợp')!;
    expect(ws.getCell('A1').value).toBe('Đơn vị: nghìn đồng');
    expect(ws.getRow(4).values).toEqual([
      undefined, 'Trường', 'Lớp', 'Học phần', 'Số buổi KH', 'Đã dạy', 'Đơn giá', 'Tiền dạy', 'Tiền DC', 'Tổng',
    ]);
    expect(ws.getRow(5).values).toEqual([
      undefined, 'Trường Trung cấp Hà Nội', 'AutoCad_TT', 'Vẽ kỹ thuật và Autocad', 15, 15, 400, 6000, 660, 6660,
    ]);
    expect(ws.getCell('A6').value).toBe('Tổng cộng');
    expect((ws.getCell('I6').value as ExcelJS.CellFormulaValue).result).toBe(6660);
    expect(ws.getCell('I5').numFmt).toBe('#,##0');

    const wt = wb.getWorksheet('Theo tháng')!;
    expect(wt.getCell('A1').value).toBe('Đơn vị: nghìn đồng');
    // Cột: Tháng | GTCT | GTVT | DANGANH | HN | Tổng
    expect(wt.getRow(4).values).toEqual([undefined, 'Tháng', 'GTCT', 'GTVT', 'DANGANH', 'HN', 'Tổng']);
    expect(wt.getCell('A5').value).toBe('09/2026');
    // Tháng 9: 23, 26, 30 → 4 buổi, 3 ngày DC
    expect(wt.getCell('E5').value).toBe(4 * 400 + 3 * 66);
    expect(wt.getCell('B5').value).toBeNull();
    expect(wt.getCell('A16').value).toBe('08/2027');
    expect(wt.getCell('A17').value).toBe('Tổng cộng');
    expect((wt.getCell('F17').value as ExcelJS.CellFormulaValue).result).toBe(6660);
  });

  it('theo khoảng ngày', async () => {
    taoLopAutoCad();
    const { tenFile, buffer } = await xuatTongHop({ tu: '2026-10-01', den: '2026-10-31' });
    expect(tenFile).toBe('TỔNG HỢP GIẢNG DẠY_01.10.2026-31.10.2026.xlsx');
    const wt = (await docLai(buffer)).getWorksheet('Theo tháng')!;
    expect(wt.getCell('A5').value).toBe('10/2026');
    expect(wt.getCell('A6').value).toBe('Tổng cộng');
  });
});

function timLibreOffice(): string | null {
  const ungVien = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ];
  return ungVien.find((p) => fs.existsSync(p)) ?? null;
}
