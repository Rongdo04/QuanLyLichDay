import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, khoa } from '../../api';
import type { CauHoi, DuLieuCauHoi, Mon, MucDo } from '../../api/types';
import { thongBao } from '../../lib/thongBao';
import { BaoLoiTai, DangTai, Modal, TrongRong } from '../ChungUI';
import { ChonMucDo, dinhDangDiem, docDanhSachDiem, docSoDiem, NHAN_MUC_DO, NhanMucDo } from './chung';

export function NganHangCauHoi({ monChon, onChonMon }: { monChon: number | null; onChonMon: (id: number | null) => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: khoa.dsMon, queryFn: api.mon.ds });
  const [moThemMon, setMoThemMon] = useState(false);
  const dsMon = data?.mon ?? [];
  const monId = monChon && dsMon.some((m) => m.id === monChon) ? monChon : (dsMon[0]?.id ?? null);

  if (isLoading) return <DangTai />;
  if (error) return <BaoLoiTai loi={error} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="the h-fit overflow-hidden">
        <div className="the-dau">
          <h2 className="font-medium">Môn học</h2>
          <button className="btn-phu btn-nho" onClick={() => setMoThemMon(true)}>
            + Thêm môn
          </button>
        </div>
        {dsMon.length === 0 ? (
          <TrongRong>Chưa có môn nào.</TrongRong>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {dsMon.map((m) => (
              <li key={m.id}>
                <button
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm ${
                    m.id === monId ? 'bg-blue-50 font-medium text-blue-800' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onChonMon(m.id)}
                >
                  <span className="min-w-0 truncate">{m.ten}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${m.so_cau ? 'text-slate-500' : 'text-amber-600'}`}>
                    {m.so_cau} câu
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!!data?.goi_y.length && (
          <div className="border-t border-slate-200 px-4 py-3">
            <div className="mb-1.5 text-xs text-slate-500">Học phần đang dạy chưa có ngân hàng:</div>
            <div className="flex flex-wrap gap-1.5">
              {data.goi_y.map((ten) => (
                <TaoMonNhanh key={ten} ten={ten} onTao={onChonMon} />
              ))}
            </div>
          </div>
        )}
      </aside>

      {monId ? <ChiTietMon key={monId} monId={monId} onXoa={() => onChonMon(null)} /> : (
        <div className="the">
          <TrongRong>Thêm môn học để bắt đầu soạn ngân hàng câu hỏi.</TrongRong>
        </div>
      )}

      <Modal mo={moThemMon} tieuDe="Thêm môn học" onDong={() => setMoThemMon(false)}>
        <FormMon
          onXong={(m) => {
            setMoThemMon(false);
            onChonMon(m.id);
          }}
        />
      </Modal>
    </div>
  );
}

function TaoMonNhanh({ ten, onTao }: { ten: string; onTao: (id: number) => void }) {
  const qc = useQueryClient();
  const tao = useMutation({
    mutationFn: () => api.mon.tao({ ten }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mon'] });
      thongBao(`Đã thêm môn "${m.ten}"`);
      onTao(m.id);
    },
  });
  return (
    <button className="btn-phu btn-nho" disabled={tao.isPending} onClick={() => tao.mutate()} title="Tạo môn này">
      + {ten}
    </button>
  );
}

function FormMon({ mon, onXong }: { mon?: Mon; onXong: (m: Mon) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    ten: mon?.ten ?? '',
    ma: mon?.ma ?? '',
    nganh: mon?.nganh ?? 'Công nghệ thông tin',
    trinh_do: mon?.trinh_do ?? 'Trung cấp',
    de_cuong: mon?.de_cuong ?? '',
  });
  const luu = useMutation({
    mutationFn: () => {
      const d = { ...f, ma: f.ma.trim() || null, de_cuong: f.de_cuong.trim() || null };
      return mon ? api.mon.sua(mon.id, d) : api.mon.tao(d);
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['mon'] });
      thongBao(mon ? 'Đã lưu thông tin môn' : `Đã thêm môn "${m.ten}"`);
      onXong(m);
    },
  });
  const gui = (e: FormEvent) => {
    e.preventDefault();
    luu.mutate();
  };
  return (
    <form onSubmit={gui} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="nhan" htmlFor="mon-ten">
            Tên môn / học phần
          </label>
          <input id="mon-ten" className="o-nhap" required autoFocus value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} />
          <p className="mt-1 text-xs text-slate-500">Đặt giống tên học phần của lớp để phần mềm tự nhận ra khi sinh đề.</p>
        </div>
        <div>
          <label className="nhan" htmlFor="mon-ma">
            Mã học phần
          </label>
          <input id="mon-ma" className="o-nhap" placeholder="VD: CT14" value={f.ma} onChange={(e) => setF({ ...f, ma: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="nhan" htmlFor="mon-nganh">
            Ngành
          </label>
          <input id="mon-nganh" className="o-nhap" required value={f.nganh} onChange={(e) => setF({ ...f, nganh: e.target.value })} />
        </div>
        <div>
          <label className="nhan" htmlFor="mon-trinh-do">
            Trình độ đào tạo
          </label>
          <input id="mon-trinh-do" className="o-nhap" required value={f.trinh_do} onChange={(e) => setF({ ...f, trinh_do: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="nhan" htmlFor="mon-de-cuong">
          Nội dung / đề cương môn <span className="font-normal text-slate-400">(không bắt buộc)</span>
        </label>
        <textarea
          id="mon-de-cuong"
          className="o-nhap min-h-28 font-mono text-xs"
          placeholder={'Dán mục lục giáo trình hoặc đề cương, VD:\nChương 1: Tổng quan về HTML\nChương 2: Định dạng bằng CSS\n…'}
          value={f.de_cuong}
          onChange={(e) => setF({ ...f, de_cuong: e.target.value })}
        />
        <p className="mt-1 text-xs text-slate-500">AI sẽ chỉ ra câu hỏi trong phạm vi nội dung này.</p>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-chinh" disabled={luu.isPending}>
          {luu.isPending ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </form>
  );
}

type Loc = { chuDe: string; mucDo: MucDo | null; tim: string };

function ChiTietMon({ monId, onXoa }: { monId: number; onXoa: () => void }) {
  const qc = useQueryClient();
  const { data: mon, isLoading, error } = useQuery({ queryKey: khoa.mon(monId), queryFn: () => api.mon.ct(monId) });
  const [moSuaMon, setMoSuaMon] = useState(false);
  const [suaCau, setSuaCau] = useState<CauHoi | 'moi' | null>(null);
  const [moDan, setMoDan] = useState(false);
  const [moAi, setMoAi] = useState(false);
  const [loc, setLoc] = useState<Loc>({ chuDe: '', mucDo: null, tim: '' });
  const [moRong, setMoRong] = useState<Set<number>>(new Set());

  const xoaMon = useMutation({
    mutationFn: () => api.mon.xoa(monId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mon'] });
      thongBao('Đã xóa môn');
      onXoa();
    },
  });
  const xoaCau = useMutation({
    mutationFn: (id: number) => api.cauHoi.xoa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mon'] }),
  });

  const dsChuDe = useMemo(
    () => [...new Set((mon?.cau_hoi ?? []).map((c) => c.chu_de).filter((x): x is string => !!x))].sort(),
    [mon],
  );
  const dsLoc = (mon?.cau_hoi ?? []).filter((c) => {
    if (loc.chuDe && c.chu_de !== loc.chuDe) return false;
    if (loc.mucDo && c.muc_do !== loc.mucDo) return false;
    if (loc.tim) {
      const t = loc.tim.toLowerCase();
      if (!c.noi_dung.toLowerCase().includes(t) && !c.dap_an.toLowerCase().includes(t)) return false;
    }
    return true;
  });

  if (isLoading) return <DangTai />;
  if (error || !mon) return <BaoLoiTai loi={error} />;

  const demMuc = (m: MucDo) => mon.cau_hoi.filter((c) => c.muc_do === m).length;
  const doiMoRong = (id: number) => {
    const s = new Set(moRong);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setMoRong(s);
  };

  return (
    <section className="min-w-0 space-y-4">
      <div className="the p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mon.ten} {mon.ma && <span className="font-normal text-slate-500">({mon.ma})</span>}
            </h2>
            <div className="text-sm text-slate-500">
              {mon.nganh} · {mon.trinh_do} · {mon.cau_hoi.length} câu hỏi (dễ {demMuc('de')}, trung bình {demMuc('tb')}, khó{' '}
              {demMuc('kho')})
            </div>
            {!mon.de_cuong && (
              <div className="mt-1 text-xs text-amber-700">
                Chưa có đề cương môn — nên{' '}
                <button className="lien-ket" onClick={() => setMoSuaMon(true)}>
                  thêm đề cương
                </button>{' '}
                để AI soạn đúng chương trình.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn-phu btn-nho" onClick={() => setMoSuaMon(true)}>
              Sửa môn
            </button>
            <button
              className="btn-nguy btn-nho"
              onClick={() =>
                confirm(`Xóa môn "${mon.ten}" và ${mon.cau_hoi.length} câu hỏi của môn? Không thể hoàn tác.`) && xoaMon.mutate()
              }
            >
              Xóa môn
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-chinh" onClick={() => setMoAi(true)}>
            ✨ AI soạn câu hỏi
          </button>
          <button className="btn-phu" onClick={() => setSuaCau('moi')}>
            + Thêm câu
          </button>
          <button className="btn-phu" onClick={() => setMoDan(true)}>
            Dán câu hỏi từ Word
          </button>
        </div>
      </div>

      <div className="the overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5">
          <select className="o-nhap w-auto py-1" aria-label="Lọc chủ đề" value={loc.chuDe} onChange={(e) => setLoc({ ...loc, chuDe: e.target.value })}>
            <option value="">Mọi chủ đề</option>
            {dsChuDe.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <ChonMucDo
            className="o-nhap w-auto py-1"
            aria-label="Lọc mức độ"
            giaTri={loc.mucDo}
            onDoi={(v) => setLoc({ ...loc, mucDo: v })}
            choPhepTrong="Mọi mức độ"
          />
          <input
            className="o-nhap w-56 py-1"
            aria-label="Tìm câu hỏi"
            placeholder="Tìm trong câu hỏi, đáp án…"
            value={loc.tim}
            onChange={(e) => setLoc({ ...loc, tim: e.target.value })}
          />
          <span className="ml-auto text-xs text-slate-500">
            {dsLoc.length}/{mon.cau_hoi.length} câu
          </span>
        </div>
        {mon.cau_hoi.length === 0 ? (
          <TrongRong>
            Ngân hàng trống. Bấm <b>AI soạn câu hỏi</b> để có ngay câu hỏi kèm đáp án, hoặc dán câu hỏi từ đề cũ.
          </TrongRong>
        ) : dsLoc.length === 0 ? (
          <TrongRong>Không có câu nào khớp bộ lọc.</TrongRong>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dsLoc.map((c, i) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-slate-400">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <NhanMucDo mucDo={c.muc_do} />
                      {c.diem != null && <span className="text-slate-600">{dinhDangDiem(c.diem)} điểm</span>}
                      {c.chu_de && <span className="text-slate-500">· {c.chu_de}</span>}
                      {c.nguon === 'ai' && <span className="text-violet-600">· AI soạn</span>}
                      {c.so_lan_dung > 0 && <span className="text-slate-400">· đã dùng {c.so_lan_dung} lần</span>}
                      {!c.dap_an && <span className="text-amber-600">· chưa có đáp án</span>}
                    </div>
                    <p className="whitespace-pre-line text-sm text-slate-800">{c.noi_dung}</p>
                    {c.dap_an && (
                      <button className="lien-ket mt-1 text-xs" onClick={() => doiMoRong(c.id)}>
                        {moRong.has(c.id) ? 'Ẩn đáp án' : 'Xem đáp án'}
                      </button>
                    )}
                    {moRong.has(c.id) && (
                      <p className="mt-1 whitespace-pre-line rounded bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600">{c.dap_an}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="btn-phu btn-nho" onClick={() => setSuaCau(c)}>
                      Sửa
                    </button>
                    <button
                      className="btn-nho text-xs text-slate-400 hover:text-red-600"
                      onClick={() => confirm('Xóa câu hỏi này khỏi ngân hàng?') && xoaCau.mutate(c.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal mo={moSuaMon} tieuDe="Sửa môn học" onDong={() => setMoSuaMon(false)} rong="max-w-2xl">
        <FormMon mon={mon} onXong={() => setMoSuaMon(false)} />
      </Modal>
      <Modal mo={!!suaCau} tieuDe={suaCau === 'moi' ? 'Thêm câu hỏi' : 'Sửa câu hỏi'} onDong={() => setSuaCau(null)} rong="max-w-2xl">
        {suaCau && <FormCauHoi monId={monId} cau={suaCau === 'moi' ? undefined : suaCau} dsChuDe={dsChuDe} onXong={() => setSuaCau(null)} />}
      </Modal>
      <Modal mo={moDan} tieuDe="Dán câu hỏi từ Word" onDong={() => setMoDan(false)} rong="max-w-4xl">
        <DanVanBan monId={monId} dsChuDe={dsChuDe} onXong={() => setMoDan(false)} />
      </Modal>
      <Modal mo={moAi} tieuDe={`AI soạn câu hỏi — ${mon.ten}`} onDong={() => setMoAi(false)} rong="max-w-4xl">
        <AiSoan monId={monId} dsChuDe={dsChuDe} onXong={() => setMoAi(false)} />
      </Modal>
    </section>
  );
}

function FormCauHoi({ monId, cau, dsChuDe, onXong }: { monId: number; cau?: CauHoi; dsChuDe: string[]; onXong: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    chu_de: cau?.chu_de ?? '',
    muc_do: (cau?.muc_do ?? 'tb') as MucDo,
    diem: dinhDangDiem(cau?.diem ?? null),
    noi_dung: cau?.noi_dung ?? '',
    dap_an: cau?.dap_an ?? '',
  });
  const diem = f.diem.trim() ? docSoDiem(f.diem) : null;
  const loiDiem = f.diem.trim() !== '' && diem === null;
  const luu = useMutation({
    mutationFn: async () => {
      const d: DuLieuCauHoi = { chu_de: f.chu_de.trim() || null, muc_do: f.muc_do, diem, noi_dung: f.noi_dung, dap_an: f.dap_an };
      if (cau) await api.cauHoi.sua(cau.id, d);
      else await api.mon.themCau(monId, [d]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mon'] });
      thongBao(cau ? 'Đã lưu câu hỏi' : 'Đã thêm câu hỏi');
      onXong();
    },
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!loiDiem) luu.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_150px_110px]">
        <div>
          <label className="nhan" htmlFor="ch-chu-de">
            Chủ đề / chương
          </label>
          <input id="ch-chu-de" className="o-nhap" list="ds-chu-de" value={f.chu_de} onChange={(e) => setF({ ...f, chu_de: e.target.value })} />
          <datalist id="ds-chu-de">
            {dsChuDe.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="nhan" htmlFor="ch-muc-do">
            Mức độ
          </label>
          <ChonMucDo id="ch-muc-do" giaTri={f.muc_do} onDoi={(v) => setF({ ...f, muc_do: v ?? 'tb' })} />
        </div>
        <div>
          <label className="nhan" htmlFor="ch-diem">
            Điểm
          </label>
          <input
            id="ch-diem"
            className={`o-nhap ${loiDiem ? 'border-red-400' : ''}`}
            placeholder="VD: 3"
            value={f.diem}
            onChange={(e) => setF({ ...f, diem: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="nhan" htmlFor="ch-noi-dung">
          Câu hỏi
        </label>
        <textarea
          id="ch-noi-dung"
          className="o-nhap min-h-24"
          required
          autoFocus
          value={f.noi_dung}
          onChange={(e) => setF({ ...f, noi_dung: e.target.value })}
        />
      </div>
      <div>
        <label className="nhan" htmlFor="ch-dap-an">
          Đáp án / hướng dẫn chấm
        </label>
        <textarea
          id="ch-dap-an"
          className="o-nhap min-h-32"
          placeholder={'- Ý thứ nhất (1 điểm)\n- Ý thứ hai (2 điểm)'}
          value={f.dap_an}
          onChange={(e) => setF({ ...f, dap_an: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-phu" onClick={onXong}>
          Hủy
        </button>
        <button className="btn-chinh" disabled={luu.isPending || loiDiem}>
          {luu.isPending ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </form>
  );
}

// Bản nháp câu hỏi (từ văn bản dán vào hoặc AI soạn) để duyệt trước khi lưu
interface CauNhap {
  chon: boolean;
  chu_de: string;
  muc_do: MucDo;
  diem: string;
  noi_dung: string;
  dap_an: string;
}

function DuyetCauNhap({
  ds,
  setDs,
  dsChuDe,
}: {
  ds: CauNhap[];
  setDs: (d: CauNhap[]) => void;
  dsChuDe: string[];
}) {
  const sua = (i: number, d: Partial<CauNhap>) => setDs(ds.map((x, j) => (j === i ? { ...x, ...d } : x)));
  return (
    <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
      {ds.map((c, i) => (
        <li key={i} className={`rounded-md border p-3 ${c.chon ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input type="checkbox" aria-label={`Chọn câu ${i + 1}`} checked={c.chon} onChange={(e) => sua(i, { chon: e.target.checked })} />
            <span className="text-sm font-medium">Câu {i + 1}</span>
            <input
              className="o-nhap w-44 py-1 text-xs"
              aria-label="Chủ đề"
              placeholder="Chủ đề"
              list="ds-chu-de-nhap"
              value={c.chu_de}
              onChange={(e) => sua(i, { chu_de: e.target.value })}
            />
            <ChonMucDo className="o-nhap w-auto py-1 text-xs" aria-label="Mức độ" giaTri={c.muc_do} onDoi={(v) => sua(i, { muc_do: v ?? 'tb' })} />
            <input
              className={`o-nhap w-20 py-1 text-xs ${c.diem.trim() && docSoDiem(c.diem) === null ? 'border-red-400' : ''}`}
              aria-label="Điểm"
              placeholder="Điểm"
              value={c.diem}
              onChange={(e) => sua(i, { diem: e.target.value })}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <textarea
              className="o-nhap min-h-24 text-sm"
              aria-label="Câu hỏi"
              value={c.noi_dung}
              onChange={(e) => sua(i, { noi_dung: e.target.value })}
            />
            <textarea
              className="o-nhap min-h-24 text-sm text-slate-600"
              aria-label="Đáp án"
              placeholder="Đáp án"
              value={c.dap_an}
              onChange={(e) => sua(i, { dap_an: e.target.value })}
            />
          </div>
        </li>
      ))}
      <datalist id="ds-chu-de-nhap">
        {dsChuDe.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </ul>
  );
}

function useLuuCauNhap(monId: number, nguon: 'tay' | 'ai', onXong: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ds: CauNhap[]) =>
      api.mon.themCau(
        monId,
        ds
          .filter((c) => c.chon && c.noi_dung.trim())
          .map((c) => ({
            chu_de: c.chu_de.trim() || null,
            muc_do: c.muc_do,
            diem: docSoDiem(c.diem),
            noi_dung: c.noi_dung,
            dap_an: c.dap_an,
            nguon,
          })),
      ),
    onSuccess: (kq) => {
      qc.invalidateQueries({ queryKey: ['mon'] });
      thongBao(`Đã lưu ${kq.so_cau} câu vào ngân hàng`);
      onXong();
    },
  });
}

