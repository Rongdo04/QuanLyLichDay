// Kiểu dữ liệu trả về từ API (tiền: nghìn đồng, ngày: 'YYYY-MM-DD')

export type TrangThai = 'dang_day' | 'hoan_thanh' | 'tam_dung';
export type DuKien = 'S' | 'C' | 'SC';

export interface Truong {
  id: number;
  ma: string;
  ten: string;
  ghi_chu: string | null;
  da_an: number;
  so_lop: number;
}

export interface DiaDiem {
  id: number;
  ten_ngan: string;
  ten_day_du: string | null;
  tien_dc: number;
  so_lop: number;
}

export interface TongTien {
  soBuoi: number;
  tienDay: number;
  tienDc: number;
  tong: number;
}

export interface SoLieuLop extends TongTien {
  soNgayDay: number;
  tienDo: number | null;
}

export interface Lop {
  id: number;
  truong_id: number;
  dia_diem_id: number | null;
  ten_sheet: string;
  ma_lop: string | null;
  lop_van_hoa: string | null;
  hoc_phan: string;
  so_buoi_ke_hoach: number | null;
  don_gia: number;
  lich_phan_cong: string | null;
  lich_tuan: string | null; // JSON {"4":"C","7":"SC"}
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
  trang_thai: TrangThai;
  thu_tu: number;
  tao_luc: string;
  truong_ma: string;
  truong_ten: string;
  dia_diem_ten: string | null;
  dia_diem_ten_day_du: string | null;
  tien_dc_dia_diem: number | null;
}

export type LopThongKe = Lop & SoLieuLop & { soNgay: number };

export interface Buoi {
  id: number;
  lop_id: number;
  ngay: string;
  sang: number;
  chieu: number;
  co_tien_dc: number;
  ghi_chu: string | null;
  du_kien: DuKien | null;
}

export type LopChiTiet = LopThongKe & { buoi: Buoi[] };

export interface BuoiDayDu extends Buoi {
  ten_sheet: string;
  hoc_phan: string;
  don_gia: number;
  truong_id: number;
  truong_ma: string;
  dia_diem_ten: string | null;
  tien_dc_dia_diem: number | null;
}

export type SuaBuoi = Partial<Pick<Buoi, 'ngay' | 'sang' | 'chieu' | 'co_tien_dc' | 'ghi_chu' | 'du_kien'>>;

export interface DuLieuLop {
  truong_id: number;
  dia_diem_id: number | null;
  ten_sheet: string;
  ma_lop: string | null;
  lop_van_hoa: string | null;
  hoc_phan: string;
  so_buoi_ke_hoach: number | null;
  don_gia: number;
  lich_phan_cong: string | null;
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
  trang_thai: TrangThai;
  thu_tu?: number;
  lich_tuan?: Record<string, DuKien> | null; // gửi lên dạng object
}

// Kết quả tạo lớp: kèm số ngày đã tự sinh theo lịch tuần
export type LopVuaTao = Lop & { so_ngay_sinh: number; ngay_bo_qua?: { ngay: string; ly_do: string }[] };

export interface NgayNghi {
  tu: string;
  den: string | null;
  ten: string | null;
}

export interface CaiDat {
  ten_gv: string;
  ma_gv: string;
  sdt: string;
  gio_sang: string;
  gio_chieu: string;
  nam_hoc: string;
  ngay_nghi: NgayNghi[];
  thu_muc_sao_luu: string;
}

export interface NgaySinh {
  ngay: string;
  thu: string;
  du_kien: DuKien;
}

export interface KetQuaXemTruocLich {
  ngay: NgaySinh[];
  boQua: { ngay: string; thu: string; ly_do: string }[];
  soNgay: number;
  tongBuoi: number;
}

export interface ThamSoSinhLich {
  batDau: string;
  ketThuc?: string | null;
  soBuoi?: number | null;
  thu: Partial<Record<string, DuKien>>;
  boQuaNgayNghi: boolean;
}

export interface LopTrongThongKe extends SoLieuLop {
  id: number;
  ten_sheet: string;
  hoc_phan: string;
  ma_lop: string | null;
  don_gia: number;
  so_buoi_ke_hoach: number | null;
  trang_thai: TrangThai;
  dia_diem_ten: string | null;
  soNgay: number;
}

export interface ThongKe {
  tu: string | null;
  den: string | null;
  tong: TongTien;
  truong: (TongTien & { id: number; ma: string; ten: string; lop: LopTrongThongKe[] })[];
}

export interface ThongKeThang {
  namHoc: string;
  tu: string;
  den: string;
  truong: { id: number; ma: string; ten: string }[];
  thang: { thang: string; nhan: string; theoTruong: Record<number, TongTien>; tong: TongTien }[];
  tong: TongTien;
}

export interface BanSaoLuu {
  ten: string;
  duong_dan: string;
  kich_thuoc: number;
  luc: string;
}

export interface DongNhap {
  ngay: string;
  sang: boolean;
  chieu: boolean;
  ghi_chu_goc: string | null;
}

