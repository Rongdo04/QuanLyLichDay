import dayjs from 'dayjs';
import type { DuKien, TrangThai } from '../api/types';

// Tiền lưu đơn vị nghìn đồng → hiển thị đồng đầy đủ: 6000 → "6.000.000 đ"
export const dinhDangTien = (nghin: number) => `${(nghin * 1000).toLocaleString('vi-VN')} đ`;

// Đơn vị của đơn giá: "buổi" hoặc "tiết"
export const donViGia = (l: { tinh_theo?: string | null }) => (l.tinh_theo === 'tiet' ? 'tiết' : 'buổi');

export const dinhDangSo = (n: number) => n.toLocaleString('vi-VN');

// 'YYYY-MM-DD' → 'dd/mm/yyyy'
export const dinhDangNgay = (ngay?: string | null) => (ngay ? ngay.split('-').reverse().join('/') : '');

// 'YYYY-MM-DD' → 'dd/mm'
export const ngayNgan = (ngay: string) => ngay.slice(8, 10) + '/' + ngay.slice(5, 7);

export const homNay = () => dayjs().format('YYYY-MM-DD');

// Tên kỳ học theo ngày bắt đầu (giống server): tháng 8–1 → HK1, tháng 2–7 → HK2. '2026-09-05' → 'HK1_2026-2027'
export function tenKyHoc(ngayBatDau: string): string {
  const nam = Number(ngayBatDau.slice(0, 4));
  const thang = Number(ngayBatDau.slice(5, 7));
  if (thang >= 8) return `HK1_${nam}-${nam + 1}`;
  return `${thang === 1 ? 'HK1' : 'HK2'}_${nam - 1}-${nam}`;
}

// Khoảng ngày mặc định của kỳ hiện tại và các kỳ sau (để điền nhanh): HK1 01/08–31/01, HK2 01/02–31/07
export function cacKyGoiY(soKy = 3): { ngay_bat_dau: string; ngay_ket_thuc: string }[] {
  const d = dayjs();
  let nam = d.month() + 1 >= 8 ? d.year() : d.year() - 1; // năm bắt đầu năm học
  let hk = d.month() + 1 >= 8 || d.month() + 1 === 1 ? 1 : 2;
  const kq = [];
  for (let i = 0; i < soKy; i++) {
    kq.push(
      hk === 1
        ? { ngay_bat_dau: `${nam}-08-01`, ngay_ket_thuc: `${nam + 1}-01-31` }
        : { ngay_bat_dau: `${nam + 1}-02-01`, ngay_ket_thuc: `${nam + 1}-07-31` },
    );
    if (hk === 2) nam++;
    hk = hk === 1 ? 2 : 1;
  }
  return kq;
}

export const dauThang = (thang: string) => `${thang}-01`;
export const cuoiThang = (thang: string) => dayjs(`${thang}-01`).endOf('month').format('YYYY-MM-DD');

// Thứ Hai của tuần chứa ngày đó
export const dauTuan = (ngay: string) => {
  const d = dayjs(ngay);
  return d.subtract((d.day() + 6) % 7, 'day').format('YYYY-MM-DD');
};

export const congNgay = (ngay: string, so: number) => dayjs(ngay).add(so, 'day').format('YYYY-MM-DD');

// Thứ theo kiểu Việt Nam: 2..7, Chủ nhật = 8
export const soThu = (ngay: string) => {
  const d = dayjs(ngay).day();
  return d === 0 ? 8 : d + 1;
};

export const NHAN_TRANG_THAI: Record<TrangThai, string> = {
  dang_day: 'Đang dạy',
  hoan_thanh: 'Hoàn thành',
  tam_dung: 'Tạm dừng',
};

export const MAU_TRANG_THAI: Record<TrangThai, string> = {
  dang_day: 'bg-blue-50 text-blue-700 ring-blue-200',
  hoan_thanh: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  tam_dung: 'bg-amber-50 text-amber-700 ring-amber-200',
};

export const NHAN_DU_KIEN: Record<DuKien, string> = { S: 'Sáng', C: 'Chiều', SC: 'Cả ngày' };

export const soBuoiDuKien = (d: DuKien | null) => (d === 'SC' ? 2 : d ? 1 : 0);

export const dinhDangDungLuong = (byte: number) =>
  byte < 1024 * 1024 ? `${Math.max(1, Math.round(byte / 1024))} KB` : `${(byte / 1024 / 1024).toFixed(1)} MB`;
