import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api, khoa } from '../api';
import type { Buoi, BuoiDayDu, LopThongKe } from '../api/types';
import { BaoLoiTai, DangTai, Modal, ThanhTienDo, TieuDeTrang, TrongRong } from '../components/ChungUI';
import { TrinhSinhLich } from '../components/TrinhSinhLich';
import { congNgay, dinhDangNgay, dinhDangTien, homNay, NHAN_DU_KIEN } from '../lib/format';
import { useDsLop, useSuaBuoi, useThemBuoi, useXoaBuoi } from '../lib/hooks';
import { soBuoiTrongNgay, thuCuaNgay, tienDcNgay } from '../lib/nghiepVu';
import { coChieu, coSang, duKienCuaBuoi } from '../lib/duKien';
import { thongBao } from '../lib/thongBao';

const KHOA_LOP_GAN_NHAT = 'cham-buoi:lop';
const docLocal = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const ghiLocal = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
};

export function TrangChamBuoi() {
  const [params, setParams] = useSearchParams();
  const ngayParam = params.get('ngay');
  const lopParam = params.get('lop');
  const { data: dsLop, isLoading, error } = useDsLop();

  // Lớp đang chọn: theo đường dẫn → lớp chấm gần nhất → lớp đang dạy đầu tiên
  const lopId = useMemo(() => {
    if (lopParam) return Number(lopParam);
    const ganNhat = Number(docLocal(KHOA_LOP_GAN_NHAT));
    if (dsLop?.some((l) => l.id === ganNhat)) return ganNhat;
    return dsLop?.find((l) => l.trang_thai === 'dang_day')?.id ?? dsLop?.[0]?.id ?? null;
  }, [lopParam, dsLop]);

  useEffect(() => {
    if (lopId) ghiLocal(KHOA_LOP_GAN_NHAT, String(lopId));
  }, [lopId]);

  const theoNgay = !!ngayParam;

  return (
    <>
      <TieuDeTrang tieuDe="Chấm buổi" phu="Bấm vào ô Sáng / Chiều để đánh dấu buổi đã dạy. Dữ liệu được lưu ngay.">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="tablist">
          <button
            role="tab"
            aria-selected={!theoNgay}
            className={`rounded px-3 py-1 text-sm ${!theoNgay ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            onClick={() => setParams(lopId ? { lop: String(lopId) } : {})}
          >
            Theo lớp
          </button>
          <button
            role="tab"
            aria-selected={theoNgay}
            className={`rounded px-3 py-1 text-sm ${theoNgay ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            onClick={() => setParams({ ngay: homNay() })}
          >
            Theo ngày
          </button>
        </div>
      </TieuDeTrang>

      {isLoading ? (
        <DangTai />
      ) : error ? (
        <BaoLoiTai loi={error} />
      ) : !dsLop?.length ? (
        <div className="the">
          <TrongRong>
            Chưa có lớp nào.{' '}
            <Link className="lien-ket" to="/lop/moi">
              Thêm lớp
            </Link>{' '}
            hoặc{' '}
            <Link className="lien-ket" to="/excel">
              nhập từ file Excel cũ
            </Link>
            .
          </TrongRong>
        </div>
      ) : theoNgay ? (
        <ChamTheoNgay ngay={ngayParam!} dsLop={dsLop} onDoiNgay={(n) => setParams({ ngay: n })} />
      ) : lopId ? (
        <ChamTheoLop lopId={lopId} dsLop={dsLop} onChonLop={(id) => setParams({ lop: String(id) })} />
      ) : null}
    </>
  );
}

// Dropdown chọn lớp, nhóm theo trường
function ChonLop({ dsLop, giaTri, onChon }: { dsLop: LopThongKe[]; giaTri: number; onChon: (id: number) => void }) {
  const nhom = useMemo(() => {
    const m = new Map<string, LopThongKe[]>();
    for (const l of dsLop) {
      const k = `${l.truong_ma} — ${l.truong_ten}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return [...m];
  }, [dsLop]);
  return (
    <select
      className="o-nhap max-w-md font-medium"
      aria-label="Chọn lớp"
      value={giaTri}
      onChange={(e) => onChon(Number(e.target.value))}
    >
      {nhom.map(([truong, ds]) => (
        <optgroup key={truong} label={truong}>
          {ds.map((l) => (
            <option key={l.id} value={l.id}>
              {l.ten_sheet} — {l.hoc_phan}
              {l.trang_thai === 'hoan_thanh' ? ' (xong)' : l.trang_thai === 'tam_dung' ? ' (tạm dừng)' : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function ChamTheoLop({ lopId, dsLop, onChonLop }: { lopId: number; dsLop: LopThongKe[]; onChonLop: (id: number) => void }) {
  const { data: lop, isLoading, error } = useQuery({ queryKey: khoa.lop(lopId), queryFn: () => api.lop.ct(lopId) });
  const [moSinhLich, setMoSinhLich] = useState(false);
  const them = useThemBuoi();
  const [ngayMoi, setNgayMoi] = useState(homNay());
  const hn = homNay();

  const themNgay = (e: FormEvent) => {
    e.preventDefault();
    if (!ngayMoi) return;
    them.mutate({ lop_id: lopId, ngay: ngayMoi }, { onSuccess: () => thongBao(`Đã thêm ngày ${dinhDangNgay(ngayMoi)}`) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChonLop dsLop={dsLop} giaTri={lopId} onChon={onChonLop} />
        <Link className="btn-phu" to={`/lop/${lopId}`}>
          Sửa thông tin lớp
        </Link>
        <button className="btn-phu" onClick={() => setMoSinhLich(true)} disabled={!lop}>
          Sinh thêm ngày
        </button>
      </div>

      {isLoading ? (
        <DangTai />
      ) : error || !lop ? (
        <BaoLoiTai loi={error} />
      ) : (
        <>
          <div className="the grid gap-4 p-4 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-900">{lop.ten_sheet}</div>
              <div className="text-sm text-slate-600">
                {lop.hoc_phan}
                {lop.ma_lop && ` · Lớp ${lop.ma_lop}`}
                {lop.lop_van_hoa && ` (văn hóa ${lop.lop_van_hoa})`}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {lop.truong_ten} · Đơn giá {dinhDangTien(lop.don_gia)}/buổi
                {lop.dia_diem_ten
                  ? ` · ${lop.dia_diem_ten} (DC ${dinhDangTien(lop.tien_dc_dia_diem ?? 0)}/ngày)`
                  : ' · Không có tiền DC'}
              </div>
              <div className="mt-2">
                <ThanhTienDo da={lop.soBuoi} keHoach={lop.so_buoi_ke_hoach} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-right">
              <SoLieu nhan="Tiền dạy" giaTri={dinhDangTien(lop.tienDay)} phu={`${lop.soBuoi} buổi`} />
              <SoLieu nhan="Tiền DC" giaTri={dinhDangTien(lop.tienDc)} phu={`${lop.soNgayDay} ngày`} />
              <SoLieu nhan="Tổng" giaTri={dinhDangTien(lop.tong)} noiBat />
            </div>
          </div>

          <div className="the overflow-hidden">
            {lop.buoi.length === 0 ? (
              <TrongRong>
                Lớp chưa có ngày nào.{' '}
                <button className="lien-ket" onClick={() => setMoSinhLich(true)}>
                  Sinh lịch
                </button>{' '}
                hoặc thêm từng ngày ở dưới.
              </TrongRong>
            ) : (
              <table className="bang">
                <thead>
                  <tr>
                    <th className="w-36">Ngày</th>
                    <th className="w-20">Thứ</th>
                    <th className="w-20 text-center">Sáng</th>
                    <th className="w-20 text-center">Chiều</th>
                    <th>Ghi chú</th>
                    <th className="w-36 text-right">Tiền DC</th>
                    <th className="w-14" />
                  </tr>
                </thead>
                <tbody>
                  {lop.buoi.map((b) => (
                    <DongBuoi key={b.id} b={b} lichLop={lop} tienDcDiaDiem={lop.tien_dc_dia_diem} homNay={hn} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-medium">
                    <td className="px-3 py-2" colSpan={2}>
                      Tổng: {lop.buoi.length} ngày
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{lop.buoi.filter((b) => b.sang).length}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{lop.buoi.filter((b) => b.chieu).length}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {lop.soBuoi} buổi × {dinhDangTien(lop.don_gia)} = {dinhDangTien(lop.tienDay)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{dinhDangTien(lop.tienDc)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
            <form onSubmit={themNgay} className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/50 px-3 py-2.5">
              <span className="text-sm text-slate-600">Thêm ngày lẻ:</span>
              <input
                type="date"
                className="o-nhap w-44 py-1"
                aria-label="Ngày cần thêm"
                value={ngayMoi}
                onChange={(e) => setNgayMoi(e.target.value)}
                required
              />
              <button className="btn-phu btn-nho" disabled={them.isPending}>
                Thêm
              </button>
            </form>
          </div>

          <Modal mo={moSinhLich} tieuDe={`Sinh lịch — ${lop.ten_sheet}`} onDong={() => setMoSinhLich(false)} rong="max-w-3xl">
            <TrinhSinhLich lop={lop} onXong={() => setMoSinhLich(false)} />
          </Modal>
        </>
      )}
    </div>
  );
}

function SoLieu({ nhan, giaTri, phu, noiBat }: { nhan: string; giaTri: string; phu?: string; noiBat?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{nhan}</div>
      <div className={`text-lg font-semibold tabular-nums ${noiBat ? 'text-blue-700' : 'text-slate-900'}`}>{giaTri}</div>
      {phu && <div className="text-xs text-slate-500">{phu}</div>}
    </div>
  );
}

// Ô đánh dấu buổi đã dạy; viền nét đứt = buổi dự kiến theo lịch
function OTick({ dau, duKien, nhan, onBam }: { dau: boolean; duKien: boolean; nhan: string; onBam: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={dau}
      aria-label={nhan}
      title={dau ? 'Đã dạy (bấm để bỏ)' : duKien ? 'Dự kiến dạy (bấm để đánh dấu đã dạy)' : 'Bấm để đánh dấu đã dạy'}
      onClick={onBam}
      className={`inline-flex h-7 w-10 items-center justify-center rounded border text-sm font-bold transition-colors ${
        dau
          ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
          : duKien
            ? 'border-dashed border-blue-400 bg-white text-transparent hover:bg-blue-50'
            : 'border-slate-300 bg-white text-transparent hover:bg-slate-100'
      }`}
    >
      x
    </button>
  );
}

function OGhiChu({ giaTri, onLuu }: { giaTri: string | null; onLuu: (v: string | null) => void }) {
  const [v, setV] = useState(giaTri ?? '');
  useEffect(() => setV(giaTri ?? ''), [giaTri]);
  // Đọc giá trị từ chính ô nhập (không dùng state) để không mất chữ vừa gõ khi rời ô ngay lập tức
  const luu = (giaTriO: string) => {
    const moi = giaTriO.trim() || null;
    if (moi !== (giaTri ?? null)) onLuu(moi);
  };
  return (
    <input
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm placeholder:text-slate-300 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none"
      aria-label="Ghi chú"
      value={v}
      placeholder="Ghi chú…"
      onChange={(e) => setV(e.target.value)}
      onBlur={(e) => luu(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setV(giaTri ?? '');
      }}
    />
  );
}

// Một dòng ngày. Chế độ "theo ngày" hiện thêm cột lớp/trường thay cho ngày/thứ.
function DongBuoi({
  b,
  tienDcDiaDiem,
  homNay: hn,
  lop,
  lichLop,
}: {
  b: Buoi;
  tienDcDiaDiem: number | null;
  homNay: string;
  lop?: BuoiDayDu;
  lichLop?: { lich_tuan: string | null; lich_phan_cong: string | null };
}) {
  const sua = useSuaBuoi();
  const xoa = useXoaBuoi();
  const daDay = soBuoiTrongNgay(b) > 0;
  const quaChuaCham = b.ngay < hn && !daDay;
  const dc = tienDcNgay(b, tienDcDiaDiem);
  const nhanNgay = dinhDangNgay(b.ngay);
  const dk = duKienCuaBuoi(b, lop ?? lichLop);

  return (
    <tr className={b.ngay === hn ? 'bg-blue-50/60' : quaChuaCham ? 'bg-amber-50/50' : ''}>
      {lop ? (
        <>
          <td>
            <div className="font-medium">{lop.ten_sheet}</div>
            <div className="text-xs text-slate-500">
              {lop.truong_ma} · {lop.hoc_phan}
            </div>
          </td>
          <td className="text-sm text-slate-600">{dk ? NHAN_DU_KIEN[dk] : '—'}</td>
        </>
      ) : (
        <>
          <td className="tabular-nums">
            {nhanNgay}
            {b.ngay === hn && <span className="ml-1.5 rounded bg-blue-600 px-1 py-0.5 text-[10px] font-medium text-white">Hôm nay</span>}
          </td>
          <td className={thuCuaNgay(b.ngay) === 'CN' ? 'text-red-600' : ''}>{thuCuaNgay(b.ngay)}</td>
        </>
      )}
      <td className="text-center">
        <OTick
          dau={!!b.sang}
          duKien={coSang(dk)}
          nhan={`Sáng ${nhanNgay}`}
          onBam={() => sua.mutate({ id: b.id, sang: b.sang ? 0 : 1 })}
        />
      </td>
      <td className="text-center">
        <OTick
          dau={!!b.chieu}
          duKien={coChieu(dk)}
          nhan={`Chiều ${nhanNgay}`}
          onBam={() => sua.mutate({ id: b.id, chieu: b.chieu ? 0 : 1 })}
        />
      </td>
      <td>
        <OGhiChu giaTri={b.ghi_chu} onLuu={(v) => sua.mutate({ id: b.id, ghi_chu: v })} />
      </td>
      <td className="text-right">
        {tienDcDiaDiem ? (
          <label
            className="inline-flex cursor-pointer items-center gap-2"
            title="Bỏ chọn nếu ngày này không tính tiền di chuyển"
          >
            <span className={`tabular-nums ${dc ? '' : 'text-slate-300'}`}>{dc ? dinhDangTien(dc) : '0 đ'}</span>
            <input
              type="checkbox"
              aria-label={`Tính tiền DC ngày ${nhanNgay}`}
              checked={!!b.co_tien_dc}
              onChange={() => sua.mutate({ id: b.id, co_tien_dc: b.co_tien_dc ? 0 : 1 })}
            />
          </label>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="text-right">
        <button
          className="text-xs text-slate-400 hover:text-red-600"
          title="Xóa ngày này"
          onClick={() => {
            const canhBao = daDay ? ' Ngày này đã chấm buổi dạy.' : '';
            if (confirm(`Xóa ngày ${nhanNgay}${lop ? ` của lớp ${lop.ten_sheet}` : ''}?${canhBao}`)) xoa.mutate(b.id);
          }}
        >
          Xóa
        </button>
      </td>
    </tr>
  );
}

function ChamTheoNgay({ ngay, dsLop, onDoiNgay }: { ngay: string; dsLop: LopThongKe[]; onDoiNgay: (n: string) => void }) {
  const loc = { tu: ngay, den: ngay };
  const { data: ds, isLoading, error } = useQuery({ queryKey: khoa.buoi(loc), queryFn: () => api.buoi.ds(loc) });
  const them = useThemBuoi();
  const [lopThem, setLopThem] = useState('');
  const hn = homNay();

  const coSan = new Set(ds?.map((b) => b.lop_id));
  const lopCoTheThem = dsLop.filter((l) => l.trang_thai === 'dang_day' && !coSan.has(l.id));
  const tong = (ds ?? []).reduce(
    (a, b) => {
      const n = soBuoiTrongNgay(b);
      const dc = tienDcNgay(b, b.tien_dc_dia_diem);
      return { soBuoi: a.soBuoi + n, tienDay: a.tienDay + n * b.don_gia, tienDc: a.tienDc + dc };
    },
    { soBuoi: 0, tienDay: 0, tienDc: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-phu" onClick={() => onDoiNgay(congNgay(ngay, -1))} aria-label="Ngày trước">
          ‹
        </button>
        <input
          type="date"
          className="o-nhap w-44"
          aria-label="Chọn ngày"
          value={ngay}
          onChange={(e) => e.target.value && onDoiNgay(e.target.value)}
        />
        <button className="btn-phu" onClick={() => onDoiNgay(congNgay(ngay, 1))} aria-label="Ngày sau">
          ›
        </button>
        {ngay !== hn && (
          <button className="btn-phu" onClick={() => onDoiNgay(hn)}>
            Hôm nay
          </button>
        )}
        <span className="ml-2 text-sm text-slate-600">
          {thuCuaNgay(ngay)}, {dinhDangNgay(ngay)}
        </span>
      </div>

      <div className="the overflow-hidden">
        {isLoading ? (
          <DangTai />
        ) : error ? (
          <div className="p-4">
            <BaoLoiTai loi={error} />
          </div>
        ) : !ds?.length ? (
          <TrongRong>Không có lớp nào có lịch trong ngày này.</TrongRong>
        ) : (
          <table className="bang">
            <thead>
              <tr>
                <th>Lớp</th>
                <th className="w-24">Dự kiến</th>
                <th className="w-20 text-center">Sáng</th>
                <th className="w-20 text-center">Chiều</th>
                <th>Ghi chú</th>
                <th className="w-36 text-right">Tiền DC</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {ds.map((b) => (
                <DongBuoi key={b.id} b={b} lop={b} tienDcDiaDiem={b.tien_dc_dia_diem} homNay={hn} />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  {tong.soBuoi} buổi · Tiền dạy {dinhDangTien(tong.tienDay)}
                </td>
                <td colSpan={3} />
                <td className="px-3 py-2 text-right tabular-nums">{dinhDangTien(tong.tienDc)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
        {lopCoTheThem.length > 0 && (
          <form
            className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/50 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (lopThem)
                them.mutate({ lop_id: Number(lopThem), ngay }, { onSuccess: () => setLopThem('') });
            }}
          >
            <span className="text-sm text-slate-600">Thêm lớp vào ngày này:</span>
            <select className="o-nhap w-auto py-1" aria-label="Lớp cần thêm" value={lopThem} onChange={(e) => setLopThem(e.target.value)}>
              <option value="">— Chọn lớp đang dạy —</option>
              {lopCoTheThem.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.truong_ma} · {l.ten_sheet}
                </option>
              ))}
            </select>
            <button className="btn-phu btn-nho" disabled={!lopThem || them.isPending}>
              Thêm
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
