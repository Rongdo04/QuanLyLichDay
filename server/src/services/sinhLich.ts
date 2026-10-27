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
    // Buổi cuối cả ngày mà chỉ còn thiếu 1 buổi → chỉ dạy sáng
    const dk: DuKien = ts.soBuoi && tongBuoi + soBuoiDuKien(duKien) > ts.soBuoi ? 'S' : duKien;
    ketQua.push({ ngay, thu: thuCuaNgay(ngay), du_kien: dk });
    tongBuoi += soBuoiDuKien(dk);
  }
  return { ngay: ketQua, boQua };
}

export function sinhLich(ts: ThamSoSinhLich): NgaySinh[] {
  return sinhLichChiTiet(ts).ngay;
}

// Ngày đã chấm (có tích sáng/chiều hoặc ghi chú) thì không tự xóa / sửa khi đổi lịch
export interface NgayDaCo {
  id: number;
  ngay: string;
  sang: number;
  chieu: number;
  ghi_chu: string | null;
  du_kien: DuKien | null;
}

export const daCham = (b: NgayDaCo) => !!(b.sang || b.chieu || b.ghi_chu?.trim());

export interface ThamSoDoiLich extends Omit<ThamSoSinhLich, 'ngayDaCo'> {
  keoDai?: boolean; // lịch tuần đến ngày kết thúc không đủ số buổi → bỏ mốc ngày kết thúc, sinh đến khi đủ
}

export interface KetQuaDoiLich {
  lich: NgaySinh[];                                   // toàn bộ ngày sau khi đổi (kể cả ngày đã chấm)
  them: NgaySinh[];                                   // ngày mới theo lịch mới
  xoa: NgayDaCo[];                                    // ngày chưa chấm, không còn đúng lịch mới
  doiDuKien: { id: number; ngay: string; du_kien: DuKien; cu: DuKien | null }[]; // ngày chưa chấm, đổi sáng/chiều dự kiến
  giuDaCham: NgayDaCo[];                              // ngày đã chấm nằm ngoài lịch mới, giữ nguyên
  tongBuoi: number;                                   // số buổi sau khi đổi (dự kiến + đã dạy ngoài lịch)
  thieu: number;                                      // còn thiếu so với số buổi kế hoạch
  ketThuc: string | null;                             // ngày buổi cuối sau khi đổi
}

const soBuoiDaDay = (b: NgayDaCo) => (b.sang ? 1 : 0) + (b.chieu ? 1 : 0);
const duKienDaDay = (b: NgayDaCo): DuKien =>
  b.sang && b.chieu ? 'SC' : b.chieu ? 'C' : b.sang ? 'S' : (b.du_kien ?? 'S');

// So lịch mới với các ngày lớp đang có: thêm / xóa / đổi dự kiến sao cho khớp lịch mới.
// - Ngày đã chấm: đã dạy thật, giữ nguyên và tính theo số buổi thực dạy (không theo dự kiến).
// - Ngày kết thúc là buổi cuối: luôn có (kể cả khi không đúng thứ trong lịch tuần).
// - Dư so với số buổi kế hoạch thì bỏ lần lượt từ cuối: bỏ chiều trước, rồi bỏ cả ngày.
// - keoDai: bỏ mốc ngày kết thúc, sinh tiếp đến khi đủ số buổi kế hoạch.
export function doiLichTheoMau(ts: ThamSoDoiLich, daCo: NgayDaCo[]): KetQuaDoiLich {
  const daChamDs = daCo.filter(daCham);
  const daDay = daChamDs.reduce((s, b) => s + soBuoiDaDay(b), 0);
  const conLai = ts.soBuoi ? ts.soBuoi - daDay : null;
  const ketThuc = ts.keoDai && ts.soBuoi ? null : (ts.ketThuc ?? null);
  const boQua = daChamDs.map((b) => b.ngay);

  // Các ngày chưa chấm theo lịch mới
  let moi: NgaySinh[] = [];
  if (conLai === null || conLai > 0) {
    if (ketThuc) {
      moi = sinhLichChiTiet({ ...ts, ketThuc, soBuoi: null, ngayDaCo: boQua }).ngay;
      if (ketThuc >= ts.batDau && moi.at(-1)?.ngay !== ketThuc && !boQua.includes(ketThuc) && !laNgayNghi(ketThuc, ts.ngayNghi)) {
        const cu = daCo.find((b) => b.ngay === ketThuc);
        const dkCuoi = cu?.du_kien ?? ts.thu[soThu(ketThuc)] ?? Object.values(ts.thu).find(Boolean) ?? 'C';
        moi.push({ ngay: ketThuc, thu: thuCuaNgay(ketThuc), du_kien: dkCuoi });
      }
      if (conLai !== null) {
        let tong = moi.reduce((s, n) => s + soBuoiDuKien(n.du_kien), 0);
        while (tong > conLai) {
          const cuoi = moi.at(-1)!;
          if (cuoi.du_kien === 'SC') moi[moi.length - 1] = { ...cuoi, du_kien: 'S' };
          else moi.pop();
          tong--;
        }
      }
    } else moi = sinhLichChiTiet({ ...ts, ketThuc: null, soBuoi: conLai, ngayDaCo: boQua }).ngay;
  }

  const theoNgay = new Map(moi.map((n) => [n.ngay, n]));
  const ngayCu = new Set(daCo.map((b) => b.ngay));
  const lich = [
    ...moi,
    ...daChamDs.map((b) => ({ ngay: b.ngay, thu: thuCuaNgay(b.ngay), du_kien: duKienDaDay(b) })),
  ].sort((a, b) => a.ngay.localeCompare(b.ngay));
  const tongBuoi = moi.reduce((s, n) => s + soBuoiDuKien(n.du_kien), 0) + daDay;
  const kq: KetQuaDoiLich = {
    lich,
    them: moi.filter((n) => !ngayCu.has(n.ngay)),
    xoa: [],
    doiDuKien: [],
    giuDaCham: daChamDs.filter((b) => !ts.thu[soThu(b.ngay)] || laNgayNghi(b.ngay, ts.ngayNghi)),
    tongBuoi,
    thieu: ts.soBuoi ? Math.max(ts.soBuoi - tongBuoi, 0) : 0,
    ketThuc: lich.at(-1)?.ngay ?? null,
  };
  for (const b of daCo) {
    if (daCham(b)) continue;
    const n = theoNgay.get(b.ngay);
    if (!n) kq.xoa.push(b);
    else if (b.du_kien !== n.du_kien) kq.doiDuKien.push({ id: b.id, ngay: b.ngay, du_kien: n.du_kien, cu: b.du_kien });
  }
  return kq;
}
