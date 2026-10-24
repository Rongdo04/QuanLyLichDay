import dayjs from 'dayjs';

// Đổi ngày 'YYYY-MM-DD' sang "Thứ 2" … "Thứ 7", Chủ nhật → "CN"
export function thuCuaNgay(ngay: string): string {
  const d = dayjs(ngay).day(); // 0 = Chủ nhật
  return d === 0 ? 'CN' : `Thứ ${d + 1}`;
}

// Số thứ theo kiểu Việt Nam: 2..7, Chủ nhật = 8
export function soThu(ngay: string): number {
  const d = dayjs(ngay).day();
  return d === 0 ? 8 : d + 1;
}
