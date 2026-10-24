import { chuoiQuery, goiApi } from './client';
import type {
  BanSaoLuu,
  CauAiSoan,
  CauHoi,
  CauTachDuoc,
  DeThiTomTat,
  DuLieuCauHoi,
  DuLieuMon,
  GoiYDeThi,
  KetQuaXemTruocDe,
  MauDe,
  Mon,
  OCau,
  ODienMau,
  ThongTinDe,
  TrangThaiAi,
  YeuCauAiSoan,
  Buoi,
  BuoiDayDu,
  CaiDat,
  DiaDiem,
  DuLieuLop,
  KetQuaNhap,
  KetQuaPhanTich,
  KetQuaXemTruocLich,
  LichSuNhap,
  Lop,
  LopChiTiet,
  LopThongKe,
  NgaySinh,
  SheetXacNhan,
  SuaBuoi,
  ThamSoSinhLich,
  ThongKe,
  ThongKeThang,
  TrangThai,
  Truong,
} from './types';

export interface LocLop {
  truongId?: number;
  trangThai?: TrangThai;
}
export interface LocBuoi {
  tu?: string;
  den?: string;
  truongId?: number;
  lopId?: number;
}
export interface LocThongKe {
  tu?: string;
  den?: string;
  truongId?: number;
}

// Khóa cache của TanStack Query
export const khoa = {
  truong: ['truong'] as const,
  diaDiem: ['dia-diem'] as const,
  dsLop: (loc: LocLop = {}) => ['lop', 'ds', loc] as const,
  lop: (id: number) => ['lop', 'ct', id] as const,
  buoi: (loc: LocBuoi) => ['buoi', loc] as const,
  thongKe: (loc: LocThongKe) => ['thong-ke', 'ky', loc] as const,
  thongKeThang: (namHoc?: string) => ['thong-ke', 'thang', namHoc ?? ''] as const,
  caiDat: ['cai-dat'] as const,
  saoLuu: ['sao-luu'] as const,
  lichSuNhap: ['nhap', 'lich-su'] as const,
  dsMon: ['mon', 'ds'] as const,
  mon: (id: number) => ['mon', 'ct', id] as const,
  mauDe: ['mau-de'] as const,
  deThi: ['de-thi'] as const,
  ai: ['ai'] as const,
};

// Gửi form có file (tên file gửi kèm để giữ đúng tiếng Việt)
function formFile(file: File, truong: Record<string, string | number | null | undefined> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(truong)) if (v !== undefined && v !== null) fd.append(k, String(v));
  fd.append('ten_file', file.name);
  fd.append('file', file);
  return fd;
}

type DuLieuMauDe = { ten: string; truong_id: number | null; cau_truc: number[]; thoi_gian: number };

type DuLieuTruong = Pick<Truong, 'ma' | 'ten' | 'ghi_chu'> & { da_an?: number };
type DuLieuDiaDiem = Pick<DiaDiem, 'ten_ngan' | 'ten_day_du' | 'tien_dc'>;

