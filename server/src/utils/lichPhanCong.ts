// Đọc / viết chuỗi "Lịch phân công", ví dụ:
//   "Chiều T4 và ngày T7. Bắt đầu từ chiều thứ 4 28/10/2026"
//   "Sáng T2, T4 hàng tuần. Bắt đầu từ sáng thứ 2 26/10/2026"
// File này không phụ thuộc thư viện nào để client dùng chung được.

export type DuKienBuoi = 'S' | 'C' | 'SC';
export type LichTheoThu = Partial<Record<number, DuKienBuoi>>; // 2..7, CN = 8

const TEN_THU_NGAN: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'CN' };
const NHAN_BUOI: Record<DuKienBuoi, string> = { S: 'sáng', C: 'chiều', SC: 'cả ngày' };

const vietHoaDau = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// {4:'C', 7:'SC'} → "Chiều T4 và cả ngày T7"
export function moTaThu(thu: LichTheoThu): string {
  const nhom = new Map<DuKienBuoi, number[]>();
  for (let t = 2; t <= 8; t++) {
    const dk = thu[t];
    if (!dk) continue;
    if (!nhom.has(dk)) nhom.set(dk, []);
    nhom.get(dk)!.push(t);
  }
  const phan = [...nhom].map(([dk, ds]) => `${NHAN_BUOI[dk]} ${ds.map((t) => TEN_THU_NGAN[t]).join(', ')}`);
  if (phan.length === 0) return '';
  const chuoi = phan.length === 1 ? phan[0] : `${phan.slice(0, -1).join(', ')} và ${phan.at(-1)}`;
  return vietHoaDau(chuoi);
}

function thuDayDu(ngay: string): string {
  const [y, m, d] = ngay.split('-').map(Number);
  const t = new Date(y, m - 1, d).getDay();
  return t === 0 ? 'chủ nhật' : `thứ ${t + 1}`;
}

// Tạo chuỗi lịch phân công từ các thứ đã chọn và ngày dạy đầu tiên
export function taoLichPhanCong(thu: LichTheoThu, ngayDau?: { ngay: string; du_kien: DuKienBuoi } | null): string {
  const moTa = moTaThu(thu);
  if (!ngayDau) return moTa;
  const [y, m, d] = ngayDau.ngay.split('-');
  const buoi = ngayDau.du_kien === 'S' ? 'sáng' : ngayDau.du_kien === 'C' ? 'chiều' : 'ngày';
  return `${moTa}. Bắt đầu từ ${buoi} ${thuDayDu(ngayDau.ngay)} ${d}/${m}/${y}`;
}

function soThuTuChu(s: string): number | null {
  const t = s.replace(/\s+/g, '').toLowerCase();
  if (t === 'cn' || t === 'chủnhật') return 8;
  const m = /^t([2-7])$/.exec(t);
  return m ? Number(m[1]) : null;
}

// Gợi ý các thứ và ngày bắt đầu từ chuỗi lịch phân công (đọc được thì điền sẵn vào trình sinh lịch)
export function phanTichLichPhanCong(chuoi: string | null | undefined): { thu: LichTheoThu; batDau: string | null } {
  const thu: LichTheoThu = {};
  if (!chuoi) return { thu, batDau: null };
  const s = chuoi.normalize('NFC');
  const viTriBatDau = s.search(/bắt đầu/iu);
  const phanLich = viTriBatDau >= 0 ? s.slice(0, viTriBatDau) : s;
  const phanNgay = viTriBatDau >= 0 ? s.slice(viTriBatDau) : '';

  const THU = String.raw`(?:t\s*[2-7]|cn|chủ\s*nhật)`;
  const re = new RegExp(String.raw`(sáng|chiều|cả\s*ngày|ngày)\s+(${THU}(?:\s*(?:,|và|&)\s*${THU})*)`, 'giu');
  for (const m of phanLich.matchAll(re)) {
    const loai = m[1].toLowerCase().replace(/\s+/g, ' ');
    const dk: DuKienBuoi = loai === 'sáng' ? 'S' : loai === 'chiều' ? 'C' : 'SC';
    for (const tu of m[2].split(/\s*(?:,|và|&)\s*/iu)) {
      const t = soThuTuChu(tu);
      if (!t) continue;
      const cu = thu[t];
      // Một thứ vừa có sáng vừa có chiều → cả ngày
      thu[t] = cu && cu !== dk ? 'SC' : dk;
    }
  }

  // Ngày bắt đầu: sau chữ "Bắt đầu", hoặc kiểu "… từ 29/5/2026"
  let batDau: string | null = null;
  const mNgay = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(phanNgay || s);
  if (mNgay) batDau = `${mNgay[3]}-${mNgay[2].padStart(2, '0')}-${mNgay[1].padStart(2, '0')}`;
  return { thu, batDau };
}
