import fs from 'node:fs';
import path from 'node:path';
import dayjs from 'dayjs';
import { layDb, layKhongGian, thuMucDuLieu } from '../db/connection.js';
import { layCaiDat } from '../repositories/caiDat.js';

// Sao lưu DB: data/backups/giangday_YYYYMMDD_HHmmss.db, giữ 30 bản mới nhất

export const SO_BAN_GIU_LAI = 30;
const RE_TEN = /^giangday_(\d{8})_(\d{6})(?:_\d+)?\.db$/;

export interface BanSaoLuu {
  ten: string;
  duong_dan: string;
  kich_thuoc: number;
  luc: string; // 'YYYY-MM-DD HH:mm:ss'
}

// Thư mục sao lưu: mặc định backups/ trong thư mục dữ liệu của người dùng.
// Chỉ quản trị (hoặc chạy không đăng nhập) được đặt thư mục khác trong Cài đặt — người dùng
// thường không được ghi file ra ngoài thư mục của mình trên máy chủ.
export function thuMucSaoLuu(): string {
  const goc = thuMucDuLieu();
  const caiDat = layCaiDat().thu_muc_sao_luu?.trim();
  const kg = layKhongGian();
  if (!caiDat || (kg && !kg.laQuanTri)) return path.join(goc, 'backups');
  return path.isAbsolute(caiDat) ? caiDat : path.resolve(goc, caiDat);
}

// Thời điểm của bản sao lưu: đọc từ tên file (copy thư mục sang máy khác không làm sai)
function thoiDiem(ten: string, duongDan: string): dayjs.Dayjs {
  const m = RE_TEN.exec(ten);
  if (m) {
    const s = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4, 6)}`;
    const d = dayjs(s);
    if (d.isValid()) return d;
  }
  return dayjs(fs.statSync(duongDan).mtime);
}

export function dsBanSaoLuu(thuMuc = thuMucSaoLuu()): BanSaoLuu[] {
  if (!fs.existsSync(thuMuc)) return [];
  return fs
    .readdirSync(thuMuc)
    .filter((ten) => RE_TEN.test(ten))
    .map((ten) => {
      const duongDan = path.join(thuMuc, ten);
      return {
        ten,
        duong_dan: duongDan,
        kich_thuoc: fs.statSync(duongDan).size,
        luc: thoiDiem(ten, duongDan).format('YYYY-MM-DD HH:mm:ss'),
      };
    })
    .sort((a, b) => b.luc.localeCompare(a.luc) || b.ten.localeCompare(a.ten));
}

// Xóa bớt bản cũ, chỉ giữ N bản mới nhất
export function donBanCu(thuMuc = thuMucSaoLuu(), giuLai = SO_BAN_GIU_LAI): number {
  const cu = dsBanSaoLuu(thuMuc).slice(giuLai);
  for (const b of cu) fs.rmSync(b.duong_dan, { force: true });
  return cu.length;
}

export function saoLuuNgay(): BanSaoLuu {
  const thuMuc = thuMucSaoLuu();
  fs.mkdirSync(thuMuc, { recursive: true });
  const goc = `giangday_${dayjs().format('YYYYMMDD_HHmmss')}`;
  let ten = `${goc}.db`;
  for (let i = 2; fs.existsSync(path.join(thuMuc, ten)); i++) ten = `${goc}_${i}.db`;
  const duongDan = path.join(thuMuc, ten);
  // VACUUM INTO tạo bản sao nhất quán kể cả khi đang ghi (WAL)
  layDb().prepare('VACUUM INTO ?').run(duongDan);
  donBanCu(thuMuc);
  return dsBanSaoLuu(thuMuc).find((b) => b.ten === ten)!;
}

// Gọi khi khởi động: sao lưu nếu bản gần nhất đã cũ hơn 24 giờ
export function saoLuuTuDong(): BanSaoLuu | null {
  const [moiNhat] = dsBanSaoLuu();
  if (moiNhat && dayjs().diff(dayjs(moiNhat.luc), 'hour', true) < 24) return null;
  return saoLuuNgay();
}
