import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, khoa } from '../api';
import type { DuLieuLop, Lop, TinhTheo, TrangThai } from '../api/types';
import { BaoLoiTai, DangTai, Modal, NhanTrangThai, ThanhTienDo } from '../components/ChungUI';
import { ChonThuTrongTuan, docLichTuan, lichTuanGui } from '../components/ChonThuTrongTuan';
import { TrinhSinhLich } from '../components/TrinhSinhLich';
import { dinhDangNgay, dinhDangTien, donViGia, NHAN_TRANG_THAI } from '../lib/format';
import { useDsDiaDiem, useDsLop, useDsTruong } from '../lib/hooks';
import { phanTichLichPhanCong, sinhLichChiTiet, soBuoiTheoDuKien, type LichTheoThu } from '../lib/nghiepVu';
import { thongBao } from '../lib/thongBao';

// Form dùng chuỗi cho mọi ô nhập, đổi sang số / null khi lưu
interface FormLop {
  truong_id: string;
  dia_diem_id: string;
  ten_sheet: string;
  ma_lop: string;
  lop_van_hoa: string;
  hoc_phan: string;
  so_tiet: string;
  so_buoi_ke_hoach: string;
  don_gia: string;
  tinh_theo: TinhTheo;
  tiet_moi_buoi: string; // '' = lấy theo Cài đặt
  lich_phan_cong: string;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  trang_thai: TrangThai;
  thu_tu: string;
}

const formRong = (truongId = ''): FormLop => ({
  truong_id: truongId,
  dia_diem_id: '',
  ten_sheet: '',
  ma_lop: '',
  lop_van_hoa: '',
  hoc_phan: '',
  so_tiet: '',
  so_buoi_ke_hoach: '',
  don_gia: '',
  tinh_theo: 'buoi',
  tiet_moi_buoi: '',
  lich_phan_cong: '',
  ngay_bat_dau: '',
  ngay_ket_thuc: '',
  trang_thai: 'dang_day',
  thu_tu: '',
});

const tuLop = (l: Lop): FormLop => ({
  truong_id: String(l.truong_id),
  dia_diem_id: l.dia_diem_id ? String(l.dia_diem_id) : '',
  ten_sheet: l.ten_sheet,
  ma_lop: l.ma_lop ?? '',
  lop_van_hoa: l.lop_van_hoa ?? '',
  hoc_phan: l.hoc_phan,
  so_tiet: l.so_tiet ? String(l.so_tiet) : '',
  so_buoi_ke_hoach: l.so_buoi_ke_hoach ? String(l.so_buoi_ke_hoach) : '',
  don_gia: String(l.don_gia),
  tinh_theo: l.tinh_theo,
  tiet_moi_buoi: String(l.tiet_moi_buoi),
  lich_phan_cong: l.lich_phan_cong ?? '',
  ngay_bat_dau: l.ngay_bat_dau ?? '',
  ngay_ket_thuc: l.ngay_ket_thuc ?? '',
  trang_thai: l.trang_thai,
  thu_tu: String(l.thu_tu),
});

const chuoiHoacNull = (s: string) => s.trim() || null;

function sangDuLieu(f: FormLop): DuLieuLop {
  return {
    truong_id: Number(f.truong_id),
    dia_diem_id: f.dia_diem_id ? Number(f.dia_diem_id) : null,
    ten_sheet: f.ten_sheet.trim(),
    ma_lop: chuoiHoacNull(f.ma_lop),
    lop_van_hoa: chuoiHoacNull(f.lop_van_hoa),
    hoc_phan: f.hoc_phan.trim(),
    so_tiet: f.so_tiet ? Number(f.so_tiet) : null,
    so_buoi_ke_hoach: f.so_buoi_ke_hoach ? Number(f.so_buoi_ke_hoach) : null,
    don_gia: Number(f.don_gia),
    tinh_theo: f.tinh_theo,
    ...(Number(f.tiet_moi_buoi) > 0 ? { tiet_moi_buoi: Number(f.tiet_moi_buoi) } : {}),
    lich_phan_cong: chuoiHoacNull(f.lich_phan_cong),
    ngay_bat_dau: f.ngay_bat_dau || null,
    ngay_ket_thuc: f.ngay_ket_thuc || null,
    trang_thai: f.trang_thai,
    ...(f.thu_tu !== '' ? { thu_tu: Number(f.thu_tu) } : {}),
  };
}

