import { useSyncExternalStore } from 'react';

// Thông báo nhỏ góc màn hình (toast)

export type LoaiThongBao = 'thanh-cong' | 'loi' | 'thong-tin';
export interface ThongBao {
  id: number;
  loai: LoaiThongBao;
  noiDung: string;
}

let ds: ThongBao[] = [];
let dem = 0;
const nguoiNghe = new Set<() => void>();
const phat = () => nguoiNghe.forEach((f) => f());

export function dongThongBao(id: number) {
  ds = ds.filter((t) => t.id !== id);
  phat();
}

export function thongBao(noiDung: string, loai: LoaiThongBao = 'thanh-cong') {
  const id = ++dem;
  ds = [...ds.slice(-4), { id, loai, noiDung }];
  phat();
  setTimeout(() => dongThongBao(id), loai === 'loi' ? 7000 : 3500);
}

export const baoLoi = (e: unknown) => thongBao(e instanceof Error ? e.message : String(e), 'loi');

export function useThongBao() {
  return useSyncExternalStore(
    (f) => {
      nguoiNghe.add(f);
      return () => nguoiNghe.delete(f);
    },
    () => ds,
  );
}