function DanVanBan({ monId, dsChuDe, onXong }: { monId: number; dsChuDe: string[]; onXong: () => void }) {
  const [vanBan, setVanBan] = useState('');
  const [chuDe, setChuDe] = useState('');
  const [mucDo, setMucDo] = useState<MucDo>('tb');
  const [ds, setDs] = useState<CauNhap[] | null>(null);
  const tach = useMutation({
    mutationFn: () => api.mon.tachVanBan(monId, vanBan),
    onSuccess: (kq) => {
      if (!kq.length) thongBao('Không tìm thấy câu nào. Mỗi câu cần bắt đầu bằng "Câu 1", "Câu 2"…', 'loi');
      setDs(kq.map((c) => ({ chon: true, chu_de: chuDe, muc_do: mucDo, diem: dinhDangDiem(c.diem), noi_dung: c.noi_dung, dap_an: c.dap_an })));
    },
  });
  const luu = useLuuCauNhap(monId, 'tay', onXong);
  const soChon = ds?.filter((c) => c.chon).length ?? 0;

  if (ds?.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Tách được <b>{ds.length}</b> câu. Kiểm tra lại, bỏ chọn câu không muốn lưu.
        </p>
        <DuyetCauNhap ds={ds} setDs={setDs} dsChuDe={dsChuDe} />
        <div className="flex justify-between gap-2">
          <button className="btn-phu" onClick={() => setDs(null)}>
            ‹ Dán lại
          </button>
          <button className="btn-chinh" disabled={!soChon || luu.isPending} onClick={() => luu.mutate(ds)}>
            {luu.isPending ? 'Đang lưu…' : `Lưu ${soChon} câu vào ngân hàng`}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Mở đề thi cũ trong Word, chọn hết (Ctrl+A), chép (Ctrl+C) rồi dán vào đây. Mỗi câu bắt đầu bằng <b>"Câu 1"</b>,{' '}
        <b>"Câu 2"</b>…; đáp án ghi sau chữ <b>"Đáp án:"</b> ngay dưới câu, hoặc gom thành phần <b>ĐÁP ÁN</b> riêng ở cuối.
      </p>
      <textarea
        className="o-nhap min-h-64 font-mono text-xs"
        aria-label="Văn bản dán vào"
        autoFocus
        placeholder={'Câu 1 (3 điểm): Trình bày khái niệm HTML…\nĐáp án:\n- HTML là … (1 điểm)\n\nCâu 2 (3 điểm): …'}
        value={vanBan}
        onChange={(e) => setVanBan(e.target.value)}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="nhan" htmlFor="dan-chu-de">
            Chủ đề chung (không bắt buộc)
          </label>
          <input id="dan-chu-de" className="o-nhap w-56" list="ds-chu-de-dan" value={chuDe} onChange={(e) => setChuDe(e.target.value)} />
          <datalist id="ds-chu-de-dan">
            {dsChuDe.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="nhan" htmlFor="dan-muc-do">
            Mức độ
          </label>
          <ChonMucDo id="dan-muc-do" className="o-nhap w-40" giaTri={mucDo} onDoi={(v) => setMucDo(v ?? 'tb')} />
        </div>
        <button className="btn-chinh ml-auto" disabled={!vanBan.trim() || tach.isPending} onClick={() => tach.mutate()}>
          Tách câu hỏi
        </button>
      </div>
    </div>
  );
}

const THOI_GIAN_CHO = ['Đang gửi yêu cầu…', 'AI đang soạn câu hỏi…', 'AI đang viết đáp án và thang điểm…', 'Sắp xong…'];

function AiSoan({ monId, dsChuDe, onXong }: { monId: number; dsChuDe: string[]; onXong: () => void }) {
  const { data: ai, isLoading } = useQuery({ queryKey: khoa.ai, queryFn: api.ai.lay });
  const [soCau, setSoCau] = useState('6');
  const [diem, setDiem] = useState('3; 3; 4');
  const [mucDo, setMucDo] = useState<MucDo | 'tron'>('tron');
  const [chuDe, setChuDe] = useState('');
  const [yeuCau, setYeuCau] = useState('');
  const [ds, setDs] = useState<CauNhap[] | null>(null);
  const [buoc, setBuoc] = useState(0);
  const dsDiem = docDanhSachDiem(diem);
  const n = Number(soCau);
  const hopLe = !!dsDiem && Number.isInteger(n) && n >= 1 && n <= 20;

  const soan = useMutation({
    mutationFn: () =>
      api.mon.aiSoan(monId, {
        so_cau: n,
        diem: dsDiem!,
        muc_do: mucDo,
        chu_de: chuDe.trim() || null,
        yeu_cau_them: yeuCau.trim() || null,
      }),
    onSuccess: (kq) =>
      setDs(kq.map((c) => ({ chon: true, chu_de: c.chu_de ?? '', muc_do: c.muc_do, diem: dinhDangDiem(c.diem), noi_dung: c.noi_dung, dap_an: c.dap_an }))),
  });
  const luu = useLuuCauNhap(monId, 'ai', onXong);

  // Chữ chạy trong lúc chờ AI (thường 30 giây – 1 phút)
  useEffect(() => {
    if (!soan.isPending) return setBuoc(0);
    const t = setInterval(() => setBuoc((b) => Math.min(b + 1, THOI_GIAN_CHO.length - 1)), 12000);
    return () => clearInterval(t);
  }, [soan.isPending]);

  if (isLoading) return <DangTai />;
  if (!ai?.co_khoa) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Để AI soạn câu hỏi, cần có <b>API key của Claude</b> (tài khoản tại{' '}
          <a className="lien-ket" href="https://console.anthropic.com" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          , trả phí theo lượt dùng).
        </p>
        <Link className="btn-chinh" to="/cai-dat#ai">
          Nhập API key trong Cài đặt
        </Link>
        <p className="text-slate-500">Không có key vẫn dùng được ngân hàng câu hỏi: thêm câu bằng tay hoặc dán từ Word.</p>
      </div>
    );
  }

  if (ds) {
    const soChon = ds.filter((c) => c.chon).length;
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          AI đã soạn <b>{ds.length}</b> câu. Hãy đọc kỹ, sửa nếu cần và bỏ chọn câu chưa đạt trước khi lưu vào ngân hàng.
        </p>
        <DuyetCauNhap ds={ds} setDs={setDs} dsChuDe={dsChuDe} />
        <div className="flex justify-between gap-2">
          <button className="btn-phu" onClick={() => setDs(null)}>
            ‹ Soạn lại
          </button>
          <button className="btn-chinh" disabled={!soChon || luu.isPending} onClick={() => luu.mutate(ds)}>
            {luu.isPending ? 'Đang lưu…' : `Lưu ${soChon} câu vào ngân hàng`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (hopLe) soan.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="nhan" htmlFor="ai-so-cau">
            Số câu
          </label>
          <input id="ai-so-cau" type="number" min={1} max={20} className="o-nhap" value={soCau} onChange={(e) => setSoCau(e.target.value)} />
        </div>
        <div>
          <label className="nhan" htmlFor="ai-diem">
            Điểm các câu
          </label>
          <input id="ai-diem" className={`o-nhap ${dsDiem ? '' : 'border-red-400'}`} value={diem} onChange={(e) => setDiem(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Lặp lại theo vòng, VD "3; 3; 4"</p>
        </div>
        <div>
          <label className="nhan" htmlFor="ai-muc-do">
            Mức độ
          </label>
          <select id="ai-muc-do" className="o-nhap" value={mucDo} onChange={(e) => setMucDo(e.target.value as MucDo | 'tron')}>
            <option value="tron">Trộn dễ / trung bình / khó</option>
            {(['de', 'tb', 'kho'] as const).map((m) => (
              <option key={m} value={m}>
                Toàn câu {NHAN_MUC_DO[m].toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="nhan" htmlFor="ai-chu-de">
          Chủ đề / chương (để trống = cả môn)
        </label>
        <input id="ai-chu-de" className="o-nhap" list="ds-chu-de-ai" value={chuDe} onChange={(e) => setChuDe(e.target.value)} />
        <datalist id="ds-chu-de-ai">
          {dsChuDe.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="nhan" htmlFor="ai-yeu-cau">
          Yêu cầu thêm (không bắt buộc)
        </label>
        <textarea
          id="ai-yeu-cau"
          className="o-nhap min-h-16"
          placeholder="VD: có câu so sánh, có câu yêu cầu viết đoạn mã HTML ngắn, tránh hỏi lịch sử ra đời…"
          value={yeuCau}
          onChange={(e) => setYeuCau(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {soan.isPending ? THOI_GIAN_CHO[buoc] : `Dùng ${ai.mo_hinh}. Thường mất 30 giây – 1 phút; câu hỏi chưa được lưu cho đến khi thầy duyệt.`}
        </span>
        <button className="btn-chinh" disabled={!hopLe || soan.isPending}>
          {soan.isPending ? 'AI đang soạn…' : '✨ Soạn câu hỏi'}
        </button>
      </div>
    </form>
  );
}