export interface SheetNhap {
  ten_sheet_goc: string;
  ten_sheet: string;
  trang_thai: 'dang_day' | 'hoan_thanh';
  hoc_phan: string;
  ma_lop: string | null;
  lop_van_hoa: string | null;
  so_buoi_ke_hoach: number | null;
  don_gia: number | null;
  lich_phan_cong: string | null;
  dia_diem_goi_y: string | null;
  dia_diem_ten_day_du: string | null;
  dia_diem_id: number | null;
  buoi: DongNhap[];
  so_ngay: number;
  so_buoi: number;
  canh_bao: string[];
}

export interface KetQuaPhanTich {
  hash: string;
  ten_file: string;
  goi_y_truong: string | null;
  truong_id: number | null;
  da_nhap: { ten_file: string; nhap_luc: string }[];
  sheets: SheetNhap[];
  bo_qua: { ten_sheet: string; ly_do: string }[];
}

export type XuLyTrung = 'bo_qua' | 'ghi_de' | 'tao_moi';

export interface SheetXacNhan {
  ten_sheet: string;
  hoc_phan: string;
  ma_lop: string | null;
  lop_van_hoa: string | null;
  so_buoi_ke_hoach: number | null;
  don_gia: number;
  lich_phan_cong: string | null;
  trang_thai: TrangThai;
  dia_diem_id: number | null;
  dia_diem_moi: { ten_ngan: string; ten_day_du: string | null } | null;
  dia_diem_goi_y: string | null;
  xu_ly_trung: XuLyTrung | null;
  buoi: DongNhap[];
}

export interface KetQuaNhap {
  tao_moi: number;
  ghi_de: number;
  bo_qua: number;
  so_ngay: number;
  lop: { id: number; ten_sheet: string; hanh_dong: string }[];
}

export interface LichSuNhap {
  id: number;
  hash: string;
  ten_file: string;
  truong_id: number | null;
  truong_ma: string | null;
  so_lop: number;
  nhap_luc: string;
}

// ---------------------------------------------------------------------------
// Đề thi

export type MucDo = 'de' | 'tb' | 'kho';

export interface Mon {
  id: number;
  ten: string;
  ma: string | null;
  nganh: string;
  trinh_do: string;
  de_cuong: string | null;
  tao_luc: string;
  so_cau: number;
  so_lop: number;
}

export interface CauHoi {
  id: number;
  mon_id: number;
  chu_de: string | null;
  muc_do: MucDo;
  diem: number | null;
  noi_dung: string;
  dap_an: string;
  nguon: 'tay' | 'ai';
  so_lan_dung: number;
  lan_dung_cuoi: string | null;
  tao_luc: string;
}

export type DuLieuCauHoi = Pick<CauHoi, 'chu_de' | 'muc_do' | 'diem' | 'noi_dung' | 'dap_an'> & { nguon?: 'tay' | 'ai' };
export type DuLieuMon = Pick<Mon, 'ten' | 'ma' | 'nganh' | 'trinh_do' | 'de_cuong'>;

export interface CauTachDuoc {
  noi_dung: string;
  dap_an: string;
  diem: number | null;
}

export interface CauAiSoan {
  chu_de: string | null;
  muc_do: MucDo;
  diem: number;
  noi_dung: string;
  dap_an: string;
}

export interface YeuCauAiSoan {
  so_cau: number;
  diem: number[];
  muc_do: MucDo | 'tron';
  chu_de: string | null;
  yeu_cau_them: string | null;
}

export interface MauDe {
  id: number;
  ten: string;
  truong_id: number | null;
  truong_ma: string | null;
  truong_ten: string | null;
  co_san: number;
  cau_truc: number[];
  thoi_gian: number;
  tao_luc: string;
}

export interface ODienMau {
  o: string;
  mo_ta: string;
}

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
  tai_lieu: boolean;
}

export interface OCau {
  diem: number;
  muc_do: MucDo | null;
}

export interface GoiYDeThi {
  thong_tin: ThongTinDe;
  mon_id: number | null;
  truong_id: number | null;
  mau_de_id: number | null;
  cau_truc: OCau[];
}

export interface CauNganHangRutGon {
  id: number;
  chu_de: string | null;
  muc_do: MucDo;
  diem: number | null;
  noi_dung: string;
  dap_an: string;
  so_lan_dung: number;
}

export interface DeDaBoc {
  so_de: number;
  cau: { cau_hoi_id: number; diem: number }[];
}

export interface KetQuaXemTruocDe {
  de: DeDaBoc[];
  canh_bao: string[];
  ngan_hang: CauNganHangRutGon[];
}

export interface DeThiTomTat {
  id: number;
  ten_file: string;
  tao_luc: string;
  mon_ten: string | null;
  truong_ma: string | null;
  mau_ten: string | null;
  lop: string;
  so_de: number;
  so_cau: number;
}

export type MaNhaCungCap = 'gemini' | 'claude';

export interface NhaCungCapAi {
  ma: MaNhaCungCap;
  ten: string;
  mo_hinh: string;
  mien_phi: boolean;
  co_khoa: boolean;
  nguon: 'cai_dat' | 'moi_truong' | null;
  khoa_an: string | null;
}

export interface TrangThaiAi {
  dang_dung: MaNhaCungCap;
  co_khoa: boolean;
  mo_hinh: string;
  ten: string;
  nha_cung_cap: NhaCungCapAi[];
}