export const api = {
  truong: {
    ds: () => goiApi<Truong[]>('/truong'),
    tao: (d: DuLieuTruong) => goiApi<Truong>('/truong', { json: d }),
    sua: (id: number, d: Partial<DuLieuTruong>) => goiApi<Truong>(`/truong/${id}`, { method: 'PUT', json: d }),
    xoa: (id: number) => goiApi<void>(`/truong/${id}`, { method: 'DELETE' }),
  },
  diaDiem: {
    ds: () => goiApi<DiaDiem[]>('/dia-diem'),
    tao: (d: DuLieuDiaDiem) => goiApi<DiaDiem>('/dia-diem', { json: d }),
    sua: (id: number, d: Partial<DuLieuDiaDiem>) => goiApi<DiaDiem>(`/dia-diem/${id}`, { method: 'PUT', json: d }),
    xoa: (id: number) => goiApi<void>(`/dia-diem/${id}`, { method: 'DELETE' }),
  },
  lop: {
    ds: (loc: LocLop = {}) => goiApi<LopThongKe[]>(`/lop${chuoiQuery({ ...loc })}`),
    ct: (id: number) => goiApi<LopChiTiet>(`/lop/${id}`),
    tao: (d: DuLieuLop) => goiApi<Lop>('/lop', { json: d }),
    sua: (id: number, d: Partial<DuLieuLop>) => goiApi<Lop>(`/lop/${id}`, { method: 'PUT', json: d }),
    xoa: (id: number) => goiApi<void>(`/lop/${id}`, { method: 'DELETE' }),
    nhanBan: (id: number, d: Partial<DuLieuLop> = {}) => goiApi<Lop>(`/lop/${id}/nhan-ban`, { json: d }),
    xemTruocLich: (id: number, ts: ThamSoSinhLich) =>
      goiApi<KetQuaXemTruocLich>(`/lop/${id}/sinh-lich/xem-truoc`, { json: ts }),
    taoLich: (id: number, ngay: Pick<NgaySinh, 'ngay' | 'du_kien'>[]) =>
      goiApi<{ soMoi: number; boQua: number }>(`/lop/${id}/sinh-lich`, { json: { ngay } }),
  },
  buoi: {
    ds: (loc: LocBuoi) => goiApi<BuoiDayDu[]>(`/buoi${chuoiQuery({ ...loc })}`),
    tao: (d: { lop_id: number; ngay: string } & SuaBuoi) => goiApi<Buoi>('/buoi', { json: d }),
    sua: (id: number, d: SuaBuoi) => goiApi<Buoi>(`/buoi/${id}`, { method: 'PATCH', json: d }),
    xoa: (id: number) => goiApi<void>(`/buoi/${id}`, { method: 'DELETE' }),
  },
  thongKe: {
    ky: (loc: LocThongKe) => goiApi<ThongKe>(`/thong-ke${chuoiQuery({ ...loc })}`),
    thang: (namHoc?: string) => goiApi<ThongKeThang>(`/thong-ke/thang${chuoiQuery({ namHoc })}`),
  },
  caiDat: {
    lay: () => goiApi<CaiDat>('/cai-dat'),
    ghi: (d: Partial<CaiDat>) => goiApi<CaiDat>('/cai-dat', { method: 'PUT', json: d }),
  },
  saoLuu: {
    ds: () => goiApi<{ thu_muc: string; ban: BanSaoLuu[] }>('/sao-luu'),
    tao: () => goiApi<BanSaoLuu>('/sao-luu', { method: 'POST' }),
  },
  nhap: {
    xemTruoc: (file: File) => {
      const fd = new FormData();
      fd.append('ten_file', file.name); // gửi kèm tên file để giữ đúng tiếng Việt
      fd.append('file', file);
      return goiApi<KetQuaPhanTich>('/nhap/xem-truoc', { body: fd });
    },
    xacNhan: (d: { hash: string; ten_file: string; truong_id: number; sheets: SheetXacNhan[] }) =>
      goiApi<KetQuaNhap>('/nhap/xac-nhan', { json: d }),
    lichSu: () => goiApi<LichSuNhap[]>('/nhap/lich-su'),
  },
  mon: {
    ds: () => goiApi<{ mon: Mon[]; goi_y: string[] }>('/mon'),
    ct: (id: number) => goiApi<Mon & { cau_hoi: CauHoi[] }>(`/mon/${id}`),
    tao: (d: Partial<DuLieuMon> & { ten: string }) => goiApi<Mon>('/mon', { json: d }),
    sua: (id: number, d: Partial<DuLieuMon>) => goiApi<Mon>(`/mon/${id}`, { method: 'PUT', json: d }),
    xoa: (id: number) => goiApi<void>(`/mon/${id}`, { method: 'DELETE' }),
    themCau: (id: number, cau_hoi: DuLieuCauHoi[]) =>
      goiApi<{ so_cau: number; ids: number[] }>(`/mon/${id}/cau-hoi`, { json: { cau_hoi } }),
    tachVanBan: (id: number, van_ban: string) => goiApi<CauTachDuoc[]>(`/mon/${id}/cau-hoi/tach-van-ban`, { json: { van_ban } }),
    aiSoan: (id: number, y: YeuCauAiSoan) => goiApi<CauAiSoan[]>(`/mon/${id}/ai-soan`, { json: y }),
  },
  cauHoi: {
    sua: (id: number, d: Partial<DuLieuCauHoi>) => goiApi<CauHoi>(`/cau-hoi/${id}`, { method: 'PUT', json: d }),
    xoa: (id: number) => goiApi<void>(`/cau-hoi/${id}`, { method: 'DELETE' }),
  },
  mauDe: {
    ds: () => goiApi<{ mau: MauDe[]; o_dien: ODienMau[] }>('/mau-de'),
    tao: (file: File, d: DuLieuMauDe) =>
      goiApi<MauDe & { canh_bao: string[] }>('/mau-de', {
        body: formFile(file, { ...d, cau_truc: JSON.stringify(d.cau_truc) }),
      }),
    sua: (id: number, d: Partial<DuLieuMauDe>) => goiApi<MauDe>(`/mau-de/${id}`, { method: 'PUT', json: d }),
    thayTep: (id: number, file: File) =>
      goiApi<MauDe & { canh_bao: string[] }>(`/mau-de/${id}/tep`, { method: 'PUT', body: formFile(file) }),
    xoa: (id: number) => goiApi<void>(`/mau-de/${id}`, { method: 'DELETE' }),
    urlTai: (id: number) => `/api/mau-de/${id}/tai`,
  },
  deThi: {
    goiY: (tc: { lopId?: number; monId?: number }) => goiApi<GoiYDeThi>(`/de-thi/goi-y${chuoiQuery(tc)}`),
    xemTruoc: (d: { mon_id: number; so_de: number; cau_truc: OCau[] }) =>
      goiApi<KetQuaXemTruocDe>('/de-thi/xem-truoc', { json: d }),
    tao: (d: {
      mon_id: number;
      lop_id: number | null;
      truong_id: number | null;
      mau_de_id: number;
      thong_tin: ThongTinDe;
      de: { cau: { cau_hoi_id: number; diem: number }[] }[];
    }) => goiApi<{ id: number; ten_file: string }>('/de-thi', { json: d }),
    ds: () => goiApi<DeThiTomTat[]>('/de-thi'),
    xoa: (id: number) => goiApi<void>(`/de-thi/${id}`, { method: 'DELETE' }),
    urlTai: (id: number) => `/api/de-thi/${id}/tai`,
  },
  ai: {
    lay: () => goiApi<TrangThaiAi>('/ai'),
    ghi: (khoa: string | null) => goiApi<TrangThaiAi>('/ai', { method: 'PUT', json: { khoa } }),
  },
  // Tải file: dùng đường dẫn trực tiếp cho thẻ <a>
  xuat: {
    urlTruong: (id: number, tc: { lopIds?: number[]; tu?: string; den?: string }) =>
      `/api/xuat/truong/${id}${chuoiQuery(tc)}`,
    urlTongHop: (tc: { tu?: string; den?: string }) => `/api/xuat/tong-hop${chuoiQuery(tc)}`,
  },
};
