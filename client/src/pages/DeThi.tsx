import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api, khoa } from '../api';
import { BaoLoiTai, DangTai, TieuDeTrang, TrongRong } from '../components/ChungUI';
import { DanhSachMauDe } from '../components/deThi/MauDe';
import { NganHangCauHoi } from '../components/deThi/NganHang';
import { SinhDe } from '../components/deThi/SinhDe';
import { thongBao } from '../lib/thongBao';

const TAB = [
  { id: 'sinh', nhan: 'Sinh đề' },
  { id: 'ngan-hang', nhan: 'Ngân hàng câu hỏi' },
  { id: 'mau', nhan: 'Mẫu đề theo trường' },
  { id: 'da-sinh', nhan: 'Đề đã sinh' },
] as const;
type Tab = (typeof TAB)[number]['id'];

export function TrangDeThi() {
  const [params, setParams] = useSearchParams();
  const tab = (TAB.find((t) => t.id === params.get('tab'))?.id ?? 'sinh') as Tab;
  const monChon = params.get('mon') ? Number(params.get('mon')) : null;
  const doiTab = (t: Tab, them: Record<string, string> = {}) => setParams({ tab: t, ...them });

  return (
    <>
      <TieuDeTrang tieuDe="Đề thi" phu="Sinh đề thi lý thuyết tự luận kèm đáp án theo mẫu Word của từng trường." />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TAB.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => doiTab(t.id)}
          >
            {t.nhan}
          </button>
        ))}
      </div>
      {tab === 'sinh' && (
        <SinhDe onDaSinh={() => doiTab('da-sinh')} onMoNganHang={(id) => doiTab('ngan-hang', { mon: String(id) })} />
      )}
      {tab === 'ngan-hang' && (
        <NganHangCauHoi monChon={monChon} onChonMon={(id) => doiTab('ngan-hang', id ? { mon: String(id) } : {})} />
      )}
      {tab === 'mau' && <DanhSachMauDe />}
      {tab === 'da-sinh' && <DeDaSinh />}
    </>
  );
}

function DeDaSinh() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: khoa.deThi, queryFn: api.deThi.ds });
  const xoa = useMutation({
    mutationFn: (id: number) => api.deThi.xoa(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: khoa.deThi });
      thongBao('Đã xóa khỏi lịch sử');
    },
  });
  if (isLoading) return <DangTai />;
  if (error) return <BaoLoiTai loi={error} />;
  return (
    <section className="the overflow-hidden">
      {!data?.length ? (
        <TrongRong>Chưa sinh đề nào.</TrongRong>
      ) : (
        <table className="bang">
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>File</th>
              <th>Trường</th>
              <th className="text-right">Số đề × câu</th>
              <th>Mẫu</th>
              <th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap tabular-nums">
                  {d.tao_luc.slice(0, 10).split('-').reverse().join('/')} {d.tao_luc.slice(11, 16)}
                </td>
                <td>
                  <div className="font-medium">{d.ten_file}</div>
                  {d.mon_ten && <div className="text-xs text-slate-500">Ngân hàng: {d.mon_ten}</div>}
                </td>
                <td>{d.truong_ma ?? '—'}</td>
                <td className="text-right tabular-nums">
                  {d.so_de} × {d.so_cau}
                </td>
                <td className="text-slate-600">{d.mau_ten ?? <span className="text-slate-400">đã xóa</span>}</td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    <a className="btn-phu btn-nho" href={api.deThi.urlTai(d.id)} download>
                      Tải lại
                    </a>
                    <button className="btn-nguy btn-nho" onClick={() => confirm(`Xóa "${d.ten_file}" khỏi lịch sử?`) && xoa.mutate(d.id)}>
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
