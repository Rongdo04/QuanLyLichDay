import dayjs from 'dayjs';
import { soThu, thuCuaNgay } from '../utils/thu.js';

export type DuKien = 'S' | 'C' | 'SC';

// Ngày nghỉ: một ngày, hoặc một khoảng (Tết)
export interface NgayNghi {
  tu: string;
  den?: string | null;
  ten?: string | null;
}

export interface ThamSoSinhLich {
  batDau: string;
  ketThuc?: string | null;
  soBuoi?: number | null;                       // "đủ N buổi" (S/C = 1, SC = 2)
  thu: Partial<Record<number, DuKien>>;          // 2..7, CN = 8
  ngayNghi?: (NgayNghi | string)[];
  ngayDaCo?: string[];                           // ngày lớp đã có, bỏ qua
}

export interface NgaySinh {
  ngay: string;
  thu: string;
  du_kien: DuKien;
}

const SO_NGAY_TOI_DA = 730; // chặn vòng lặp vô hạn

export function laNgayNghi(ngay: string, ds: (NgayNghi | string)[] = []): NgayNghi | null {
  for (const n of ds) {
    const x = typeof n === 'string' ? { tu: n } : n;
    const den = x.den || x.tu;
    if (ngay >= x.tu && ngay <= den) return x;
  }
  return null;
}

export function soBuoiDuKien(d: DuKien): number {
  return d === 'SC' ? 2 : 1;
}

export interface NgayBoQua {
  ngay: string;
  thu: string;
  ly_do: string;
}

// Sinh lịch, trả về cả những ngày đúng thứ nhưng bị bỏ qua (ngày nghỉ, đã có)
export function sinhLichChiTiet(ts: ThamSoSinhLich): { ngay: NgaySinh[]; boQua: NgayBoQua[] } {
  if (!ts.ketThuc && !ts.soBuoi) throw new Error('Cần nhập ngày kết thúc hoặc số buổi');
  const daCo = new Set(ts.ngayDaCo ?? []);
  const ketQua: NgaySinh[] = [];
  const boQua: NgayBoQua[] = [];
  let tongBuoi = 0;
  let d = dayjs(ts.batDau);
  for (let i = 0; i < SO_NGAY_TOI_DA; i++, d = d.add(1, 'day')) {
    const ngay = d.format('YYYY-MM-DD');
    if (ts.ketThuc && ngay > ts.ketThuc) break;
    if (ts.soBuoi && tongBuoi >= ts.soBuoi) break;
    const duKien = ts.thu[soThu(ngay)];
    if (!duKien) continue;
    const nghi = laNgayNghi(ngay, ts.ngayNghi);
    if (nghi) {
      boQua.push({ ngay, thu: thuCuaNgay(ngay), ly_do: nghi.ten ? `Nghỉ: ${nghi.ten}` : 'Ngày nghỉ' });
      continue;
    }
    if (daCo.has(ngay)) {
      boQua.push({ ngay, thu: thuCuaNgay(ngay), ly_do: 'Đã có trong lịch' });
      continue;
    }
    ketQua.push({ ngay, thu: thuCuaNgay(ngay), du_kien: duKien });
    tongBuoi += soBuoiDuKien(duKien);
  }
  return { ngay: ketQua, boQua };
}

export function sinhLich(ts: ThamSoSinhLich): NgaySinh[] {
  return sinhLichChiTiet(ts).ngay;
}
