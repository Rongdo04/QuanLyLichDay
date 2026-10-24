import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, khoa } from '../api';
import type { DuKien, KetQuaXemTruocLich, LopChiTiet } from '../api/types';
import { congNgay, dinhDangNgay, homNay, NHAN_DU_KIEN, soBuoiDuKien, soThu } from '../lib/format';
import { moTaThu, phanTichLichPhanCong, soBuoiTrongNgay, taoLichPhanCong, type LichTheoThu } from '../lib/nghiepVu';
import { thongBao } from '../lib/thongBao';

const CAC_THU = [2, 3, 4, 5, 6, 7, 8];
const TEN_THU: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'CN' };

// Trình sinh lịch: chọn thứ trong tuần + khoảng ngày / số buổi → xem trước → xác nhận
export function TrinhSinhLich({ lop, onXong }: { lop: LopChiTiet; onXong: () => void }) {
  const qc = useQueryClient();
  const { data: caiDat } = useQuery({ queryKey: khoa.caiDat, queryFn: api.caiDat.lay });

  // Giá trị mặc định: tiếp nối ngày cuối đã có, điền sẵn theo "Lịch phân công" nếu đọc được
  const goiY = useMemo(() => phanTichLichPhanCong(lop.lich_phan_cong), [lop.lich_phan_cong]);
  const ngayCuoi = lop.buoi.at(-1)?.ngay ?? null;
  const batDauMacDinh = ngayCuoi ? congNgay(ngayCuoi, 1) : (goiY.batDau ?? lop.ngay_bat_dau ?? homNay());
  // Số buổi đã lên lịch: ngày đã dạy tính theo thực tế; ngày chưa dạy tính theo dự kiến,
  // không có dự kiến (dữ liệu nhập từ file cũ) thì ước theo lịch phân công, tối thiểu 1 buổi
  const daLenLich = lop.buoi.reduce((s, b) => {
    const daDay = soBuoiTrongNgay(b);
    if (daDay > 0) return s + daDay;
    return s + Math.max(1, soBuoiDuKien(b.du_kien ?? goiY.thu[soThu(b.ngay)] ?? null));
  }, 0);
  const conLai = lop.so_buoi_ke_hoach ? Math.max(lop.so_buoi_ke_hoach - daLenLich, 0) : 0;

  const [batDau, setBatDau] = useState(batDauMacDinh);
  const [cheDo, setCheDo] = useState<'soBuoi' | 'ketThuc'>(conLai > 0 ? 'soBuoi' : 'ketThuc');
  const [soBuoi, setSoBuoi] = useState(String(conLai || 10));
  const [ketThuc, setKetThuc] = useState(
    lop.ngay_ket_thuc && lop.ngay_ket_thuc > batDauMacDinh ? lop.ngay_ket_thuc : congNgay(batDauMacDinh, 34),
  );
  const [thu, setThu] = useState<LichTheoThu>(goiY.thu);
  const [boQuaNgayNghi, setBoQuaNgayNghi] = useState(true);
  const [ketQua, setKetQua] = useState<KetQuaXemTruocLich | null>(null);
  const [boChon, setBoChon] = useState<Set<string>>(new Set());
  const [ghiLich, setGhiLich] = useState(!lop.lich_phan_cong);

  // Đổi tham số thì bản xem trước cũ không còn đúng
  useEffect(() => setKetQua(null), [batDau, cheDo, soBuoi, ketThuc, thu, boQuaNgayNghi]);

  const coThu = Object.values(thu).some(Boolean);
  const hopLe = coThu && !!batDau && (cheDo === 'soBuoi' ? Number(soBuoi) >= 1 : !!ketThuc && ketThuc >= batDau);
  const daChon = ketQua?.ngay.filter((n) => !boChon.has(n.ngay)) ?? [];
  const soNgayNghi = caiDat?.ngay_nghi.length ?? 0;

  const xemTruoc = useMutation({
    mutationFn: () =>
      api.lop.xemTruocLich(lop.id, {
        batDau,
        ketThuc: cheDo === 'ketThuc' ? ketThuc : null,
        soBuoi: cheDo === 'soBuoi' ? Number(soBuoi) : null,
        thu: Object.fromEntries(Object.entries(thu).filter(([, v]) => v)) as Record<string, DuKien>,
        boQuaNgayNghi,
      }),
    onSuccess: (kq) => {
      setKetQua(kq);
      setBoChon(new Set());
    },
  });

  const xacNhan = useMutation({
    mutationFn: async () => {
      const kq = await api.lop.taoLich(
        lop.id,
        daChon.map((n) => ({ ngay: n.ngay, du_kien: n.du_kien })),
      );
      if (ghiLich && daChon.length) await api.lop.sua(lop.id, { lich_phan_cong: taoLichPhanCong(thu, daChon[0]) });
      return kq;
    },
    onSuccess: (kq) => {
      qc.invalidateQueries();
      thongBao(`Đã tạo ${kq.soMoi} ngày dạy${kq.boQua ? ` (bỏ qua ${kq.boQua} ngày đã có)` : ''}`);
      onXong();
    },
  });

  const doiChon = (ngay: string) => {
    const s = new Set(boChon);
    if (s.has(ngay)) s.delete(ngay);
    else s.add(ngay);
    setBoChon(s);
  };

  return (
    <div className="space-y-4">
      {Object.keys(goiY.thu).length > 0 && !ngayCuoi && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Đã điền sẵn theo lịch phân công của lớp: <i>{lop.lich_phan_cong}</i>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="nhan" htmlFor="sl-bat-dau">
            Ngày bắt đầu
          </label>
          <input id="sl-bat-dau" type="date" className="o-nhap" value={batDau} onChange={(e) => setBatDau(e.target.value)} />
          {ngayCuoi && <p className="mt-1 text-xs text-slate-500">Lớp đã có lịch đến {dinhDangNgay(ngayCuoi)}.</p>}
        </div>
        <fieldset>
          <legend className="nhan">Kết thúc</legend>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="sl-che-do" checked={cheDo === 'soBuoi'} onChange={() => setCheDo('soBuoi')} />
              Đủ
              <input
                type="number"
                min={1}
                className="o-nhap w-20 py-1"
                aria-label="Số buổi"
                value={soBuoi}
                disabled={cheDo !== 'soBuoi'}
                onChange={(e) => setSoBuoi(e.target.value)}
              />
              buổi
              {lop.so_buoi_ke_hoach ? (
                <span className="text-xs text-slate-500">
                  (kế hoạch {lop.so_buoi_ke_hoach}, đã lên lịch {daLenLich})
                </span>
              ) : null}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="sl-che-do" checked={cheDo === 'ketThuc'} onChange={() => setCheDo('ketThuc')} />
              Đến ngày
              <input
                type="date"
                className="o-nhap w-44 py-1"
                aria-label="Đến ngày"
                value={ketThuc}
                min={batDau}
                disabled={cheDo !== 'ketThuc'}
                onChange={(e) => setKetThuc(e.target.value)}
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div>
        <div className="nhan">Thứ trong tuần và buổi dự kiến</div>
        <div className="grid grid-cols-7 gap-1.5">
          {CAC_THU.map((t) => {
            const dk = thu[t];
            return (
              <div
                key={t}
                className={`rounded-md border p-1.5 text-center ${dk ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
              >
                <label className="flex cursor-pointer items-center justify-center gap-1 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!dk}
                    onChange={(e) => setThu({ ...thu, [t]: e.target.checked ? 'S' : undefined })}
                  />
                  {TEN_THU[t]}
                </label>
                <select
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs disabled:opacity-40"
                  aria-label={`Buổi dự kiến ${TEN_THU[t]}`}
                  disabled={!dk}
                  value={dk ?? 'S'}
                  onChange={(e) => setThu({ ...thu, [t]: e.target.value as DuKien })}
                >
                  <option value="S">Sáng</option>
                  <option value="C">Chiều</option>
                  <option value="SC">Cả ngày</option>
                </select>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-sm text-slate-600">{coThu ? moTaThu(thu) : 'Chọn ít nhất một thứ.'}</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={boQuaNgayNghi} onChange={(e) => setBoQuaNgayNghi(e.target.checked)} />
        Bỏ qua ngày nghỉ lễ ({soNgayNghi} mục trong Cài đặt)
      </label>

      <div className="flex justify-end gap-2">
        <button className="btn-phu" onClick={onXong}>
          Đóng
        </button>
        <button className="btn-chinh" disabled={!hopLe || xemTruoc.isPending} onClick={() => xemTruoc.mutate()}>
          {xemTruoc.isPending ? 'Đang tính…' : 'Xem trước'}
        </button>
      </div>

      {ketQua && (
        <div className="border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm">
              <b>{daChon.length}</b> ngày sẽ được tạo ·{' '}
              {daChon.reduce((s, n) => s + soBuoiDuKien(n.du_kien), 0)} buổi dự kiến
              {boChon.size > 0 && <span className="text-slate-500"> (đã bỏ chọn {boChon.size})</span>}
            </div>
            {ketQua.ngay.length > 0 && (
              <button
                className="lien-ket text-sm"
                onClick={() => setBoChon(boChon.size ? new Set() : new Set(ketQua.ngay.map((n) => n.ngay)))}
              >
                {boChon.size ? 'Chọn tất cả' : 'Bỏ chọn tất cả'}
              </button>
            )}
          </div>
          {ketQua.ngay.length === 0 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Không có ngày nào phù hợp.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
              <table className="bang">
                <thead className="sticky top-0">
                  <tr>
                    <th className="w-10" />
                    <th>Ngày</th>
                    <th>Thứ</th>
                    <th>Dự kiến</th>
                  </tr>
                </thead>
                <tbody>
                  {ketQua.ngay.map((n) => (
                    <tr key={n.ngay} className={boChon.has(n.ngay) ? 'text-slate-400 line-through' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Chọn ngày ${dinhDangNgay(n.ngay)}`}
                          checked={!boChon.has(n.ngay)}
                          onChange={() => doiChon(n.ngay)}
                        />
                      </td>
                      <td className="tabular-nums">{dinhDangNgay(n.ngay)}</td>
                      <td>{n.thu}</td>
                      <td>{NHAN_DU_KIEN[n.du_kien]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ketQua.boQua.length > 0 && (
            <div className="mt-2 text-xs text-amber-700">
              Bỏ qua:{' '}
              {ketQua.boQua.map((b) => `${dinhDangNgay(b.ngay)} (${b.ly_do})`).join('; ')}
            </div>
          )}
          {daChon.length > 0 && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={ghiLich} onChange={(e) => setGhiLich(e.target.checked)} />
              <span>
                Ghi vào "Lịch phân công" của lớp: <i className="text-slate-600">{taoLichPhanCong(thu, daChon[0])}</i>
              </span>
            </label>
          )}
          <div className="mt-3 flex justify-end">
            <button
              className="btn-chinh"
              disabled={!daChon.length || xacNhan.isPending}
              onClick={() => xacNhan.mutate()}
            >
              {xacNhan.isPending ? 'Đang tạo…' : `Xác nhận tạo ${daChon.length} ngày`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
