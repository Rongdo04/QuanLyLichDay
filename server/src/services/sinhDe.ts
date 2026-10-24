import { layDb } from '../db/connection.js';
import { dsCauHoi, ghiNhanDaDung, layNhieuCauHoi, type CauHoi } from '../repositories/cauHoi.js';
import { layCaiDat } from '../repositories/caiDat.js';
import { layLop } from '../repositories/lop.js';
import { docTepMau, layMauDe, mauChoTruong } from '../repositories/mauDe.js';
import { layMon, timMonTheoTen } from '../repositories/mon.js';
import { layTruong } from '../repositories/truong.js';
import { LoiApp } from '../utils/loi.js';
import { bocDe, dinhDangDiem, type OCau } from './bocDe.js';
import { dienMau, type DuLieuMau } from './mauWord.js';

// Thông tin in ở đầu đề (người dùng sửa được trước khi sinh)
export interface ThongTinDe {
  truong: string;
  dia_danh: string;
  hoc_phan: string;
  ma_hoc_phan: string;
  nganh: string;
  trinh_do: string;
  lop: string;
  lop_van_hoa: string;
  nam_hoc: string;
  hoc_ky: string;
  hinh_thuc: string;
  thoi_gian: number;
  ngay_thi: string;
  tai_lieu: boolean; // true = được sử dụng tài liệu
}

export interface CauDaLuu {
  cau_hoi_id: number | null;
  diem: number;
  noi_dung: string;
  dap_an: string;
}

export interface DeDaLuu {
  so_de: number;
  cau: CauDaLuu[];
}

export interface DeThi {
  id: number;
  mon_id: number | null;
  lop_id: number | null;
  truong_id: number | null;
  mau_de_id: number | null;
  ten_file: string;
  thong_tin: ThongTinDe;
  noi_dung: DeDaLuu[];
  tao_luc: string;
}

// Gợi ý thông tin đề theo lớp (hoặc chỉ theo môn)
export function goiYDeThi(lopId?: number, monId?: number) {
  const caiDat = layCaiDat();
  const lop = lopId ? layLop(lopId) : undefined;
  if (lopId && !lop) throw new LoiApp(404, 'Không tìm thấy lớp');
  const mon = monId ? layMon(monId) : lop ? timMonTheoTen(lop.hoc_phan) : undefined;
  const truong = lop ? layTruong(lop.truong_id) : undefined;
  const mau = mauChoTruong(truong?.id ?? null);
  const thongTin: ThongTinDe = {
    truong: truong?.ten ?? '',
    dia_danh: 'Hà Nội',
    hoc_phan: lop?.hoc_phan ?? mon?.ten ?? '',
    ma_hoc_phan: mon?.ma ?? '',
    nganh: mon?.nganh ?? 'Công nghệ thông tin',
    trinh_do: mon?.trinh_do ?? 'Trung cấp',
    lop: lop?.ma_lop ?? '',
    lop_van_hoa: lop?.lop_van_hoa ?? '',
    nam_hoc: caiDat.nam_hoc,
    hoc_ky: 'I',
    hinh_thuc: 'Tự luận',
    thoi_gian: mau?.thoi_gian ?? 60,
    ngay_thi: '…/…/ 202…',
    tai_lieu: false,
  };
  return {
    thong_tin: thongTin,
    mon_id: mon?.id ?? null,
    truong_id: truong?.id ?? null,
    mau_de_id: mau?.id ?? null,
    cau_truc: (mau?.cau_truc ?? [3, 3, 4]).map((diem) => ({ diem, muc_do: null })) as OCau[],
  };
}

const rutGonCau = (c: CauHoi) => ({
  id: c.id,
  chu_de: c.chu_de,
  muc_do: c.muc_do,
  diem: c.diem,
  noi_dung: c.noi_dung,
  dap_an: c.dap_an,
  so_lan_dung: c.so_lan_dung,
});

// Bốc thử các đề để người dùng xem / đổi câu trước khi sinh file
export function xemTruocDe(monId: number, soDe: number, cauTruc: OCau[]) {
  if (!layMon(monId)) throw new LoiApp(404, 'Không tìm thấy môn');
  const nganHang = dsCauHoi(monId);
  let kq;
  try {
    kq = bocDe(nganHang, soDe, cauTruc);
  } catch (e) {
    throw new LoiApp(400, (e as Error).message);
  }
  return { de: kq.de, canh_bao: kq.canh_bao, ngan_hang: nganHang.map(rutGonCau) };
}

// Bỏ ký tự không dùng được trong tên file Windows
const sachTenFile = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

// "CT.10T1 - CT14 Thiết kế Web (Đề thi & Đáp án).docx" (giống tên file mẫu của thầy)
export function tenFileDeThi(t: Pick<ThongTinDe, 'lop' | 'ma_hoc_phan' | 'hoc_phan'>): string {
  const hocPhan = [t.ma_hoc_phan, t.hoc_phan].filter(Boolean).join(' ');
  const ten = [t.lop, hocPhan].filter(Boolean).join(' - ') || 'Đề thi';
  return `${sachTenFile(ten)} (Đề thi & Đáp án).docx`;
}

export interface YeuCauTaoDe {
  mon_id: number;
  lop_id: number | null;
  truong_id: number | null;
  mau_de_id: number;
  thong_tin: ThongTinDe;
  de: { cau: { cau_hoi_id: number; diem: number }[] }[];
}

