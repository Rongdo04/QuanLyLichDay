import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, khoa } from '../../api';
import type { MauDe } from '../../api/types';
import { useDsTruong } from '../../lib/hooks';
import { thongBao } from '../../lib/thongBao';
import { BaoLoiTai, DangTai, Modal } from '../ChungUI';
import { dinhDangDiem, docDanhSachDiem } from './chung';

export function DanhSachMauDe() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: khoa.mauDe, queryFn: api.mauDe.ds });
  const [form, setForm] = useState<MauDe | 'moi' | null>(null);
  const oThayTep = useRef<HTMLInputElement>(null);
  const [dangThay, setDangThay] = useState<MauDe | null>(null);

  const xoa = useMutation({
    mutationFn: (id: number) => api.mauDe.xoa(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: khoa.mauDe });
      thongBao('Đã xóa mẫu');
    },
  });
  const thayTep = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => api.mauDe.thayTep(id, file),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: khoa.mauDe });
      thongBao(`Đã thay file của "${m.ten}"`);
      m.canh_bao.forEach((c) => thongBao(c, 'thong-tin'));
    },
  });

  if (isLoading) return <DangTai />;
  if (error || !data) return <BaoLoiTai loi={error} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <section className="the overflow-hidden">
        <div className="the-dau">
          <div>
            <h2 className="font-medium">Mẫu đề theo trường</h2>
            <p className="text-xs text-slate-500">Trường chưa có mẫu riêng sẽ dùng "Mẫu chung".</p>
          </div>
          <button className="btn-chinh" onClick={() => setForm('moi')}>
            + Tải mẫu lên
          </button>
        </div>
        <table className="bang">
          <thead>
            <tr>
              <th>Mẫu</th>
              <th>Trường</th>
              <th>Điểm các câu</th>
              <th className="text-right">Thời gian</th>
              <th className="w-64" />
            </tr>
          </thead>
          <tbody>
            {data.mau.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="font-medium">{m.ten}</div>
                  <div className="text-xs text-slate-500">{m.co_san ? 'Có sẵn trong phần mềm' : `Tải lên ${m.tao_luc.slice(0, 10).split('-').reverse().join('/')}`}</div>
                </td>
                <td>{m.truong_ma ?? <span className="text-slate-400">Mọi trường</span>}</td>
                <td className="tabular-nums">{m.cau_truc.map(dinhDangDiem).join(' · ')}</td>
                <td className="text-right tabular-nums">{m.thoi_gian} phút</td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    <a className="btn-phu btn-nho" href={api.mauDe.urlTai(m.id)} download>
                      Tải về
                    </a>
                    <button className="btn-phu btn-nho" onClick={() => setForm(m)}>
                      Sửa
                    </button>
                    {!m.co_san && (
                      <>
                        <button
                          className="btn-phu btn-nho"
                          disabled={thayTep.isPending}
                          onClick={() => {
                            setDangThay(m);
                            oThayTep.current?.click();
                          }}
                        >
                          Thay file
                        </button>
                        <button className="btn-nguy btn-nho" onClick={() => confirm(`Xóa mẫu "${m.ten}"?`) && xoa.mutate(m.id)}>
                          Xóa
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <input
          ref={oThayTep}
          type="file"
          accept=".docx,.doc"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && dangThay) thayTep.mutate({ id: dangThay.id, file: f });
            e.target.value = '';
          }}
        />
      </section>

      <HuongDan oDien={data.o_dien} mauChungId={data.mau.find((m) => !m.truong_id && m.co_san)?.id} />

      <Modal mo={!!form} tieuDe={form === 'moi' ? 'Tải mẫu đề lên' : 'Sửa mẫu đề'} onDong={() => setForm(null)}>
        {form && <FormMauDe mau={form === 'moi' ? undefined : form} onXong={() => setForm(null)} />}
      </Modal>
    </div>
  );
}

