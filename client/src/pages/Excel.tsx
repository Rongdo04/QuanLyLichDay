import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { api, khoa } from '../api';
import type { KetQuaNhap, KetQuaPhanTich, SheetNhap, SheetXacNhan, TrangThai, XuLyTrung } from '../api/types';
import { TieuDeTrang } from '../components/ChungUI';
import { cuoiThang, dauThang, dinhDangNgay, NHAN_TRANG_THAI } from '../lib/format';
import { useDsDiaDiem, useDsLop, useDsTruong } from '../lib/hooks';
import { thongBao } from '../lib/thongBao';

export function TrangExcel() {
  return (
    <>
      <TieuDeTrang tieuDe="Xuất / Nhập Excel" phu="Xuất file đúng mẫu cũ để nộp trường, hoặc nhập dữ liệu từ các file thống kê cũ." />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <XuatTheoTruong />
        <XuatTongHop />
      </div>
      <NhapExcel />
    </>
  );
}

const ngayFile = (n: string) => n.split('-').reverse().join('.');

// Chọn nhanh khoảng ngày
function ChonKhoang({ tu, den, onDoi }: { tu: string; den: string; onDoi: (tu: string, den: string) => void }) {
  const thangNay = dayjs().format('YYYY-MM');
  const thangTruoc = dayjs().subtract(1, 'month').format('YYYY-MM');
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className="o-nhap w-40" aria-label="Từ ngày" value={tu} onChange={(e) => onDoi(e.target.value, den)} />
        <span className="text-slate-400">→</span>
        <input
          type="date"
          className="o-nhap w-40"
          aria-label="Đến ngày"
          value={den}
          min={tu || undefined}
          onChange={(e) => onDoi(tu, e.target.value)}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
        <button type="button" className="btn-phu btn-nho" onClick={() => onDoi('', '')}>
          Tất cả
        </button>
        <button type="button" className="btn-phu btn-nho" onClick={() => onDoi(dauThang(thangNay), cuoiThang(thangNay))}>
          Tháng này
        </button>
        <button type="button" className="btn-phu btn-nho" onClick={() => onDoi(dauThang(thangTruoc), cuoiThang(thangTruoc))}>
          Tháng trước
        </button>
      </div>
    </div>
  );
}

