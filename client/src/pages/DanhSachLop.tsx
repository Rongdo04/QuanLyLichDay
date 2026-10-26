import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { TrangThai } from '../api/types';
import { BaoLoiTai, DangTai, NhanTrangThai, ThanhTienDo, TieuDeTrang, TrongRong } from '../components/ChungUI';
import { dinhDangTien, NHAN_TRANG_THAI } from '../lib/format';
import { useDsLop, useDsTruong } from '../lib/hooks';
import { thongBao } from '../lib/thongBao';

export function TrangDanhSachLop() {
  const [params, setParams] = useSearchParams();
  const truongId = params.get('truong') ?? '';
  const trangThai = (params.get('trang-thai') ?? '') as TrangThai | '';
  const [tim, setTim] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: dsTruong } = useDsTruong();
  const { data: dsLop, isLoading, error } = useDsLop();

  const nhanBan = useMutation({
    mutationFn: (id: number) => api.lop.nhanBan(id),
    onSuccess: (l) => {
      qc.invalidateQueries();
      thongBao(`Đã nhân bản thành "${l.ten_sheet}". Hãy sửa học phần cho lớp mới.`);
      navigate(`/lop/${l.id}`);
    },
  });

  const doiLoc = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const ds = useMemo(() => {
    const t = tim.trim().toLowerCase();
    return (dsLop ?? []).filter(
      (l) =>
        (!truongId || l.truong_id === Number(truongId)) &&
        (!trangThai || l.trang_thai === trangThai) &&
        (!t || [l.ten_sheet, l.hoc_phan, l.ma_lop ?? '', l.lop_van_hoa ?? ''].some((s) => s.toLowerCase().includes(t))),
    );
  }, [dsLop, truongId, trangThai, tim]);
  const tongTien = ds.reduce((s, l) => s + l.tong, 0);

  return (
    <>
      <TieuDeTrang tieuDe="Lớp học" phu="Mỗi lớp + học phần tương ứng một sheet trong file Excel nộp cho trường.">
        <Link className="btn-chinh" to={`/lop/moi${truongId ? `?truong=${truongId}` : ''}`}>
          + Thêm lớp
        </Link>
      </TieuDeTrang>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="o-nhap w-auto" aria-label="Lọc theo trường" value={truongId} onChange={(e) => doiLoc('truong', e.target.value)}>
          <option value="">Tất cả trường</option>
          {dsTruong?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ma} — {t.ten}
            </option>
          ))}
        </select>
        <select
          className="o-nhap w-auto"
          aria-label="Lọc theo trạng thái"
          value={trangThai}
          onChange={(e) => doiLoc('trang-thai', e.target.value)}
        >
          <option value="">Mọi trạng thái</option>
          {Object.entries(NHAN_TRANG_THAI).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          className="o-nhap w-56"
          type="search"
          placeholder="Tìm tên sheet, học phần, mã lớp…"
          aria-label="Tìm lớp"
          value={tim}
          onChange={(e) => setTim(e.target.value)}
        />
      </div>

      <div className="the overflow-x-auto">
        {isLoading ? (
          <DangTai />
        ) : error ? (
          <div className="p-4">
            <BaoLoiTai loi={error} />
          </div>
        ) : !ds.length ? (
          <TrongRong>
            {dsLop?.length ? (
              'Không có lớp nào khớp bộ lọc.'
            ) : (
              <>
                Chưa có lớp nào.{' '}
                <Link className="lien-ket" to="/lop/moi">
                  Thêm lớp
                </Link>{' '}
                hoặc{' '}
                <Link className="lien-ket" to="/excel">
                  nhập từ file Excel cũ
                </Link>
                .
              </>
            )}
          </TrongRong>
        ) : (
          <table className="bang">
            <thead>
              <tr>
                <th>Lớp / học phần</th>
                <th className="w-24">Trường</th>
                <th className="w-28 text-right">Đơn giá</th>
                <th className="w-36">Tiến độ</th>
                <th className="w-32 text-right">Tổng tiền</th>
                <th className="w-28">Trạng thái</th>
                <th className="w-52" />
              </tr>
            </thead>
            <tbody>
              {ds.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/lop/${l.id}`} className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                      {l.ten_sheet}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {l.hoc_phan}
                      {l.ma_lop && ` · ${l.ma_lop}`}
                      {l.dia_diem_ten && ` · ${l.dia_diem_ten}`}
                    </div>
                  </td>
                  <td title={l.truong_ten}>{l.truong_ma}</td>
                  <td className="text-right tabular-nums">
                    {dinhDangTien(l.don_gia)}
                    {l.tinh_theo === 'tiet' && <div className="text-xs text-slate-500">/ tiết</div>}
                  </td>
                  <td>
                    <ThanhTienDo da={l.soBuoi} keHoach={l.so_buoi_ke_hoach} />
                  </td>
                  <td className="text-right font-medium tabular-nums">{dinhDangTien(l.tong)}</td>
                  <td>
                    <NhanTrangThai trangThai={l.trang_thai} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <Link className="btn-chinh btn-nho" to={`/cham-buoi?lop=${l.id}`}>
                        Chấm buổi
                      </Link>
                      <Link className="btn-phu btn-nho" to={`/lop/${l.id}`}>
                        Sửa
                      </Link>
                      <button
                        className="btn-phu btn-nho"
                        disabled={nhanBan.isPending}
                        title="Tạo học phần mới cho cùng lớp, không phải nhập lại thông tin"
                        onClick={() => nhanBan.mutate(l.id)}
                      >
                        Nhân bản
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td className="px-3 py-2" colSpan={4}>
                  {ds.length} lớp
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{dinhDangTien(tongTien)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