// Lỗi tên sheet theo quy tắc của Excel
function loiTenSheet(ten: string): string | null {
  if (ten.trim().length > 31) return 'Tên sheet tối đa 31 ký tự';
  if (/[:\\/?*[\]]/.test(ten)) return 'Không được chứa các ký tự : \\ / ? * [ ]';
  return null;
}

export function TrangChiTietLop() {
  const { id } = useParams();
  // key theo id: chuyển từ "lớp mới" sang lớp vừa tạo sẽ dựng lại trang từ đầu
  return <ChiTietLop key={id ?? 'moi'} id={id ? Number(id) : null} />;
}

function ChiTietLop({ id }: { id: number | null }) {
  const laMoi = id === null;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: lop, isLoading, error } = useQuery({
    queryKey: khoa.lop(id ?? 0),
    queryFn: () => api.lop.ct(id!),
    enabled: !laMoi,
  });
  const { data: dsTruong } = useDsTruong();
  const { data: dsDiaDiem } = useDsDiaDiem();
  const { data: dsLop } = useDsLop();
  const [form, setForm] = useState<FormLop | null>(laMoi ? formRong(params.get('truong') ?? '') : null);
  const [moSinhLich, setMoSinhLich] = useState(params.get('sinh-lich') === '1');
  // Các ô người dùng đã sửa mà chưa lưu
  const daSua = useRef(new Set<keyof FormLop>());
  // Lịch dạy hằng tuần (thứ + sáng/chiều); lớp cũ chưa có thì đọc từ "Lịch phân công"
  const [thu, setThu] = useState<LichTheoThu>({});
  const daSuaThu = useRef(false);
  const { data: caiDat } = useQuery({ queryKey: khoa.caiDat, queryFn: api.caiDat.lay });

  // Dữ liệu lớp thay đổi (vừa lưu, vừa sinh lịch…) → cập nhật các ô chưa sửa, giữ nguyên ô đang sửa
  useEffect(() => {
    if (!lop) return;
    setForm((cu) => {
      const moi = tuLop(lop);
      if (cu) daSua.current.forEach((k) => Object.assign(moi, { [k]: cu[k] }));
      return moi;
    });
    if (!daSuaThu.current) {
      const luu = docLichTuan(lop.lich_tuan);
      setThu(Object.keys(luu).length ? luu : phanTichLichPhanCong(lop.lich_phan_cong).thu);
    }
  }, [lop]);

  const luu = useMutation({
    mutationFn: async (f: FormLop) => {
      const d = { ...sangDuLieu(f), lich_tuan: lichTuanGui(thu) };
      return laMoi ? api.lop.tao(d) : { ...(await api.lop.sua(id!, d)), so_ngay_sinh: 0 };
    },
    onSuccess: (l) => {
      daSua.current.clear();
      daSuaThu.current = false;
      qc.invalidateQueries();
      if (laMoi) {
        if (l.so_ngay_sinh > 0) {
          thongBao(`Đã tạo lớp "${l.ten_sheet}" và ${l.so_ngay_sinh} ngày dạy. Có thể chấm buổi ngay.`);
          navigate(`/lop/${l.id}`, { replace: true });
        } else {
          thongBao(`Đã tạo lớp "${l.ten_sheet}". Tiếp theo: sinh lịch dạy.`);
          navigate(`/lop/${l.id}?sinh-lich=1`, { replace: true });
        }
      } else {
        setForm(tuLop(l));
        thongBao('Đã lưu thay đổi');
      }
    },
  });
  const nhanBan = useMutation({
    mutationFn: () => api.lop.nhanBan(id!),
    onSuccess: (l) => {
      qc.invalidateQueries();
      thongBao(`Đã nhân bản thành "${l.ten_sheet}". Hãy sửa học phần cho lớp mới.`);
      navigate(`/lop/${l.id}`);
    },
  });
  const xoa = useMutation({
    mutationFn: () => api.lop.xoa(id!),
    onSuccess: () => {
      qc.invalidateQueries();
      thongBao('Đã xóa lớp');
      navigate('/lop');
    },
  });

  // Xem trước số ngày sẽ tự sinh khi tạo lớp (cùng thuật toán với server)
  const coThu = Object.values(thu).some(Boolean);
  const xemTruocLich = useMemo(() => {
    if (!laMoi || !form || !coThu || !form.ngay_bat_dau) return null;
    const soBuoi = Number(form.so_buoi_ke_hoach) || null;
    if (!form.ngay_ket_thuc && !soBuoi) return null;
    if (form.ngay_ket_thuc && form.ngay_ket_thuc < form.ngay_bat_dau) return null;
    const { ngay, boQua } = sinhLichChiTiet({
      batDau: form.ngay_bat_dau,
      ketThuc: form.ngay_ket_thuc || null,
      soBuoi,
      thu,
      ngayNghi: caiDat?.ngay_nghi ?? [],
    });
    return { ngay, boQua, soBuoi: ngay.reduce((s, n) => s + soBuoiTheoDuKien(n.du_kien), 0) };
  }, [laMoi, form, coThu, thu, caiDat]);

  if (!laMoi && isLoading) return <DangTai />;
  if (!laMoi && (error || !lop)) return <BaoLoiTai loi={error ?? new Error('Không tìm thấy lớp')} />;
  if (!form) return <DangTai />;

  const tietMoiBuoi = Number(form.tiet_moi_buoi) || caiDat?.tiet_moi_buoi || 5;
  const doi = (k: keyof FormLop, v: string) => {
    daSua.current.add(k);
    const moi = { ...form, [k]: v };
    // Nhập số tiết thì tự quy ra số buổi kế hoạch (làm tròn lên), vẫn sửa tay được
    if (k === 'so_tiet' && Number(v) > 0) moi.so_buoi_ke_hoach = String(Math.ceil(Number(v) / tietMoiBuoi));
    if (k === 'tiet_moi_buoi' && Number(v) > 0 && Number(form.so_tiet) > 0)
      moi.so_buoi_ke_hoach = String(Math.ceil(Number(form.so_tiet) / Number(v)));
    // Lớp mới: chọn trường thì gợi ý đơn giá, địa điểm theo lớp gần nhất của trường đó
    if (laMoi && k === 'truong_id' && v) {
      const ganNhat = dsLop?.filter((l) => l.truong_id === Number(v)).at(-1);
      if (ganNhat) {
        if (!form.don_gia) {
          moi.don_gia = String(ganNhat.don_gia);
          moi.tinh_theo = ganNhat.tinh_theo;
        }
        if (!form.dia_diem_id && ganNhat.dia_diem_id) moi.dia_diem_id = String(ganNhat.dia_diem_id);
      }
    }
    setForm(moi);
  };
  const loiSheet = loiTenSheet(form.ten_sheet);
  // Lớp mới có chọn thứ: cần đủ mốc để tự sinh lịch
  const loiLich =
    laMoi && coThu
      ? !form.ngay_bat_dau
        ? 'Nhập ngày bắt đầu để tự sinh lịch'
        : !form.ngay_ket_thuc && !form.so_buoi_ke_hoach
          ? 'Nhập ngày kết thúc hoặc số buổi kế hoạch để biết sinh lịch đến khi nào'
          : form.ngay_ket_thuc && form.ngay_ket_thuc < form.ngay_bat_dau
            ? 'Ngày kết thúc phải sau ngày bắt đầu'
            : null
      : null;
  const doiThu = (t: LichTheoThu) => {
    daSuaThu.current = true;
    setThu(t);
  };
  const guiForm = (e: FormEvent) => {
    e.preventDefault();
    if (!loiSheet && !loiLich) luu.mutate(form);
  };
  const dongSinhLich = () => {
    setMoSinhLich(false);
    if (params.has('sinh-lich')) setParams({}, { replace: true });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm">
            <Link className="lien-ket" to="/lop">
              Lớp học
            </Link>{' '}
            <span className="text-slate-400">/</span>
          </div>
          <h1 className="flex items-center gap-2">
            {laMoi ? 'Thêm lớp mới' : lop!.ten_sheet}
            {!laMoi && <NhanTrangThai trangThai={lop!.trang_thai} />}
          </h1>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <form onSubmit={guiForm} className="the space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <O nhan="Trường" id="truong">
              <select id="truong" className="o-nhap" required value={form.truong_id} onChange={(e) => doi('truong_id', e.target.value)}>
                <option value="">— Chọn trường —</option>
                {dsTruong
                  ?.filter((t) => !t.da_an || String(t.id) === form.truong_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ma} — {t.ten}
                    </option>
                  ))}
              </select>
            </O>
            <O nhan="Địa điểm dạy (quyết định tiền DC)" id="dia-diem">
              <select id="dia-diem" className="o-nhap" value={form.dia_diem_id} onChange={(e) => doi('dia_diem_id', e.target.value)}>
                <option value="">Không có (không tính tiền DC)</option>
                {dsDiaDiem?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.ten_ngan} — DC {dinhDangTien(d.tien_dc)}/ngày
                  </option>
                ))}
              </select>
            </O>
            <O
              nhan="Tên sheet trong file Excel"
              id="ten-sheet"
              goiY={loiSheet ?? `${form.ten_sheet.trim().length}/31 ký tự`}
              loi={!!loiSheet}
            >
              <input
                id="ten-sheet"
                className={`o-nhap ${loiSheet ? 'border-red-400' : ''}`}
                required
                placeholder="VD: AutoCad_TT"
                value={form.ten_sheet}
                onChange={(e) => doi('ten_sheet', e.target.value)}
              />
            </O>
            <O nhan="Học phần" id="hoc-phan">
              <input
                id="hoc-phan"
                className="o-nhap"
                required
                placeholder="VD: Vẽ kỹ thuật và Autocad"
                value={form.hoc_phan}
                onChange={(e) => doi('hoc_phan', e.target.value)}
              />
            </O>
            <O nhan="Mã lớp" id="ma-lop">
              <input id="ma-lop" className="o-nhap" placeholder="VD: CT.10T1" value={form.ma_lop} onChange={(e) => doi('ma_lop', e.target.value)} />
            </O>
            <O nhan="Lớp văn hóa" id="lop-van-hoa">
              <input
                id="lop-van-hoa"
                className="o-nhap"
                placeholder="VD: 11A6"
                value={form.lop_van_hoa}
                onChange={(e) => doi('lop_van_hoa', e.target.value)}
              />
            </O>
            <O
              nhan="Số tiết"
              id="so-tiet"
              goiY={
                Number(form.so_tiet) > 0
                  ? `≈ ${Math.ceil(Number(form.so_tiet) / tietMoiBuoi)} buổi (${tietMoiBuoi} tiết / buổi)`
                  : `${tietMoiBuoi} tiết / buổi`
              }
            >
              <input
                id="so-tiet"
                type="number"
                min={1}
                className="o-nhap"
                placeholder="VD: 45"
                value={form.so_tiet}
                onChange={(e) => doi('so_tiet', e.target.value)}
              />
            </O>
            <O nhan="Số buổi kế hoạch" id="so-buoi" goiY="1 buổi = 1 ô sáng hoặc chiều">
              <input
                id="so-buoi"
                type="number"
                min={1}
                className="o-nhap"
                value={form.so_buoi_ke_hoach}
                onChange={(e) => doi('so_buoi_ke_hoach', e.target.value)}
              />
            </O>
            <O nhan="Số tiết một buổi" id="tiet-moi-buoi" goiY={form.tiet_moi_buoi ? undefined : 'Mặc định theo Cài đặt'}>
              <input
                id="tiet-moi-buoi"
                type="number"
                min={1}
                max={20}
                className="o-nhap"
                placeholder={String(caiDat?.tiet_moi_buoi ?? 5)}
                value={form.tiet_moi_buoi}
                onChange={(e) => doi('tiet_moi_buoi', e.target.value)}
              />
            </O>
            <O nhan="Tính tiền theo" id="tinh-theo">
              <select id="tinh-theo" className="o-nhap" value={form.tinh_theo} onChange={(e) => doi('tinh_theo', e.target.value)}>
                <option value="buoi">Buổi</option>
                <option value="tiet">Tiết</option>
              </select>
            </O>
            <O
              nhan={`Đơn giá (nghìn đồng / ${donViGia(form)})`}
              id="don-gia"
              goiY={
                !form.don_gia
                  ? form.tinh_theo === 'tiet'
                    ? 'VD: 80 = 80.000 đ / tiết'
                    : 'VD: 400 = 400.000 đ'
                  : form.tinh_theo === 'tiet'
                    ? `= ${dinhDangTien(Number(form.don_gia) || 0)} / tiết → ${dinhDangTien((Number(form.don_gia) || 0) * tietMoiBuoi)} / buổi`
                    : `= ${dinhDangTien(Number(form.don_gia) || 0)} / buổi`
              }
            >
              <input
                id="don-gia"
                type="number"
                min={0}
                required
                className="o-nhap"
                value={form.don_gia}
                onChange={(e) => doi('don_gia', e.target.value)}
              />
            </O>
          </div>
          <O nhan="Lịch phân công" id="lich-phan-cong" goiY="Hiện ở khối thông tin trong file Excel. Để trống thì tự viết theo lịch dạy hằng tuần.">
            <input
              id="lich-phan-cong"
              className="o-nhap"
              placeholder="VD: Chiều T4 và ngày T7. Bắt đầu từ chiều thứ 4 28/10/2026"
              value={form.lich_phan_cong}
              onChange={(e) => doi('lich_phan_cong', e.target.value)}
            />
          </O>
          <div className="grid gap-3 sm:grid-cols-4">
            <O nhan="Ngày bắt đầu" id="ngay-bat-dau">
              <input id="ngay-bat-dau" type="date" className="o-nhap" value={form.ngay_bat_dau} onChange={(e) => doi('ngay_bat_dau', e.target.value)} />
            </O>
            <O nhan="Ngày kết thúc" id="ngay-ket-thuc">
              <input
                id="ngay-ket-thuc"
                type="date"
                className="o-nhap"
                min={form.ngay_bat_dau || undefined}
                value={form.ngay_ket_thuc}
                onChange={(e) => doi('ngay_ket_thuc', e.target.value)}
              />
            </O>
            <O nhan="Trạng thái" id="trang-thai">
              <select
                id="trang-thai"
                className="o-nhap"
                value={form.trang_thai}
                onChange={(e) => doi('trang_thai', e.target.value as TrangThai)}
              >
                {Object.entries(NHAN_TRANG_THAI).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </O>
            <O nhan="Thứ tự sheet" id="thu-tu" goiY={laMoi ? 'Để trống = cuối cùng' : undefined}>
              <input id="thu-tu" type="number" min={0} className="o-nhap" value={form.thu_tu} onChange={(e) => doi('thu_tu', e.target.value)} />
            </O>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="nhan">Lịch dạy hằng tuần (thứ và buổi)</div>
            <ChonThuTrongTuan thu={thu} onDoi={doiThu} goiY="Chưa chọn thứ nào — sẽ phải sinh lịch thủ công sau khi tạo lớp." />
            {laMoi ? (
              loiLich ? (
                <p className="mt-1.5 text-sm text-amber-700">{loiLich}</p>
              ) : xemTruocLich ? (
                <p className="mt-1.5 text-sm text-emerald-700">
                  Khi tạo lớp sẽ tự sinh <b>{xemTruocLich.ngay.length} ngày dạy</b> ({xemTruocLich.soBuoi} buổi dự kiến)
                  {xemTruocLich.ngay.length > 0 &&
                    `, từ ${dinhDangNgay(xemTruocLich.ngay[0].ngay)} đến ${dinhDangNgay(xemTruocLich.ngay.at(-1)!.ngay)}`}
                  {xemTruocLich.boQua.length > 0 && `; bỏ qua ${xemTruocLich.boQua.length} ngày nghỉ lễ`}.
                  {form.ngay_ket_thuc && form.so_buoi_ke_hoach ? ' Dừng ở mốc đến trước: ngày kết thúc hoặc đủ số buổi kế hoạch.' : ''}
                </p>
              ) : null
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Sửa lịch tuần không tự đổi các ngày đã có. Muốn thêm ngày theo lịch mới, bấm "Sinh thêm ngày".
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Link className="btn-phu" to="/lop">
              {laMoi ? 'Hủy' : 'Quay lại'}
            </Link>
            <button className="btn-chinh" disabled={luu.isPending || !!loiSheet || !!loiLich}>
              {luu.isPending ? 'Đang lưu…' : laMoi ? (coThu ? 'Tạo lớp và sinh lịch' : 'Tạo lớp') : 'Lưu thay đổi'}
            </button>
          </div>
        </form>

        {!laMoi && lop && (
          <aside className="space-y-4">
            <div className="the space-y-3 p-4">
              <div>
                <div className="text-xs text-slate-500">Tiến độ</div>
                <div className="mt-1">
                  <ThanhTienDo da={lop.soBuoi} keHoach={lop.so_buoi_ke_hoach} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-500">Số ngày trong lịch</div>
                <div className="text-right tabular-nums">{lop.soNgay}</div>
                <div className="text-slate-500">Tiền dạy</div>
                <div className="text-right tabular-nums">{dinhDangTien(lop.tienDay)}</div>
                <div className="text-slate-500">Tiền DC</div>
                <div className="text-right tabular-nums">{dinhDangTien(lop.tienDc)}</div>
                <div className="font-medium">Tổng</div>
                <div className="text-right font-semibold tabular-nums text-blue-700">{dinhDangTien(lop.tong)}</div>
                {lop.thue_truong > 0 && (
                  <>
                    <div className="text-slate-500">Thuế {lop.thue_truong}% (trên tiền dạy)</div>
                    <div className="text-right tabular-nums">{dinhDangTien(lop.tienThue)}</div>
                    <div className="font-medium">Kể cả thuế</div>
                    <div className="text-right font-semibold tabular-nums">{dinhDangTien(lop.tongCoThue)}</div>
                  </>
                )}
              </div>
              {lop.buoi.length > 0 && (
                <div className="text-xs text-slate-500">
                  Lịch từ {dinhDangNgay(lop.buoi[0].ngay)} đến {dinhDangNgay(lop.buoi.at(-1)!.ngay)}
                </div>
              )}
            </div>
            <div className="the flex flex-col gap-2 p-4">
              <Link className="btn-chinh" to={`/cham-buoi?lop=${lop.id}`}>
                Mở chấm buổi
              </Link>
              <button className="btn-phu" onClick={() => setMoSinhLich(true)}>
                Sinh thêm ngày
              </button>
              <button className="btn-phu" onClick={() => nhanBan.mutate()} disabled={nhanBan.isPending}>
                Nhân bản lớp (học phần mới)
              </button>
              <button
                className="btn-nguy"
                disabled={xoa.isPending}
                onClick={() =>
                  confirm(
                    `Xóa lớp "${lop.ten_sheet}"${lop.soNgay ? ` và ${lop.soNgay} ngày dạy của lớp` : ''}? Không thể hoàn tác.`,
                  ) && xoa.mutate()
                }
              >
                Xóa lớp
              </button>
            </div>
          </aside>
        )}
      </div>

      {!laMoi && lop && (
        <Modal mo={moSinhLich} tieuDe={`Sinh lịch — ${lop.ten_sheet}`} onDong={dongSinhLich} rong="max-w-3xl">
          <TrinhSinhLich lop={lop} onXong={dongSinhLich} />
        </Modal>
      )}
    </>
  );
}

function O({ nhan, id, goiY, loi, children }: { nhan: string; id: string; goiY?: string; loi?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="nhan" htmlFor={id}>
        {nhan}
      </label>
      {children}
      {goiY && <p className={`mt-1 text-xs ${loi ? 'text-red-600' : 'text-slate-500'}`}>{goiY}</p>}
    </div>
  );
}