function XuatTheoTruong() {
  const { data: dsTruong } = useDsTruong();
  const { data: dsLop } = useDsLop();
  const { data: caiDat } = useQuery({ queryKey: khoa.caiDat, queryFn: api.caiDat.lay });
  const truongCoLop = (dsTruong ?? []).filter((t) => t.so_lop > 0);
  const [truongChon, setTruongChon] = useState<number | null>(null);
  const truongId = truongChon ?? truongCoLop.find((t) => !t.da_an)?.id ?? truongCoLop[0]?.id ?? null;
  const truong = dsTruong?.find((t) => t.id === truongId);
  const lopCuaTruong = (dsLop ?? []).filter((l) => l.truong_id === truongId);
  const [boChon, setBoChon] = useState<Set<number>>(new Set());
  const [tu, setTu] = useState('');
  const [den, setDen] = useState('');

  const chon = lopCuaTruong.filter((l) => !boChon.has(l.id));
  const url =
    truongId && chon.length
      ? api.xuat.urlTruong(truongId, {
          lopIds: chon.length === lopCuaTruong.length ? undefined : chon.map((l) => l.id),
          tu: tu || undefined,
          den: den || undefined,
        })
      : null;
  const ky = tu || den ? `_${tu ? ngayFile(tu) : '...'}-${den ? ngayFile(den) : '...'}` : '';
  const tenFile = truong ? `THỐNG KÊ GIẢNG DẠY TRƯỜNG ${truong.ma}_${caiDat?.nam_hoc ?? ''}${ky}.xlsx` : '';

  const doiChon = (id: number) => {
    const s = new Set(boChon);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setBoChon(s);
  };

  return (
    <section className="the">
      <div className="the-dau">
        <div>
          <h2 className="font-medium">Xuất file theo trường</h2>
          <p className="text-xs text-slate-500">Mỗi lớp một sheet, đúng bố cục file thống kê cũ.</p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {!truongCoLop.length ? (
          <p className="text-sm text-slate-500">Chưa có lớp nào để xuất.</p>
        ) : (
          <>
            <div>
              <label className="nhan" htmlFor="xuat-truong">
                Trường
              </label>
              <select
                id="xuat-truong"
                className="o-nhap"
                value={truongId ?? ''}
                onChange={(e) => {
                  setTruongChon(Number(e.target.value));
                  setBoChon(new Set());
                }}
              >
                {truongCoLop.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ma} — {t.ten} ({t.so_lop} lớp)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="nhan mb-0">Các lớp (sheet)</span>
                <button
                  type="button"
                  className="lien-ket text-xs"
                  onClick={() => setBoChon(boChon.size ? new Set() : new Set(lopCuaTruong.map((l) => l.id)))}
                >
                  {boChon.size ? 'Chọn tất cả' : 'Bỏ chọn tất cả'}
                </button>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {lopCuaTruong.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!boChon.has(l.id)} onChange={() => doiChon(l.id)} />
                    <span className="font-medium">{l.ten_sheet}</span>
                    <span className="truncate text-slate-500">— {l.hoc_phan}</span>
                    {l.trang_thai !== 'dang_day' && (
                      <span className="text-xs text-slate-400">({NHAN_TRANG_THAI[l.trang_thai].toLowerCase()})</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="nhan">Khoảng ngày (để trống = tất cả các ngày)</div>
              <ChonKhoang
                tu={tu}
                den={den}
                onDoi={(a, b) => {
                  setTu(a);
                  setDen(b);
                }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
              <span className="break-all text-xs text-slate-500">{tenFile}</span>
              {url ? (
                <a className="btn-chinh" href={url} download>
                  Tải file Excel
                </a>
              ) : (
                <button className="btn-chinh" disabled>
                  Tải file Excel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function XuatTongHop() {
  const [tu, setTu] = useState('');
  const [den, setDen] = useState('');
  return (
    <section className="the">
      <div className="the-dau">
        <div>
          <h2 className="font-medium">Xuất file tổng hợp</h2>
          <p className="text-xs text-slate-500">Sheet "Tổng hợp" theo lớp và sheet "Theo tháng" × trường.</p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="nhan">Khoảng ngày (để trống = cả năm học)</div>
          <ChonKhoang
            tu={tu}
            den={den}
            onDoi={(a, b) => {
              setTu(a);
              setDen(b);
            }}
          />
        </div>
        <div className="flex justify-end border-t border-slate-200 pt-3">
          <a className="btn-chinh" href={api.xuat.urlTongHop({ tu: tu || undefined, den: den || undefined })} download>
            Tải file tổng hợp
          </a>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Nhập file Excel cũ

interface DongSua {
  chon: boolean;
  ten_sheet: string;
  hoc_phan: string;
  don_gia: string;
  trang_thai: TrangThai;
  dia_diem: string; // '' = không có, 'moi' = tạo mới theo gợi ý, còn lại là id
  xu_ly_trung: XuLyTrung;
  goc: SheetNhap;
}

const taoDongSua = (s: SheetNhap): DongSua => ({
  chon: s.so_ngay > 0,
  ten_sheet: s.ten_sheet,
  hoc_phan: s.hoc_phan,
  don_gia: s.don_gia ? String(s.don_gia) : '',
  trang_thai: s.trang_thai,
  dia_diem: s.dia_diem_id ? String(s.dia_diem_id) : s.dia_diem_goi_y ? 'moi' : '',
  xu_ly_trung: 'bo_qua',
  goc: s,
});

function loiDong(d: DongSua): string | null {
  const ten = d.ten_sheet.trim();
  if (!ten) return 'Thiếu tên sheet';
  if (ten.length > 31) return 'Tên sheet quá 31 ký tự';
  if (/[:\\/?*[\]]/.test(ten)) return 'Tên sheet có ký tự không hợp lệ';
  if (!d.hoc_phan.trim()) return 'Thiếu học phần';
  if (d.don_gia === '' || Number(d.don_gia) < 0 || !Number.isInteger(Number(d.don_gia))) return 'Thiếu đơn giá';
  return null;
}

function NhapExcel() {
  const qc = useQueryClient();
  const { data: dsTruong } = useDsTruong();
  const { data: dsDiaDiem } = useDsDiaDiem();
  const { data: dsLop } = useDsLop();
  const { data: lichSu } = useQuery({ queryKey: khoa.lichSuNhap, queryFn: api.nhap.lichSu });
  const [phanTich, setPhanTich] = useState<KetQuaPhanTich | null>(null);
  const [dong, setDong] = useState<DongSua[]>([]);
  const [truongId, setTruongId] = useState('');
  const [ketQua, setKetQua] = useState<KetQuaNhap | null>(null);
  const [keoTha, setKeoTha] = useState(false);
  const oFile = useRef<HTMLInputElement>(null);

  const xemTruoc = useMutation({
    mutationFn: api.nhap.xemTruoc,
    onSuccess: (kq) => {
      setPhanTich(kq);
      setDong(kq.sheets.map(taoDongSua));
      setTruongId(kq.truong_id ? String(kq.truong_id) : '');
      setKetQua(null);
    },
  });

  const xacNhan = useMutation({
    mutationFn: () => {
      const sheets: SheetXacNhan[] = dong
        .filter((d) => d.chon)
        .map((d) => ({
          ten_sheet: d.ten_sheet.trim(),
          hoc_phan: d.hoc_phan.trim(),
          ma_lop: d.goc.ma_lop,
          lop_van_hoa: d.goc.lop_van_hoa,
          so_buoi_ke_hoach: d.goc.so_buoi_ke_hoach,
          don_gia: Number(d.don_gia),
          lich_phan_cong: d.goc.lich_phan_cong,
          trang_thai: d.trang_thai,
          dia_diem_id: d.dia_diem && d.dia_diem !== 'moi' ? Number(d.dia_diem) : null,
          dia_diem_moi:
            d.dia_diem === 'moi' && d.goc.dia_diem_goi_y
              ? { ten_ngan: d.goc.dia_diem_goi_y, ten_day_du: d.goc.dia_diem_ten_day_du }
              : null,
          dia_diem_goi_y: d.goc.dia_diem_goi_y,
          xu_ly_trung: d.xu_ly_trung,
          buoi: d.goc.buoi,
        }));
      return api.nhap.xacNhan({ hash: phanTich!.hash, ten_file: phanTich!.ten_file, truong_id: Number(truongId), sheets });
    },
    onSuccess: (kq) => {
      qc.invalidateQueries();
      setKetQua(kq);
      setPhanTich(null);
      setDong([]);
      thongBao(`Đã nhập: ${kq.tao_moi} lớp mới, ${kq.ghi_de} ghi đè, ${kq.so_ngay} ngày`);
    },
  });

  // Lớp đã có cùng tên sheet trong trường đang chọn
  const lopTrung = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of dsLop ?? []) if (l.truong_id === Number(truongId)) m.set(l.ten_sheet.toLowerCase(), l.id);
    return m;
  }, [dsLop, truongId]);

  const chonFile = (f: File | undefined) => {
    if (!f) return;
    xemTruoc.mutate(f);
  };
  const tha = (e: DragEvent) => {
    e.preventDefault();
    setKeoTha(false);
    chonFile(e.dataTransfer.files[0]);
  };
  const suaDong = (i: number, d: Partial<DongSua>) => setDong(dong.map((x, j) => (j === i ? { ...x, ...d } : x)));

  const dongChon = dong.filter((d) => d.chon);
  const coLoi = dongChon.some((d) => loiDong(d));
  const theXacNhan = !!truongId && dongChon.length > 0 && !coLoi;

  return (
    <section className="the mt-4">
      <div className="the-dau">
        <div>
          <h2 className="font-medium">Nhập file Excel cũ</h2>
          <p className="text-xs text-slate-500">
            Đọc các file "THỐNG KÊ GỜ GIẢNG TRƯỜNG …": mỗi sheet thành một lớp, kèm các ngày và buổi đã đánh dấu x.
          </p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {!phanTich && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setKeoTha(true);
            }}
            onDragLeave={() => setKeoTha(false)}
            onDrop={tha}
            onClick={() => oFile.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && oFile.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
              keoTha ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <div className="text-sm font-medium text-slate-700">
              {xemTruoc.isPending ? 'Đang đọc file…' : 'Kéo thả file .xlsx vào đây, hoặc bấm để chọn file'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Dữ liệu chỉ được ghi sau khi bạn xem trước và bấm Xác nhận.</div>
            <input
              ref={oFile}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                chonFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {ketQua && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="font-medium">
              Đã nhập xong: {ketQua.tao_moi} lớp mới, {ketQua.ghi_de} lớp ghi đè, {ketQua.bo_qua} bỏ qua — {ketQua.so_ngay} ngày.
            </div>
            <ul className="mt-1 list-inside list-disc">
              {ketQua.lop.map((l, i) => (
                <li key={i}>
                  <Link className="lien-ket" to={`/cham-buoi?lop=${l.id}`}>
                    {l.ten_sheet}
                  </Link>{' '}
                  — {l.hanh_dong}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phanTich && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{phanTich.ten_file}</div>
                <div className="text-xs text-slate-500">
                  {phanTich.sheets.length} sheet đọc được
                  {phanTich.bo_qua.length > 0 &&
                    ` · bỏ qua ${phanTich.bo_qua.length} sheet: ${phanTich.bo_qua.map((b) => `${b.ten_sheet} (${b.ly_do})`).join('; ')}`}
                </div>
              </div>
              <button className="btn-phu btn-nho" onClick={() => setPhanTich(null)}>
                Chọn file khác
              </button>
            </div>

            {phanTich.da_nhap.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <b>File này đã được nhập trước đây</b> (
                {phanTich.da_nhap.map((d) => `${d.ten_file} lúc ${dinhDangNgay(d.nhap_luc.slice(0, 10))} ${d.nhap_luc.slice(11, 16)}`).join('; ')}
                ). Nội dung giống hệt từng byte. Nhập lại có thể tạo dữ liệu trùng — hãy chọn "Bỏ qua" hoặc "Ghi đè" cho các lớp trùng.
              </div>
            )}

            <div className="max-w-md">
              <label className="nhan" htmlFor="nhap-truong">
                Nhập vào trường
              </label>
              <select id="nhap-truong" className="o-nhap" value={truongId} onChange={(e) => setTruongId(e.target.value)}>
                <option value="">— Chọn trường —</option>
                {dsTruong?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ma} — {t.ten}
                  </option>
                ))}
              </select>
              {phanTich.goi_y_truong && (
                <p className="mt-1 text-xs text-slate-500">
                  Gợi ý từ tên file: "{phanTich.goi_y_truong}"
                  {!phanTich.truong_id && (
                    <>
                      {' '}
                      — chưa có trường khớp, hãy chọn hoặc{' '}
                      <Link className="lien-ket" to="/truong">
                        thêm trường mới
                      </Link>
                      .
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="bang">
                <thead>
                  <tr>
                    <th className="w-10">Nhập</th>
                    <th>Tên sheet / học phần</th>
                    <th className="w-24 whitespace-nowrap text-right">Ngày · buổi</th>
                    <th className="w-24">Đơn giá</th>
                    <th className="w-40">Địa điểm</th>
                    <th className="w-36">Trạng thái</th>
                    <th className="w-32 whitespace-nowrap">Nếu đã có lớp</th>
                  </tr>
                </thead>
                <tbody>
                  {dong.map((d, i) => {
                    const loi = d.chon ? loiDong(d) : null;
                    const trung = !!truongId && lopTrung.has(d.ten_sheet.trim().toLowerCase());
                    return (
                      <tr key={i} className={d.chon ? '' : 'opacity-50'}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Nhập sheet ${d.goc.ten_sheet_goc}`}
                            checked={d.chon}
                            onChange={(e) => suaDong(i, { chon: e.target.checked })}
                          />
                        </td>
                        <td className="space-y-1">
                          <input
                            className={`o-nhap py-1 font-medium ${loi?.startsWith('Tên') ? 'border-red-400' : ''}`}
                            aria-label="Tên sheet"
                            value={d.ten_sheet}
                            onChange={(e) => suaDong(i, { ten_sheet: e.target.value })}
                          />
                          <input
                            className={`o-nhap py-1 text-xs ${loi === 'Thiếu học phần' ? 'border-red-400' : ''}`}
                            aria-label="Học phần"
                            value={d.hoc_phan}
                            onChange={(e) => suaDong(i, { hoc_phan: e.target.value })}
                          />
                          <div className="text-xs text-slate-500">
                            {[
                              d.goc.ma_lop && `Lớp ${d.goc.ma_lop}`,
                              d.goc.lop_van_hoa && `văn hóa ${d.goc.lop_van_hoa}`,
                              d.goc.so_buoi_ke_hoach && `${d.goc.so_buoi_ke_hoach} buổi KH`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {d.goc.canh_bao.length > 0 && (
                            <div className="text-xs text-amber-700">⚠ {d.goc.canh_bao.join('; ')}</div>
                          )}
                          {loi && <div className="text-xs text-red-600">{loi}</div>}
                        </td>
                        <td className="text-right tabular-nums">
                          {d.goc.so_ngay} · {d.goc.so_buoi}
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className={`o-nhap py-1 ${loi === 'Thiếu đơn giá' ? 'border-red-400' : ''}`}
                            aria-label="Đơn giá (nghìn đồng)"
                            value={d.don_gia}
                            onChange={(e) => suaDong(i, { don_gia: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="o-nhap py-1"
                            aria-label="Địa điểm"
                            value={d.dia_diem}
                            onChange={(e) => suaDong(i, { dia_diem: e.target.value })}
                          >
                            <option value="">Không có</option>
                            {d.goc.dia_diem_goi_y && !d.goc.dia_diem_id && (
                              <option value="moi">Tạo mới: {d.goc.dia_diem_goi_y}</option>
                            )}
                            {dsDiaDiem?.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.ten_ngan}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="o-nhap py-1"
                            aria-label="Trạng thái"
                            value={d.trang_thai}
                            onChange={(e) => suaDong(i, { trang_thai: e.target.value as TrangThai })}
                          >
                            {Object.entries(NHAN_TRANG_THAI).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {trung ? (
                            <select
                              className="o-nhap border-amber-400 py-1"
                              aria-label="Xử lý lớp trùng"
                              value={d.xu_ly_trung}
                              onChange={(e) => suaDong(i, { xu_ly_trung: e.target.value as XuLyTrung })}
                            >
                              <option value="bo_qua">Bỏ qua</option>
                              <option value="ghi_de">Ghi đè</option>
                              <option value="tao_moi">Tạo mới</option>
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">Chưa có — tạo mới</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {!truongId && <span className="text-sm text-amber-700">Hãy chọn trường.</span>}
              {coLoi && <span className="text-sm text-red-600">Sửa các dòng báo lỗi trước khi nhập.</span>}
              <button className="btn-phu" onClick={() => setPhanTich(null)}>
                Hủy
              </button>
              <button className="btn-chinh" disabled={!theXacNhan || xacNhan.isPending} onClick={() => xacNhan.mutate()}>
                {xacNhan.isPending ? 'Đang nhập…' : `Xác nhận nhập ${dongChon.length} sheet`}
              </button>
            </div>
          </>
        )}

        {!!lichSu?.length && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">Lịch sử nhập ({lichSu.length})</summary>
            <table className="bang mt-2">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>File</th>
                  <th>Trường</th>
                  <th className="text-right">Số lớp</th>
                </tr>
              </thead>
              <tbody>
                {lichSu.map((l) => (
                  <tr key={l.id}>
                    <td className="tabular-nums">
                      {dinhDangNgay(l.nhap_luc.slice(0, 10))} {l.nhap_luc.slice(11, 16)}
                    </td>
                    <td className="break-all">{l.ten_file}</td>
                    <td>{l.truong_ma ?? '—'}</td>
                    <td className="text-right tabular-nums">{l.so_lop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </section>
  );
}