function FormMauDe({ mau, onXong }: { mau?: MauDe; onXong: () => void }) {
  const qc = useQueryClient();
  const { data: dsTruong } = useDsTruong();
  const [file, setFile] = useState<File | null>(null);
  const [ten, setTen] = useState(mau?.ten ?? '');
  const [truongId, setTruongId] = useState(mau?.truong_id ? String(mau.truong_id) : '');
  const [diem, setDiem] = useState((mau?.cau_truc ?? [3, 3, 4]).map(dinhDangDiem).join('; '));
  const [thoiGian, setThoiGian] = useState(String(mau?.thoi_gian ?? 60));
  const dsDiem = docDanhSachDiem(diem);

  const luu = useMutation({
    mutationFn: () => {
      const d = { ten: ten.trim(), truong_id: truongId ? Number(truongId) : null, cau_truc: dsDiem!, thoi_gian: Number(thoiGian) };
      return mau ? api.mauDe.sua(mau.id, d) : api.mauDe.tao(file!, d);
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: khoa.mauDe });
      thongBao(mau ? 'Đã lưu mẫu' : `Đã tải lên mẫu "${m.ten}"`);
      if ('canh_bao' in m) (m.canh_bao as string[]).forEach((c) => thongBao(c, 'thong-tin'));
      onXong();
    },
  });
  const gui = (e: FormEvent) => {
    e.preventDefault();
    if (dsDiem && (mau || file)) luu.mutate();
  };
  return (
    <form onSubmit={gui} className="space-y-3">
      {!mau && (
        <div>
          <label className="nhan" htmlFor="md-file">
            File Word (.docx hoặc .doc)
          </label>
          <input
            id="md-file"
            type="file"
            accept=".docx,.doc"
            required
            className="block w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !ten) setTen(f.name.replace(/\.(docx?|DOCX?)$/, ''));
            }}
          />
          <p className="mt-1 text-xs text-slate-500">File phải có các ô điền {'{…}'} như hướng dẫn bên cạnh.</p>
        </div>
      )}
      <div>
        <label className="nhan" htmlFor="md-ten">
          Tên mẫu
        </label>
        <input id="md-ten" className="o-nhap" required value={ten} onChange={(e) => setTen(e.target.value)} />
      </div>
      <div>
        <label className="nhan" htmlFor="md-truong">
          Dùng cho trường
        </label>
        <select id="md-truong" className="o-nhap" value={truongId} onChange={(e) => setTruongId(e.target.value)}>
          <option value="">Mọi trường (mẫu chung)</option>
          {dsTruong?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ma} — {t.ten}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="nhan" htmlFor="md-diem">
            Điểm các câu mặc định
          </label>
          <input id="md-diem" className={`o-nhap ${dsDiem ? '' : 'border-red-400'}`} value={diem} onChange={(e) => setDiem(e.target.value)} />
        </div>
        <div>
          <label className="nhan" htmlFor="md-tg">
            Thời gian (phút)
          </label>
          <input id="md-tg" type="number" min={5} max={600} className="o-nhap" value={thoiGian} onChange={(e) => setThoiGian(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-phu" onClick={onXong}>
          Hủy
        </button>
        <button className="btn-chinh" disabled={luu.isPending || !dsDiem || (!mau && !file)}>
          {luu.isPending ? 'Đang lưu…' : mau ? 'Lưu' : 'Tải lên'}
        </button>
      </div>
    </form>
  );
}

function HuongDan({ oDien, mauChungId }: { oDien: { o: string; mo_ta: string }[]; mauChungId?: number }) {
  return (
    <aside className="the h-fit">
      <div className="the-dau">
        <h2 className="font-medium">Cách làm mẫu cho trường mới</h2>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <ol className="list-inside list-decimal space-y-1.5 text-slate-700">
          <li>
            {mauChungId ? (
              <a className="lien-ket" href={api.mauDe.urlTai(mauChungId)} download>
                Tải "Mẫu chung" về
              </a>
            ) : (
              'Tải "Mẫu chung" về'
            )}{' '}
            làm điểm bắt đầu, hoặc mở mẫu Word của trường.
          </li>
          <li>Sửa phần đầu trang, chữ ký… cho đúng mẫu của trường.</li>
          <li>
            Gõ các ô điền <b>{'{…}'}</b> vào chỗ cần điền (giữ đúng dấu ngoặc nhọn, chữ thường, không dấu).
          </li>
          <li>Lưu file rồi bấm "Tải mẫu lên", chọn trường dùng mẫu.</li>
        </ol>
        <div className="rounded-md bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700">
          {'{#de}'}
          <br />
          ĐỀ THI SỐ {'{so_de}'} — Học phần: {'{hoc_phan}'}
          <br />
          {'{#cau}'}Câu {'{so}'} ({'{diem}'} điểm): {'{noi_dung}'}
          {'{/cau}'}
          <br />
          {'{/de}'}
          <br />
          <br />
          {'{#de}'}ĐÁP ÁN ĐỀ {'{so_de}'}
          <br />
          {'{#cau}'}Câu {'{so}'}: {'{dap_an}'}
          {'{/cau}'}
          {'{/de}'}
        </div>
        <p className="text-xs text-slate-500">
          Mỗi đề nên bắt đầu trang mới: trong Word đặt con trỏ ở dòng đầu của phần lặp → Paragraph → Line and Page Breaks → "Page break
          before".
        </p>
        <details>
          <summary className="cursor-pointer font-medium text-slate-700">Tất cả ô điền ({oDien.length})</summary>
          <table className="mt-2 w-full text-xs">
            <tbody>
              {oDien.map((o) => (
                <tr key={o.o} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap py-1 pr-2 font-mono text-blue-800">{o.o}</td>
                  <td className="py-1 text-slate-600">{o.mo_ta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </aside>
  );
}
