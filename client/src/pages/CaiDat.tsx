import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, khoa } from '../api';
import type { CaiDat, MaNhaCungCap, NgayNghi } from '../api/types';
import { BaoLoiTai, DangTai, TieuDeTrang } from '../components/ChungUI';
import { dinhDangDungLuong, dinhDangNgay } from '../lib/format';
import { thongBao } from '../lib/thongBao';

export function TrangCaiDat() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: khoa.caiDat, queryFn: api.caiDat.lay });
  const [form, setForm] = useState<CaiDat | null>(null);
  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const luu = useMutation({
    mutationFn: (f: CaiDat) =>
      api.caiDat.ghi({ ...f, ngay_nghi: f.ngay_nghi.filter((n) => n.tu).map((n) => ({ ...n, den: n.den || null, ten: n.ten || null })) }),
    onSuccess: (d) => {
      qc.setQueryData(khoa.caiDat, d);
      qc.invalidateQueries({ queryKey: khoa.saoLuu });
      setForm(d);
      thongBao('Đã lưu cài đặt');
    },
  });

  if (isLoading || (!form && !error)) return <DangTai />;
  if (error || !form) return <BaoLoiTai loi={error} />;

  const doi = <K extends keyof CaiDat>(k: K, v: CaiDat[K]) => setForm({ ...form, [k]: v });
  const doiNgayNghi = (i: number, n: Partial<NgayNghi>) =>
    doi('ngay_nghi', form.ngay_nghi.map((x, j) => (j === i ? { ...x, ...n } : x)));
  const guiForm = (e: FormEvent) => {
    e.preventDefault();
    luu.mutate(form);
  };

  return (
    <>
      <TieuDeTrang tieuDe="Cài đặt" />
      <form onSubmit={guiForm} className="space-y-4">
        <div className="the">
          <div className="the-dau">
            <h2 className="font-medium">Thông tin giáo viên</h2>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <O nhan="Họ tên" id="ten-gv">
              <input id="ten-gv" className="o-nhap" required value={form.ten_gv} onChange={(e) => doi('ten_gv', e.target.value)} />
            </O>
            <O nhan="Mã giáo viên" id="ma-gv">
              <input id="ma-gv" className="o-nhap" value={form.ma_gv} onChange={(e) => doi('ma_gv', e.target.value)} />
            </O>
            <O nhan="Số điện thoại" id="sdt">
              <input id="sdt" className="o-nhap" value={form.sdt} onChange={(e) => doi('sdt', e.target.value)} />
            </O>
            <O nhan="Giờ vào lớp buổi sáng" id="gio-sang">
              <input id="gio-sang" className="o-nhap" value={form.gio_sang} placeholder="07h30" onChange={(e) => doi('gio_sang', e.target.value)} />
            </O>
            <O nhan="Giờ vào lớp buổi chiều" id="gio-chieu">
              <input id="gio-chieu" className="o-nhap" value={form.gio_chieu} placeholder="13h30" onChange={(e) => doi('gio_chieu', e.target.value)} />
            </O>
            <O nhan="Năm học" id="nam-hoc">
              <input
                id="nam-hoc"
                className="o-nhap"
                value={form.nam_hoc}
                placeholder="2026-2027"
                pattern="\d{4}-\d{4}"
                title="Dạng 2026-2027"
                onChange={(e) => doi('nam_hoc', e.target.value)}
              />
            </O>
          </div>
          <p className="px-4 pb-4 text-xs text-slate-500">
            Dòng cuối khối thông tin trong file Excel: Giáo viên: :{form.ma_gv} {form.ten_gv}: {form.sdt}
          </p>
        </div>

        <div className="the">
          <div className="the-dau">
            <div>
              <h2 className="font-medium">Ngày nghỉ lễ</h2>
              <p className="text-xs text-slate-500">Trình sinh lịch sẽ bỏ qua các ngày này. Nghỉ nhiều ngày (Tết) thì nhập cả "Đến ngày".</p>
            </div>
            <button
              type="button"
              className="btn-phu btn-nho"
              onClick={() => doi('ngay_nghi', [...form.ngay_nghi, { tu: '', den: null, ten: '' }])}
            >
              + Thêm ngày nghỉ
            </button>
          </div>
          {form.ngay_nghi.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có ngày nghỉ nào.</p>
          ) : (
            <table className="bang">
              <thead>
                <tr>
                  <th className="w-44">Từ ngày</th>
                  <th className="w-44">Đến ngày</th>
                  <th>Tên</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {form.ngay_nghi.map((n, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="date"
                        className="o-nhap"
                        aria-label="Từ ngày"
                        required
                        value={n.tu}
                        onChange={(e) => doiNgayNghi(i, { tu: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="o-nhap"
                        aria-label="Đến ngày"
                        min={n.tu || undefined}
                        value={n.den ?? ''}
                        onChange={(e) => doiNgayNghi(i, { den: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        className="o-nhap"
                        aria-label="Tên ngày nghỉ"
                        placeholder="VD: Tết Nguyên đán"
                        value={n.ten ?? ''}
                        onChange={(e) => doiNgayNghi(i, { ten: e.target.value })}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-nguy btn-nho"
                        onClick={() => doi('ngay_nghi', form.ngay_nghi.filter((_, j) => j !== i))}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="the">
          <div className="the-dau">
            <h2 className="font-medium">Sao lưu</h2>
          </div>
          <div className="p-4">
            <O nhan="Thư mục sao lưu" id="thu-muc">
              <input
                id="thu-muc"
                className="o-nhap"
                value={form.thu_muc_sao_luu}
                placeholder="Để trống = thư mục data/backups của phần mềm"
                onChange={(e) => doi('thu_muc_sao_luu', e.target.value)}
              />
            </O>
            <p className="mt-1 text-xs text-slate-500">
              Mỗi lần mở phần mềm sẽ tự sao lưu nếu bản gần nhất đã quá 24 giờ. Giữ lại 30 bản mới nhất. Có thể đặt thư mục
              trong OneDrive / Google Drive để có thêm bản trên mạng.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn-chinh" disabled={luu.isPending}>
            {luu.isPending ? 'Đang lưu…' : 'Lưu cài đặt'}
          </button>
        </div>
      </form>

      <SaoLuu />
      <KhoaAi />
    </>
  );
}

function O({ nhan, id, children }: { nhan: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label className="nhan" htmlFor={id}>
        {nhan}
      </label>
      {children}
    </div>
  );
}

function SaoLuu() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: khoa.saoLuu, queryFn: api.saoLuu.ds });
  const saoLuu = useMutation({
    mutationFn: api.saoLuu.tao,
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: khoa.saoLuu });
      thongBao(`Đã sao lưu: ${b.ten}`);
    },
  });
  return (
    <div className="the mt-4">
      <div className="the-dau">
        <div>
          <h2 className="font-medium">Các bản sao lưu</h2>
          {data && <p className="break-all text-xs text-slate-500">{data.thu_muc}</p>}
        </div>
        <button className="btn-chinh" onClick={() => saoLuu.mutate()} disabled={saoLuu.isPending}>
          {saoLuu.isPending ? 'Đang sao lưu…' : 'Sao lưu ngay'}
        </button>
      </div>
      {!data?.ban.length ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có bản sao lưu nào.</p>
      ) : (
        <table className="bang">
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>Tên file</th>
              <th className="text-right">Dung lượng</th>
            </tr>
          </thead>
          <tbody>
            {data.ban.slice(0, 10).map((b) => (
              <tr key={b.ten}>
                <td className="tabular-nums">
                  {dinhDangNgay(b.luc.slice(0, 10))} {b.luc.slice(11, 16)}
                </td>
                <td className="text-slate-600">{b.ten}</td>
                <td className="text-right tabular-nums text-slate-600">{dinhDangDungLuong(b.kich_thuoc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && data.ban.length > 10 && (
        <p className="px-4 py-2 text-xs text-slate-500">… và {data.ban.length - 10} bản cũ hơn</p>
      )}
    </div>
  );
}

// AI soạn câu hỏi: chọn Gemini (miễn phí) hoặc Claude, mỗi bên một API key (lưu trên máy này, không hiện lại đầy đủ)
const HUONG_DAN_KEY: Record<MaNhaCungCap, { url: string; chu: string }> = {
  gemini: { url: 'https://aistudio.google.com/apikey', chu: 'Lấy key miễn phí tại Google AI Studio (aistudio.google.com/apikey), đăng nhập bằng tài khoản Google.' },
  claude: { url: 'https://console.anthropic.com/settings/keys', chu: 'Tạo key tại console.anthropic.com (trả phí theo lượt dùng).' },
};

function KhoaAi() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: khoa.ai, queryFn: api.ai.lay });
  const [moi, setMoi] = useState<Record<MaNhaCungCap, string>>({ gemini: '', claude: '' });
  const ghi = useMutation({
    mutationFn: (d: { nha_cung_cap: MaNhaCungCap; khoa?: string | null }) => api.ai.ghi(d),
    onSuccess: (d, bien) => {
      qc.setQueryData(khoa.ai, d);
      setMoi({ gemini: '', claude: '' });
      const ten = d.nha_cung_cap.find((n) => n.ma === bien.nha_cung_cap)?.ten;
      thongBao(
        bien.khoa ? `Đã lưu API key ${ten} (đã gọi thử thành công)` : bien.khoa === null ? `Đã xóa API key ${ten}` : `Đã chuyển sang dùng ${ten}`,
      );
    },
  });
  if (!data) return null;
  return (
    <div className="the mt-4" id="ai">
      <div className="the-dau">
        <div>
          <h2 className="font-medium">AI soạn câu hỏi</h2>
          <p className="text-xs text-slate-500">Soạn câu hỏi tự luận kèm đáp án cho ngân hàng đề thi. Cần có Internet.</p>
        </div>
        <span className={`text-sm ${data.co_khoa ? 'text-emerald-700' : 'text-amber-700'}`}>
          Đang dùng: {data.ten}
          {data.co_khoa ? '' : ' (chưa có key)'}
        </span>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {data.nha_cung_cap.map((n) => {
          const dangDung = data.dang_dung === n.ma;
          return (
            <form
              key={n.ma}
              className={`space-y-2 rounded-lg border p-3 ${dangDung ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}
              onSubmit={(e) => {
                e.preventDefault();
                if (moi[n.ma].trim()) ghi.mutate({ nha_cung_cap: n.ma, khoa: moi[n.ma].trim() });
              }}
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="nha-cung-cap"
                  checked={dangDung}
                  disabled={ghi.isPending}
                  onChange={() => ghi.mutate({ nha_cung_cap: n.ma })}
                />
                <span className="font-medium">{n.ten}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${n.mien_phi ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {n.mien_phi ? 'Miễn phí' : 'Trả phí'}
                </span>
              </label>
              <div className="text-xs text-slate-500">
                Mô hình {n.mo_hinh} ·{' '}
                {n.co_khoa ? (
                  <span className="text-emerald-700">
                    đã có key {n.khoa_an}
                    {n.nguon === 'moi_truong' ? ' (biến môi trường)' : ''}
                  </span>
                ) : (
                  'chưa có key'
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  autoComplete="off"
                  aria-label={`API key ${n.ten}`}
                  className="o-nhap font-mono"
                  placeholder={n.co_khoa ? 'Nhập key mới để thay' : 'Dán API key vào đây'}
                  value={moi[n.ma]}
                  onChange={(e) => setMoi({ ...moi, [n.ma]: e.target.value })}
                />
                <button className="btn-chinh" disabled={!moi[n.ma].trim() || ghi.isPending}>
                  {ghi.isPending && ghi.variables?.nha_cung_cap === n.ma && ghi.variables.khoa ? 'Đang kiểm tra…' : 'Lưu'}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                <a className="lien-ket" href={HUONG_DAN_KEY[n.ma].url} target="_blank" rel="noreferrer">
                  {HUONG_DAN_KEY[n.ma].chu}
                </a>
              </p>
              {n.nguon === 'cai_dat' && (
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-red-600"
                  disabled={ghi.isPending}
                  onClick={() => confirm(`Xóa API key ${n.ten}?`) && ghi.mutate({ nha_cung_cap: n.ma, khoa: null })}
                >
                  Xóa key
                </button>
              )}
            </form>
          );
        })}
        <p className="text-xs text-slate-500 md:col-span-2">
          Key chỉ lưu trong file dữ liệu trên máy này (thư mục data/), không đưa lên GitHub. Gói miễn phí của Gemini có giới hạn số lần gọi
          mỗi phút / mỗi ngày; nếu báo hết lượt thì chờ một lát rồi thử lại.
        </p>
      </div>
    </div>
  );
}
