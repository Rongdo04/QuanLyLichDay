import { layDb } from '../db/connection.js';
import type { NgayNghi } from '../services/sinhLich.js';

export interface CaiDat {
  ten_gv: string;
  ma_gv: string;
  sdt: string;
  gio_sang: string;
  gio_chieu: string;
  nam_hoc: string;
  tiet_moi_buoi: number; // số tiết của một buổi (một ô sáng hoặc chiều)
  ngay_nghi: NgayNghi[];
  thu_muc_sao_luu: string;
}

const MAC_DINH: CaiDat = {
  ten_gv: '',
  ma_gv: '',
  sdt: '',
  gio_sang: '07h30',
  gio_chieu: '13h30',
  nam_hoc: '',
  tiet_moi_buoi: 5,
  ngay_nghi: [],
  thu_muc_sao_luu: '',
};

// Các khóa lưu dạng JSON
const KHOA_JSON = new Set(['ngay_nghi', 'tiet_moi_buoi']);

export function layCaiDat(): CaiDat {
  const rows = layDb().prepare('SELECT khoa, gia_tri FROM cai_dat').all() as { khoa: string; gia_tri: string }[];
  const kq: Record<string, unknown> = { ...MAC_DINH };
  for (const r of rows) {
    // Khóa bí mật (API key…) không bao giờ trả ra cùng cài đặt
    if (r.khoa.startsWith('bi_mat_')) continue;
    if (KHOA_JSON.has(r.khoa)) {
      try {
        kq[r.khoa] = JSON.parse(r.gia_tri);
      } catch {
        kq[r.khoa] = MAC_DINH[r.khoa as keyof CaiDat];
      }
    } else kq[r.khoa] = r.gia_tri;
  }
  return kq as unknown as CaiDat;
}

export function ghiCaiDat(duLieu: Partial<CaiDat>): CaiDat {
  const db = layDb();
  const stmt = db.prepare(
    'INSERT INTO cai_dat (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri',
  );
  db.transaction(() => {
    for (const [khoa, giaTri] of Object.entries(duLieu)) {
      if (giaTri === undefined) continue;
      stmt.run(khoa, KHOA_JSON.has(khoa) ? JSON.stringify(giaTri) : String(giaTri));
    }
  })();
  return layCaiDat();
}
