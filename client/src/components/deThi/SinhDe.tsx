import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, khoa } from '../../api';
import type { CauNganHangRutGon, DeDaBoc, MucDo, OCau, ThongTinDe } from '../../api/types';
import { useDsLop } from '../../lib/hooks';
import { thongBao } from '../../lib/thongBao';
import { DangTai } from '../ChungUI';
import { ChonMucDo, dinhDangDiem, docSoDiem, NhanMucDo, taiFile } from './chung';

type OCauNhap = { diem: string; muc_do: MucDo | null };

const tuCauTruc = (ds: OCau[]): OCauNhap[] => ds.map((c) => ({ diem: dinhDangDiem(c.diem), muc_do: c.muc_do }));

export function SinhDe({ onDaSinh, onMoNganHang }: { onDaSinh: () => void; onMoNganHang: (monId: number) => void }) {
  const qc = useQueryClient();
  const { data: dsLop } = useDsLop();
  const { data: dsMon } = useQuery({ queryKey: khoa.dsMon, queryFn: api.mon.ds });
  const { data: dsMau } = useQuery({ queryKey: khoa.mauDe, queryFn: api.mauDe.ds });

  const [lopId, setLopId] = useState<number | null>(null);
  const [monId, setMonId] = useState<number | null>(null);
  const [truongId, setTruongId] = useState<number | null>(null);
  const [mauId, setMauId] = useState<number | null>(null);
  const [tt, setTt] = useState<ThongTinDe | null>(null);
  const [soDe, setSoDe] = useState('2');
  const [cauTruc, setCauTruc] = useState<OCauNhap[]>([
    { diem: '3', muc_do: null },
    { diem: '3', muc_do: null },
    { diem: '4', muc_do: null },
  ]);
  const [xemTruoc, setXemTruoc] = useState<{ de: DeDaBoc[]; canh_bao: string[]; ngan_hang: CauNganHangRutGon[] } | null>(null);

  // Chọn lớp (hoặc môn) → lấy gợi ý thông tin đề, môn, mẫu của trường
  const goiY = useMutation({
    mutationFn: (tc: { lopId?: number; monId?: number }) => api.deThi.goiY(tc),
    onSuccess: (g, tc) => {
      setTt(g.thong_tin);
      setTruongId(g.truong_id);
      setMauId(g.mau_de_id);
      setCauTruc(tuCauTruc(g.cau_truc));
      if (!tc.monId) setMonId(g.mon_id);
      setXemTruoc(null);
    },
  });
  useEffect(() => {
    if (!tt && !goiY.isPending) goiY.mutate({});
    // chỉ chạy lần đầu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lop = dsLop?.find((l) => l.id === lopId);
  const mon = dsMon?.mon.find((m) => m.id === monId);
  const mau = dsMau?.mau.find((m) => m.id === mauId);
  const diemCau = cauTruc.map((c) => docSoDiem(c.diem));
  const tongDiem = diemCau.reduce<number>((s, d) => s + (d ?? 0), 0);
  const cauTrucHopLe = cauTruc.length > 0 && diemCau.every((d) => d !== null);
  const n = Number(soDe);
  const soDeHopLe = Number.isInteger(n) && n >= 1 && n <= 20;
  const cauTrucGui: OCau[] = cauTruc.map((c, i) => ({ diem: diemCau[i]!, muc_do: c.muc_do }));

  const boc = useMutation({
    mutationFn: () => api.deThi.xemTruoc({ mon_id: monId!, so_de: n, cau_truc: cauTrucGui }),
    onSuccess: (kq) => setXemTruoc(kq),
  });
  const sinh = useMutation({
    mutationFn: () =>
      api.deThi.tao({
        mon_id: monId!,
        lop_id: lopId,
        truong_id: truongId,
        mau_de_id: mauId!,
        thong_tin: tt!,
        de: xemTruoc!.de.map((d) => ({ cau: d.cau })),
      }),
    onSuccess: (kq) => {
      qc.invalidateQueries({ queryKey: khoa.deThi });
      qc.invalidateQueries({ queryKey: ['mon'] });
      taiFile(api.deThi.urlTai(kq.id));
      thongBao(`Đã sinh đề: ${kq.ten_file}`);
      onDaSinh();
    },
  });

  // Đổi cấu hình thì bản xem trước cũ không còn đúng
  useEffect(() => setXemTruoc(null), [monId, soDe, JSON.stringify(cauTruc)]);

  const nhomLop = useMemo(() => {
    const m = new Map<string, NonNullable<typeof dsLop>>();
    for (const l of dsLop ?? []) {
      const k = `${l.truong_ma} — ${l.truong_ten}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return [...m];
  }, [dsLop]);

  if (!tt || !dsMon || !dsMau) return <DangTai />;
  const doiTt = <K extends keyof ThongTinDe>(k: K, v: ThongTinDe[K]) => setTt({ ...tt, [k]: v });
  const suaO = (i: number, d: Partial<OCauNhap>) => setCauTruc(cauTruc.map((c, j) => (j === i ? { ...c, ...d } : c)));
  const coTheBoc = !!monId && !!mauId && cauTrucHopLe && soDeHopLe && !!tt.hoc_phan.trim();

  return (
    <div className="space-y-4">
      <section className="the p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="nhan" htmlFor="sd-lop">
              1. Lớp thi
            </label>
            <select
              id="sd-lop"
              className="o-nhap"
              value={lopId ?? ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setLopId(id);
                goiY.mutate(id ? { lopId: id } : {});
              }}
            >
              <option value="">— Không gắn lớp —</option>
              {nhomLop.map(([truong, ds]) => (
                <optgroup key={truong} label={truong}>
                  {ds.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.ten_sheet} — {l.hoc_phan}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Chọn lớp để tự điền học phần, mã lớp, mẫu đề của trường.</p>
          </div>
          <div>
            <label className="nhan" htmlFor="sd-mon">
              2. Môn (ngân hàng câu hỏi)
            </label>
            <select
              id="sd-mon"
              className={`o-nhap ${monId ? '' : 'border-amber-400'}`}
              value={monId ?? ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setMonId(id);
                const m = dsMon.mon.find((x) => x.id === id);
                if (m) setTt({ ...tt, hoc_phan: lop?.hoc_phan ?? m.ten, ma_hoc_phan: m.ma ?? '', nganh: m.nganh, trinh_do: m.trinh_do });
              }}
            >
              <option value="">— Chọn môn —</option>
              {dsMon.mon.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ten} ({m.so_cau} câu)
                </option>
              ))}
            </select>
            {!monId && lop && (
              <p className="mt-1 text-xs text-amber-700">
                Chưa có ngân hàng cho "{lop.hoc_phan}". Thêm môn này ở tab Ngân hàng câu hỏi.
              </p>
            )}
            {mon && mon.so_cau < cauTruc.length && (
              <p className="mt-1 text-xs text-amber-700">
                Ngân hàng mới có {mon.so_cau} câu.{' '}
                <button className="lien-ket" onClick={() => onMoNganHang(mon.id)}>
                  Thêm câu hỏi
                </button>
              </p>
            )}
          </div>
          <div>
            <label className="nhan" htmlFor="sd-mau">
              3. Mẫu đề
            </label>
            <select
              id="sd-mau"
              className="o-nhap"
              value={mauId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setMauId(id);
                const m = dsMau.mau.find((x) => x.id === id);
                if (m) {
                  setCauTruc(tuCauTruc(m.cau_truc.map((diem) => ({ diem, muc_do: null }))));
                  setTt({ ...tt, thoi_gian: m.thoi_gian });
                }
              }}
            >
              {dsMau.mau.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ten}
                </option>
              ))}
            </select>
            {mau && !mau.truong_id && lop && (
              <p className="mt-1 text-xs text-slate-500">Trường {lop.truong_ma} chưa có mẫu riêng — dùng mẫu chung.</p>
            )}
          </div>
        </div>
      </section>

      <section className="the">
        <div className="the-dau">
          <h2 className="font-medium">Thông tin in trên đề</h2>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <O nhan="Học phần" id="tt-hp">
            <input id="tt-hp" className="o-nhap" required value={tt.hoc_phan} onChange={(e) => doiTt('hoc_phan', e.target.value)} />
          </O>
          <O nhan="Mã học phần" id="tt-ma">
            <input id="tt-ma" className="o-nhap" value={tt.ma_hoc_phan} onChange={(e) => doiTt('ma_hoc_phan', e.target.value)} />
          </O>
          <O nhan="Lớp" id="tt-lop">
            <input id="tt-lop" className="o-nhap" value={tt.lop} onChange={(e) => doiTt('lop', e.target.value)} />
          </O>
          <O nhan="Trường (in ở mẫu chung)" id="tt-truong">
            <input id="tt-truong" className="o-nhap" value={tt.truong} onChange={(e) => doiTt('truong', e.target.value)} />
          </O>
          <O nhan="Ngành" id="tt-nganh">
            <input id="tt-nganh" className="o-nhap" value={tt.nganh} onChange={(e) => doiTt('nganh', e.target.value)} />
          </O>
          <O nhan="Trình độ" id="tt-td">
            <input id="tt-td" className="o-nhap" value={tt.trinh_do} onChange={(e) => doiTt('trinh_do', e.target.value)} />
          </O>
          <O nhan="Năm học / Học kỳ" id="tt-nh">
            <div className="flex gap-2">
              <input id="tt-nh" className="o-nhap" value={tt.nam_hoc} onChange={(e) => doiTt('nam_hoc', e.target.value)} />
              <input className="o-nhap w-16" aria-label="Học kỳ" value={tt.hoc_ky} onChange={(e) => doiTt('hoc_ky', e.target.value)} />
            </div>
          </O>
          <O nhan="Hình thức thi" id="tt-ht">
            <input id="tt-ht" className="o-nhap" value={tt.hinh_thuc} onChange={(e) => doiTt('hinh_thuc', e.target.value)} />
          </O>
          <O nhan="Thời gian làm bài (phút)" id="tt-tg">
            <input
              id="tt-tg"
              type="number"
              min={5}
              max={600}
              className="o-nhap"
              value={tt.thoi_gian}
              onChange={(e) => doiTt('thoi_gian', Number(e.target.value))}
            />
          </O>
          <O nhan="Ngày thi" id="tt-ngay">
            <input id="tt-ngay" className="o-nhap" value={tt.ngay_thi} onChange={(e) => doiTt('ngay_thi', e.target.value)} />
          </O>
          <O nhan="Tài liệu" id="tt-tl">
            <select id="tt-tl" className="o-nhap" value={tt.tai_lieu ? '1' : '0'} onChange={(e) => doiTt('tai_lieu', e.target.value === '1')}>
              <option value="0">Không được sử dụng tài liệu</option>
              <option value="1">Được sử dụng tài liệu</option>
            </select>
          </O>
        </div>
      </section>

      <section className="the">
        <div className="the-dau">
          <h2 className="font-medium">Cấu trúc đề</h2>
          <span className={`text-sm tabular-nums ${Math.abs(tongDiem - 10) < 1e-9 ? 'text-emerald-700' : 'text-amber-700'}`}>
            Tổng {dinhDangDiem(tongDiem)} điểm{Math.abs(tongDiem - 10) < 1e-9 ? '' : ' (thường là 10)'}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <label className="nhan" htmlFor="sd-so-de">
              Số đề
            </label>
            <input id="sd-so-de" type="number" min={1} max={20} className="o-nhap w-20" value={soDe} onChange={(e) => setSoDe(e.target.value)} />
          </div>
          {cauTruc.map((c, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
                Câu {i + 1}
                {cauTruc.length > 1 && (
                  <button
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Bỏ câu ${i + 1}`}
                    onClick={() => setCauTruc(cauTruc.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  className={`o-nhap w-14 py-1 ${diemCau[i] === null ? 'border-red-400' : ''}`}
                  aria-label={`Điểm câu ${i + 1}`}
                  value={c.diem}
                  onChange={(e) => suaO(i, { diem: e.target.value })}
                />
                <ChonMucDo
                  className="o-nhap w-auto py-1 text-xs"
                  aria-label={`Mức độ câu ${i + 1}`}
                  giaTri={c.muc_do}
                  onDoi={(v) => suaO(i, { muc_do: v })}
                  choPhepTrong="Mức bất kỳ"
                />
              </div>
            </div>
          ))}
          <button className="btn-phu btn-nho mb-1" onClick={() => setCauTruc([...cauTruc, { diem: '1', muc_do: null }])}>
            + Thêm câu
          </button>
          <button className="btn-chinh ml-auto" disabled={!coTheBoc || boc.isPending} onClick={() => boc.mutate()}>
            {boc.isPending ? 'Đang bốc…' : xemTruoc ? 'Bốc lại' : 'Bốc đề (xem trước)'}
          </button>
        </div>
      </section>

      {xemTruoc && (
        <XemTruoc
          ketQua={xemTruoc}
          setDe={(de) => setXemTruoc({ ...xemTruoc, de })}
          dangSinh={sinh.isPending}
          onSinh={() => sinh.mutate()}
        />
      )}
    </div>
  );
}

function O({ nhan, id, children }: { nhan: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="nhan" htmlFor={id}>
        {nhan}
      </label>
      {children}
    </div>
  );
}

function XemTruoc({
  ketQua,
  setDe,
  dangSinh,
  onSinh,
}: {
  ketQua: { de: DeDaBoc[]; canh_bao: string[]; ngan_hang: CauNganHangRutGon[] };
  setDe: (de: DeDaBoc[]) => void;
  dangSinh: boolean;
  onSinh: () => void;
}) {
  const theoId = new Map(ketQua.ngan_hang.map((c) => [c.id, c]));
  const [moDapAn, setMoDapAn] = useState(false);
  const doiCau = (d: number, i: number, id: number) =>
    setDe(ketQua.de.map((de, j) => (j !== d ? de : { ...de, cau: de.cau.map((c, k) => (k === i ? { ...c, cau_hoi_id: id } : c)) })));

  // Số đề dùng mỗi câu (để báo câu bị trùng giữa các đề)
  const demDung = new Map<number, number>();
  for (const d of ketQua.de) for (const c of d.cau) demDung.set(c.cau_hoi_id, (demDung.get(c.cau_hoi_id) ?? 0) + 1);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Xem trước {ketQua.de.length} đề</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={moDapAn} onChange={(e) => setMoDapAn(e.target.checked)} />
          Hiện đáp án
        </label>
      </div>
      {ketQua.canh_bao.map((c) => (
        <p key={c} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {c}
        </p>
      ))}
      <div className="grid gap-3 xl:grid-cols-2">
        {ketQua.de.map((de, d) => {
          const trongDe = new Set(de.cau.map((c) => c.cau_hoi_id));
          return (
            <div key={d} className="the p-4">
              <div className="mb-2 font-semibold">Đề số {String(d + 1).padStart(2, '0')}</div>
              <ol className="space-y-3">
                {de.cau.map((c, i) => {
                  const ch = theoId.get(c.cau_hoi_id)!;
                  return (
                    <li key={i}>
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">
                          Câu {i + 1} ({dinhDangDiem(c.diem)} điểm):
                        </span>
                        <NhanMucDo mucDo={ch.muc_do} />
                        {(demDung.get(c.cau_hoi_id) ?? 0) > 1 && <span className="text-xs text-amber-700">trùng với đề khác</span>}
                        <select
                          className="ml-auto max-w-56 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
                          aria-label={`Đổi câu ${i + 1} đề ${d + 1}`}
                          value={c.cau_hoi_id}
                          onChange={(e) => doiCau(d, i, Number(e.target.value))}
                        >
                          {ketQua.ngan_hang
                            .filter((x) => x.id === c.cau_hoi_id || !trongDe.has(x.id))
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.id === c.cau_hoi_id ? 'Đổi câu khác…' : `${x.noi_dung.slice(0, 70)}${x.noi_dung.length > 70 ? '…' : ''}`}
                              </option>
                            ))}
                        </select>
                      </div>
                      <p className="whitespace-pre-line text-sm text-slate-800">{ch.noi_dung}</p>
                      {moDapAn && (
                        <p className="mt-1 whitespace-pre-line rounded bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600">
                          {ch.dap_an || <i className="text-amber-700">Chưa có đáp án</i>}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button className="btn-chinh px-5 py-2" disabled={dangSinh} onClick={onSinh}>
          {dangSinh ? 'Đang tạo file…' : 'Sinh file Word (đề + đáp án)'}
        </button>
      </div>
    </section>
  );
}
