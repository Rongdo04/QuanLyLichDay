import type { Buoi, DuKien } from '../api/types';
import { docLichTuan } from '../components/ChonThuTrongTuan';
import { soThu } from './format';
import { phanTichLichPhanCong } from './nghiepVu';

// Buổi dự kiến của một ngày: lấy theo ngày đó nếu đã lưu (ngày sinh bằng trình sinh lịch);
// ngày nhập từ Excel cũ / thêm lẻ chưa có thì suy theo lịch tuần, rồi theo "Lịch phân công" của lớp.
export function duKienCuaBuoi(
  b: Pick<Buoi, 'ngay' | 'du_kien'>,
  lop?: { lich_tuan: string | null; lich_phan_cong: string | null } | null,
): DuKien | null {
  if (b.du_kien) return b.du_kien;
  if (!lop) return null;
  const thu = soThu(b.ngay);
  return docLichTuan(lop.lich_tuan)[thu] ?? phanTichLichPhanCong(lop.lich_phan_cong).thu[thu] ?? null;
}

export const coSang = (d: DuKien | null) => d === 'S' || d === 'SC';
export const coChieu = (d: DuKien | null) => d === 'C' || d === 'SC';