export function taoDeThi(y: YeuCauTaoDe): DeThi {
  if (!layMon(y.mon_id)) throw new LoiApp(404, 'Không tìm thấy môn');
  if (!layMauDe(y.mau_de_id)) throw new LoiApp(404, 'Không tìm thấy mẫu đề');
  const ids = y.de.flatMap((d) => d.cau.map((c) => c.cau_hoi_id));
  const cauHoi = layNhieuCauHoi(ids);
  y.de.forEach((d, i) => {
    const trongDe = new Set<number>();
    for (const c of d.cau) {
      const ch = cauHoi.get(c.cau_hoi_id);
      if (!ch || ch.mon_id !== y.mon_id) throw new LoiApp(400, `Đề ${i + 1}: có câu hỏi không thuộc môn này`);
      if (trongDe.has(c.cau_hoi_id)) throw new LoiApp(400, `Đề ${i + 1}: một câu hỏi bị chọn hai lần`);
      trongDe.add(c.cau_hoi_id);
    }
  });
  // Lưu bản chụp nội dung: sửa ngân hàng sau này không làm đổi đề đã sinh
  const noiDung: DeDaLuu[] = y.de.map((d, i) => ({
    so_de: i + 1,
    cau: d.cau.map((c) => {
      const ch = cauHoi.get(c.cau_hoi_id)!;
      return { cau_hoi_id: ch.id, diem: c.diem, noi_dung: ch.noi_dung, dap_an: ch.dap_an };
    }),
  }));
  const tenFile = tenFileDeThi(y.thong_tin);
  const db = layDb();
  const id = db.transaction(() => {
    const r = db
      .prepare(
        'INSERT INTO de_thi (mon_id, lop_id, truong_id, mau_de_id, ten_file, thong_tin, noi_dung) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(y.mon_id, y.lop_id, y.truong_id, y.mau_de_id, tenFile, JSON.stringify(y.thong_tin), JSON.stringify(noiDung));
    ghiNhanDaDung(ids);
    return Number(r.lastInsertRowid);
  })();
  return layDeThi(id)!;
}

interface DongDeThi extends Omit<DeThi, 'thong_tin' | 'noi_dung'> {
  thong_tin: string;
  noi_dung: string;
}
const docDong = (r: DongDeThi): DeThi => ({ ...r, thong_tin: JSON.parse(r.thong_tin), noi_dung: JSON.parse(r.noi_dung) });

export function layDeThi(id: number): DeThi | undefined {
  const r = layDb().prepare('SELECT * FROM de_thi WHERE id = ?').get(id) as DongDeThi | undefined;
  return r && docDong(r);
}

export function dsDeThi() {
  const rows = layDb()
    .prepare(
      `SELECT d.*, m.ten AS mon_ten, t.ma AS truong_ma, md.ten AS mau_ten
       FROM de_thi d LEFT JOIN mon m ON m.id = d.mon_id LEFT JOIN truong t ON t.id = d.truong_id
       LEFT JOIN mau_de md ON md.id = d.mau_de_id ORDER BY d.id DESC`,
    )
    .all() as (DongDeThi & { mon_ten: string | null; truong_ma: string | null; mau_ten: string | null })[];
  return rows.map((r) => {
    const d = docDong(r);
    return {
      id: d.id,
      ten_file: d.ten_file,
      tao_luc: d.tao_luc,
      mon_ten: r.mon_ten,
      truong_ma: r.truong_ma,
      mau_ten: r.mau_ten,
      lop: d.thong_tin.lop,
      so_de: d.noi_dung.length,
      so_cau: d.noi_dung[0]?.cau.length ?? 0,
    };
  });
}

export function xoaDeThi(id: number) {
  layDb().prepare('DELETE FROM de_thi WHERE id = ?').run(id);
}

// Dữ liệu điền mẫu Word từ đề đã lưu
export function duLieuMau(d: Pick<DeThi, 'thong_tin' | 'noi_dung'>): DuLieuMau {
  const t = d.thong_tin;
  const caiDat = layCaiDat();
  return {
    truong: t.truong,
    truong_in_hoa: t.truong.toLocaleUpperCase('vi'),
    dia_danh: t.dia_danh || 'Hà Nội',
    hoc_phan: t.hoc_phan,
    ma_hoc_phan: t.ma_hoc_phan,
    nganh: t.nganh,
    trinh_do: t.trinh_do,
    lop: t.lop,
    lop_van_hoa: t.lop_van_hoa,
    nam_hoc: t.nam_hoc,
    hoc_ky: t.hoc_ky,
    hinh_thuc: t.hinh_thuc,
    thoi_gian: String(t.thoi_gian),
    ngay_thi: t.ngay_thi,
    tai_lieu: t.tai_lieu ? 'được' : 'không được',
    ten_gv: caiDat.ten_gv,
    ma_gv: caiDat.ma_gv,
    so_de_thi: d.noi_dung.length,
    de: d.noi_dung.map((de) => ({
      so_de: String(de.so_de).padStart(2, '0'),
      tong_diem: dinhDangDiem(de.cau.reduce((s, c) => s + c.diem, 0)),
      cau: de.cau.map((c, i) => ({ so: i + 1, diem: dinhDangDiem(c.diem), noi_dung: c.noi_dung, dap_an: c.dap_an })),
    })),
  };
}

export function fileDeThi(id: number): { tenFile: string; buffer: Buffer } {
  const d = layDeThi(id);
  if (!d) throw new LoiApp(404, 'Không tìm thấy đề thi');
  // Mẫu đã bị xóa thì dùng mẫu của trường / mẫu chung
  const mau = (d.mau_de_id ? layMauDe(d.mau_de_id) : undefined) ?? mauChoTruong(d.truong_id);
  if (!mau) throw new LoiApp(404, 'Không còn mẫu đề nào để in');
  return { tenFile: d.ten_file, buffer: dienMau(docTepMau(mau), duLieuMau(d)) };
}
