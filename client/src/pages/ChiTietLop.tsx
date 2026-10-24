import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, khoa } from '../api';
import type { DuLieuLop, Lop, TrangThai } from '../api/types';
import { BaoLoiTai, DangTai, Modal, NhanTrangThai, ThanhTienDo } from '../components/ChungUI';
import { TrinhSinhLich } from '../components/TrinhSinhLich';
import { dinhDangNgay, dinhDangTien, NHAN_TRANG_THAI } from '../lib/format';
import { useDsDiaDiem, useDsLop, useDsTruong } from '../lib/hooks';
import { thongBao } from '../lib/thongBao';

// Form dùng chuỗi cho mọi ô nhập, đổi sang số / null khi lưu
interface FormLop {
  truong_id: string;
  dia_diem_id: string;
  ten_sheet: string;
  ma_lop: string;
  lop_van_hoa: string;
  hoc_phan: string;
  so_buoi_ke_hoach: string;
  don_gia: string;
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
  so_buoi_ke_hoach: '',
  don_gia: '',
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
  so_buoi_ke_hoach: l.so_buoi_ke_hoach ? String(l.so_buoi_ke_hoach) : '',
  don_gia: String(l.don_gia),
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
    so_buoi_ke_hoach: f.so_buoi_ke_hoach ? Number(f.so_buoi_ke_hoach) : null,
    don_gia: Number(f.don_gia),
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

  // Dữ liệu lớp thay đổi (vừa lưu, vừa sinh lịch…) → cập nhật các ô chưa sửa, giữ nguyên ô đang sửa
  useEffect(() => {
    if (!lop) return;
    setForm((cu) => {
      const moi = tuLop(lop);
      if (cu) daSua.current.forEach((k) => Object.assign(moi, { [k]: cu[k] }));
      return moi;
    });
  }, [lop]);

  const luu = useMutation({
    mutationFn: (f: FormLop) => (laMoi ? api.lop.tao(sangDuLieu(f)) : api.lop.sua(id!, sangDuLieu(f))),
    onSuccess: (l) => {
      daSua.current.clear();
      qc.invalidateQueries();
      if (laMoi) {
        thongBao(`Đã tạo lớp "${l.ten_sheet}". Tiếp theo: sinh lịch dạy.`);
        navigate(`/lop/${l.id}?sinh-lich=1`, { replace: true });
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

  if (!laMoi && isLoading) return <DangTai />;
  if (!laMoi && (error || !lop)) return <BaoLoiTai loi={error ?? new Error('Không tìm thấy lớp')} />;
  if (!form) return <DangTai />;

  const doi = (k: keyof FormLop, v: string) => {
    daSua.current.add(k);
    const moi = { ...form, [k]: v };
    // Lớp mới: chọn trường thì gợi ý đơn giá, địa điểm theo lớp gần nhất của trường đó
    if (laMoi && k === 'truong_id' && v) {
      const ganNhat = dsLop?.filter((l) => l.truong_id === Number(v)).at(-1);
      if (ganNhat) {
        if (!form.don_gia) moi.don_gia = String(ganNhat.don_gia);
        if (!form.dia_diem_id && ganNhat.dia_diem_id) moi.dia_diem_id = String(ganNhat.dia_diem_id);
      }
    }
    setForm(moi);
  };
  const loiSheet = loiTenSheet(form.ten_sheet);
  const guiForm = (e: FormEvent) => {
    e.preventDefault();
    if (!loiSheet) luu.mutate(form);
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
            <O
              nhan="Đơn giá (nghìn đồng / buổi)"
              id="don-gia"
              goiY={form.don_gia ? `= ${dinhDangTien(Number(form.don_gia) || 0)} / buổi` : 'VD: 400 = 400.000 đ'}
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
          <O nhan="Lịch phân công" id="lich-phan-cong" goiY="Hiện ở khối thông tin trong file Excel. Trình sinh lịch có thể tự điền.">
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
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Link className="btn-phu" to="/lop">
              {laMoi ? 'Hủy' : 'Quay lại'}
            </Link>
            <button className="btn-chinh" disabled={luu.isPending || !!loiSheet}>
              {luu.isPending ? 'Đang lưu…' : laMoi ? 'Tạo lớp và sinh lịch' : 'Lưu thay đổi'}
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
