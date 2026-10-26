import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { api, khoa, type LocThongKe } from '../api';
import type { BuoiDayDu, LopThongKe, ThongKe } from '../api/types';
import { BaoLoiTai, DangTai, TheSoLieu, ThanhTienDo, TieuDeTrang, TrongRong } from '../components/ChungUI';
import { congNgay, cuoiThang, dauThang, dauTuan, dinhDangNgay, dinhDangSo, dinhDangTien, homNay, ngayNgan } from '../lib/format';
import { useDsLop, useDsTruong } from '../lib/hooks';
import { thuCuaNgay } from '../lib/nghiepVu';
import { coChieu, coSang, duKienCuaBuoi } from '../lib/duKien';
import { thongBao } from '../lib/thongBao';

export function TrangTongQuan() {
  const [cheDo, setCheDo] = useState<'thang' | 'khoang'>('thang');
  const [thang, setThang] = useState(dayjs().format('YYYY-MM'));
  const [tu, setTu] = useState('');
  const [den, setDen] = useState('');
  const [truongId, setTruongId] = useState('');
  const { data: dsTruong } = useDsTruong();

  const loc: LocThongKe = {
    ...(cheDo === 'thang' ? { tu: dauThang(thang), den: cuoiThang(thang) } : { tu: tu || undefined, den: den || undefined }),
    ...(truongId ? { truongId: Number(truongId) } : {}),
  };
  const khoangSai = cheDo === 'khoang' && !!tu && !!den && tu > den;
  const { data: tk, isLoading, error } = useQuery({
    queryKey: khoa.thongKe(loc),
    queryFn: () => api.thongKe.ky(loc),
    placeholderData: keepPreviousData,
    enabled: !khoangSai,
  });
  const soLop = tk?.truong.reduce((s, t) => s + t.lop.length, 0) ?? 0;
  const tenKy =
    cheDo === 'thang'
      ? `Tháng ${dayjs(`${thang}-01`).format('MM/YYYY')}`
      : tu || den
        ? `${tu ? dinhDangNgay(tu) : '…'} – ${den ? dinhDangNgay(den) : '…'}`
        : 'Toàn bộ thời gian';

  return (
    <>
      <TieuDeTrang tieuDe="Tổng quan" phu={tenKy} />

      <div className="the mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
          {(['thang', 'khoang'] as const).map((c) => (
            <button
              key={c}
              className={`rounded px-3 py-1 text-sm ${cheDo === c ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              onClick={() => setCheDo(c)}
            >
              {c === 'thang' ? 'Theo tháng' : 'Khoảng ngày'}
            </button>
          ))}
        </div>
        {cheDo === 'thang' ? (
          <div className="flex items-center gap-1">
            <button
              className="btn-phu"
              aria-label="Tháng trước"
              onClick={() => setThang(dayjs(`${thang}-01`).subtract(1, 'month').format('YYYY-MM'))}
            >
              ‹
            </button>
            <input
              type="month"
              className="o-nhap w-40"
              aria-label="Chọn tháng"
              value={thang}
              onChange={(e) => e.target.value && setThang(e.target.value)}
            />
            <button
              className="btn-phu"
              aria-label="Tháng sau"
              onClick={() => setThang(dayjs(`${thang}-01`).add(1, 'month').format('YYYY-MM'))}
            >
              ›
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="date" className="o-nhap w-40" aria-label="Từ ngày" value={tu} onChange={(e) => setTu(e.target.value)} />
            <span className="text-slate-400">→</span>
            <input type="date" className="o-nhap w-40" aria-label="Đến ngày" value={den} onChange={(e) => setDen(e.target.value)} />
          </div>
        )}
        <select className="o-nhap ml-auto w-auto" aria-label="Lọc theo trường" value={truongId} onChange={(e) => setTruongId(e.target.value)}>
          <option value="">Tất cả trường</option>
          {dsTruong?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ma} — {t.ten}
            </option>
          ))}
        </select>
      </div>

      {khoangSai ? (
        <BaoLoiTai loi={new Error('"Từ ngày" phải trước "Đến ngày"')} />
      ) : isLoading ? (
        <DangTai />
      ) : error || !tk ? (
        <BaoLoiTai loi={error} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <TheSoLieu nhan="Số buổi đã dạy" giaTri={dinhDangSo(tk.tong.soBuoi)} phu={`${soLop} lớp có lịch trong kỳ`} />
            <TheSoLieu nhan="Tiền dạy" giaTri={dinhDangTien(tk.tong.tienDay)} />
            <TheSoLieu nhan="Tiền di chuyển" giaTri={dinhDangTien(tk.tong.tienDc)} />
            <TheSoLieu
              nhan="Tổng tiền (nhận về)"
              giaTri={dinhDangTien(tk.tong.tong)}
              phu={tk.tong.tienThue ? `Kể cả thuế: ${dinhDangTien(tk.tong.tongCoThue)}` : undefined}
              noiBat
            />
          </div>
          <BangTheoTruong tk={tk} />
        </>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <LichTuan />
        <CanhBao />
      </div>
    </>
  );
}

function BangTheoTruong({ tk }: { tk: ThongKe }) {
  const [mo, setMo] = useState<Set<number>>(new Set());
  const doi = (id: number) => {
    const s = new Set(mo);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setMo(s);
  };
  return (
    <div className="the overflow-hidden">
      <div className="the-dau">
        <h2 className="font-medium">Theo trường</h2>
        {tk.truong.length > 0 && (
          <button className="lien-ket text-sm" onClick={() => setMo(mo.size ? new Set() : new Set(tk.truong.map((t) => t.id)))}>
            {mo.size ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
          </button>
        )}
      </div>
      {tk.truong.length === 0 ? (
        <TrongRong>Không có buổi dạy nào trong kỳ này.</TrongRong>
      ) : (
        <table className="bang">
          <thead>
            <tr>
              <th>Trường / lớp</th>
              <th className="w-28 text-right">Số buổi</th>
              <th className="w-36 text-right">Tiền dạy</th>
              <th className="w-32 text-right">Tiền DC</th>
              <th className="w-36 text-right">Tổng</th>
              <th className="w-36 text-right">Kể cả thuế</th>
            </tr>
          </thead>
          <tbody>
            {tk.truong.map((t) => (
              <FragmentTruong key={t.id} t={t} mo={mo.has(t.id)} onDoi={() => doi(t.id)} />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2">Tổng cộng</td>
              <td className="px-3 py-2 text-right tabular-nums">{tk.tong.soBuoi}</td>
              <td className="px-3 py-2 text-right tabular-nums">{dinhDangTien(tk.tong.tienDay)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{dinhDangTien(tk.tong.tienDc)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-blue-700">{dinhDangTien(tk.tong.tong)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{dinhDangTien(tk.tong.tongCoThue)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

type TruongTK = ThongKe['truong'][number];

function FragmentTruong({ t, mo, onDoi }: { t: TruongTK; mo: boolean; onDoi: () => void }) {
  return (
    <>
      <tr className="cursor-pointer" onClick={onDoi}>
        <td className="font-medium">
          <span className="mr-1.5 inline-block w-3 text-slate-400">{mo ? '▾' : '▸'}</span>
          {t.ma} <span className="font-normal text-slate-500">— {t.ten}</span>
          <span className="ml-1 text-xs font-normal text-slate-400">
            ({t.lop.length} lớp{t.thue ? `, thuế ${t.thue}%` : ''})
          </span>
        </td>
        <td className="text-right tabular-nums">{t.soBuoi}</td>
        <td className="text-right tabular-nums">{dinhDangTien(t.tienDay)}</td>
        <td className="text-right tabular-nums">{dinhDangTien(t.tienDc)}</td>
        <td className="text-right font-medium tabular-nums">{dinhDangTien(t.tong)}</td>
        <td className="text-right tabular-nums">{t.tienThue ? dinhDangTien(t.tongCoThue) : '—'}</td>
      </tr>
      {mo &&
        t.lop.map((l) => (
          <tr key={l.id} className="text-slate-600">
            <td className="pl-9">
              <Link className="hover:text-blue-700 hover:underline" to={`/cham-buoi?lop=${l.id}`}>
                {l.ten_sheet}
              </Link>
              <span className="ml-1 text-xs text-slate-400">— {l.hoc_phan}</span>
            </td>
            <td className="text-right tabular-nums">{l.soBuoi}</td>
            <td className="text-right tabular-nums">{dinhDangTien(l.tienDay)}</td>
            <td className="text-right tabular-nums">{dinhDangTien(l.tienDc)}</td>
            <td className="text-right tabular-nums">{dinhDangTien(l.tong)}</td>
            <td className="text-right tabular-nums">{l.tienThue ? dinhDangTien(l.tongCoThue) : '—'}</td>
          </tr>
        ))}
    </>
  );
}

// Lịch 2 tuần: tuần này và tuần tới
function LichTuan() {
  const hn = homNay();
  const dau = dauTuan(hn);
  const loc = { tu: dau, den: congNgay(dau, 13) };
  const { data: ds, isLoading } = useQuery({ queryKey: khoa.buoi(loc), queryFn: () => api.buoi.ds(loc) });

  const theoNgay = useMemo(() => {
    const m = new Map<string, BuoiDayDu[]>();
    for (const b of ds ?? []) {
      if (!m.has(b.ngay)) m.set(b.ngay, []);
      m.get(b.ngay)!.push(b);
    }
    return m;
  }, [ds]);

  const tuan = (batDau: string, tieuDe: string) => {
    const ngay = Array.from({ length: 7 }, (_, i) => congNgay(batDau, i)).filter((n) => theoNgay.has(n));
    return (
      <div>
        <div className="mb-2 text-sm font-medium text-slate-700">
          {tieuDe} <span className="font-normal text-slate-400">({ngayNgan(batDau)} – {ngayNgan(congNgay(batDau, 6))})</span>
        </div>
        {ngay.length === 0 ? (
          <p className="text-sm text-slate-400">Không có lịch.</p>
        ) : (
          <ul className="space-y-2">
            {ngay.map((n) => (
              <li key={n} className={`rounded-md border px-3 py-2 ${n === hn ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200'}`}>
                <Link to={`/cham-buoi?ngay=${n}`} className="text-sm font-medium hover:text-blue-700">
                  {thuCuaNgay(n)}, {dinhDangNgay(n)}
                  {n === hn && <span className="ml-1.5 rounded bg-blue-600 px-1 py-0.5 text-[10px] text-white">Hôm nay</span>}
                </Link>
                <ul className="mt-1 space-y-0.5">
                  {theoNgay.get(n)!.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-sm">
                      <Buoi2 b={b} />
                      <span className="truncate">
                        {b.ten_sheet} <span className="text-slate-400">· {b.truong_ma}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section className="the">
      <div className="the-dau">
        <h2 className="font-medium">Lịch tuần này / tuần tới</h2>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-600" /> đã dạy
          <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-blue-500 bg-blue-50" /> dự kiến
        </span>
      </div>
      {isLoading ? <DangTai /> : <div className="grid gap-4 p-4 md:grid-cols-2">{[tuan(dau, 'Tuần này'), tuan(congNgay(dau, 7), 'Tuần tới')]}</div>}
    </section>
  );
}

// Hai ô S / C nhỏ: tô đậm = đã dạy, viền nét đứt = dự kiến
function Buoi2({ b }: { b: BuoiDayDu }) {
  const o = (chu: string, daDay: boolean, duKien: boolean) => (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-semibold ${
        daDay ? 'bg-blue-600 text-white' : duKien ? 'border border-dashed border-blue-500 bg-blue-50 text-blue-600' : 'border border-slate-200 text-slate-300'
      }`}
    >
      {chu}
    </span>
  );
  const dk = duKienCuaBuoi(b, b);
  return (
    <span className="flex shrink-0 gap-0.5" aria-hidden>
      {o('S', !!b.sang, coSang(dk))}
      {o('C', !!b.chieu, coChieu(dk))}
    </span>
  );
}

function CanhBao() {
  const qc = useQueryClient();
  const { data: dsLop } = useDsLop();
  const hoanThanh = useMutation({
    mutationFn: (l: LopThongKe) => api.lop.sua(l.id, { trang_thai: 'hoan_thanh' }),
    onSuccess: (l) => {
      qc.invalidateQueries();
      thongBao(`Đã đánh dấu "${l.ten_sheet}" hoàn thành`);
    },
  });
  const sapXong = (dsLop ?? []).filter(
    (l) => l.trang_thai === 'dang_day' && l.so_buoi_ke_hoach && l.soBuoi <= l.so_buoi_ke_hoach && l.so_buoi_ke_hoach - l.soBuoi <= 3,
  );
  const vuot = (dsLop ?? []).filter((l) => l.so_buoi_ke_hoach && l.soBuoi > l.so_buoi_ke_hoach);

  return (
    <section className="the">
      <div className="the-dau">
        <h2 className="font-medium">Cần chú ý</h2>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-700">Lớp sắp hoàn thành (còn ≤ 3 buổi)</div>
          {sapXong.length === 0 ? (
            <p className="text-sm text-slate-400">Không có.</p>
          ) : (
            <ul className="space-y-1.5">
              {sapXong.map((l) => {
                const con = l.so_buoi_ke_hoach! - l.soBuoi;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link className="min-w-0 truncate hover:text-blue-700" to={`/cham-buoi?lop=${l.id}`}>
                      {l.ten_sheet} <span className="text-slate-400">· {l.truong_ma}</span>
                    </Link>
                    {con === 0 ? (
                      <button className="btn-phu btn-nho" onClick={() => hoanThanh.mutate(l)} title="Đã đủ số buổi kế hoạch">
                        Đủ buổi · đánh dấu xong
                      </button>
                    ) : (
                      <span className="shrink-0 text-amber-700">còn {con} buổi</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-700">Lớp vượt số buổi kế hoạch</div>
          {vuot.length === 0 ? (
            <p className="text-sm text-slate-400">Không có.</p>
          ) : (
            <ul className="space-y-1.5">
              {vuot.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link className="min-w-0 truncate hover:text-blue-700" to={`/cham-buoi?lop=${l.id}`}>
                    {l.ten_sheet} <span className="text-slate-400">· {l.truong_ma}</span>
                  </Link>
                  <ThanhTienDo da={l.soBuoi} keHoach={l.so_buoi_ke_hoach} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
