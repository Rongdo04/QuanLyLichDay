import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { KyHoc } from '../api/types';
import { BaoLoiTai, DangTai, Modal, TieuDeTrang, TrongRong } from '../components/ChungUI';
import { cacKyGoiY, dinhDangNgay, tenKyHoc } from '../lib/format';
import { useDsKyHoc, useDsLop } from '../lib/hooks';
import { thongBao } from '../lib/thongBao';

// Tên kỳ không nhập: tự sinh theo ngày bắt đầu (HK1_2026-2027)
interface FormKyHoc {
  id?: number;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
}

export function TrangKyHoc() {
  const qc = useQueryClient();
  const { data: ds, isLoading, error } = useDsKyHoc();
  const [form, setForm] = useState<FormKyHoc | null>(null);
  const [themLopCho, setThemLopCho] = useState<KyHoc | null>(null);

  const luu = useMutation({
    mutationFn: (f: FormKyHoc) => {
      const d = { ngay_bat_dau: f.ngay_bat_dau, ngay_ket_thuc: f.ngay_ket_thuc || null };
      return f.id ? api.kyHoc.sua(f.id, d) : api.kyHoc.tao(d);
    },
    onSuccess: (k) => {
      qc.invalidateQueries();
      thongBao(form?.id ? `Đã lưu ${k.ten}` : `Đã thêm kỳ ${k.ten}`);
      setForm(null);
    },
  });
  const xoa = useMutation({
    mutationFn: (k: KyHoc) => api.kyHoc.xoa(k.id),
    onSuccess: () => {
      qc.invalidateQueries();
      thongBao('Đã xóa kỳ học');
    },
  });

  const guiForm = (e: FormEvent) => {
    e.preventDefault();
    if (form) luu.mutate(form);
  };

  return (
    <>
      <TieuDeTrang
        tieuDe="Kỳ học"
        phu="Nhóm các lớp theo kỳ. Tên kỳ tự đặt theo ngày bắt đầu (tháng 8–1 là HK1, tháng 2–7 là HK2). Lớp mới có ngày bắt đầu trong kỳ sẽ tự được xếp vào kỳ đó."
      >
        <button className="btn-chinh" onClick={() => setForm({ ngay_bat_dau: '', ngay_ket_thuc: '' })}>
          + Thêm kỳ học
        </button>
      </TieuDeTrang>

      <div className="the overflow-hidden">
        {isLoading ? (
          <DangTai />
        ) : error ? (
          <div className="p-4">
            <BaoLoiTai loi={error} />
          </div>
        ) : !ds?.length ? (
          <TrongRong>Chưa có kỳ học nào.</TrongRong>
        ) : (
          <table className="bang">
            <thead>
              <tr>
                <th>Tên kỳ</th>
                <th className="w-32">Từ ngày</th>
                <th className="w-32">Đến ngày</th>
                <th className="w-20 text-right">Số lớp</th>
                <th className="w-64" />
              </tr>
            </thead>
            <tbody>
              {ds.map((k) => (
                <tr key={k.id}>
                  <td>
                    <Link to={`/lop?ky=${k.id}`} className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                      {k.ten}
                    </Link>
                  </td>
                  <td className="tabular-nums">{dinhDangNgay(k.ngay_bat_dau)}</td>
                  <td className="tabular-nums">{dinhDangNgay(k.ngay_ket_thuc)}</td>
                  <td className="text-right tabular-nums">{k.so_lop}</td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-chinh btn-nho" onClick={() => setThemLopCho(k)}>
                        + Thêm lớp
                      </button>
                      <button
                        className="btn-phu btn-nho"
                        onClick={() => setForm({ id: k.id, ngay_bat_dau: k.ngay_bat_dau ?? '', ngay_ket_thuc: k.ngay_ket_thuc ?? '' })}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn-nguy btn-nho"
                        onClick={() =>
                          confirm(
                            k.so_lop
                              ? `Xóa kỳ ${k.ten}? ${k.so_lop} lớp của kỳ này vẫn giữ nguyên, chỉ chuyển về "Chưa xếp kỳ".`
                              : `Xóa kỳ ${k.ten}?`,
                          ) && xoa.mutate(k)
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal mo={!!form} tieuDe={form?.id ? 'Sửa kỳ học' : 'Thêm kỳ học'} onDong={() => setForm(null)}>
        {form && (
          <form onSubmit={guiForm} className="space-y-3">
            {!form.id && (
              <div>
                <div className="nhan">Điền nhanh</div>
                <div className="flex flex-wrap gap-1.5">
                  {cacKyGoiY().map((g) => (
                    <button
                      key={g.ngay_bat_dau}
                      type="button"
                      className={`btn-phu btn-nho ${form.ngay_bat_dau === g.ngay_bat_dau ? 'ring-2 ring-blue-300' : ''}`}
                      onClick={() => setForm({ ...form, ...g })}
                    >
                      {tenKyHoc(g.ngay_bat_dau)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="nhan" htmlFor="ky-bd">
                  Từ ngày
                </label>
                <input
                  id="ky-bd"
                  type="date"
                  className="o-nhap w-44"
                  required
                  value={form.ngay_bat_dau}
                  onChange={(e) => setForm({ ...form, ngay_bat_dau: e.target.value })}
                />
              </div>
              <div>
                <label className="nhan" htmlFor="ky-kt">
                  Đến ngày
                </label>
                <input
                  id="ky-kt"
                  type="date"
                  className="o-nhap w-44"
                  value={form.ngay_ket_thuc}
                  min={form.ngay_bat_dau || undefined}
                  onChange={(e) => setForm({ ...form, ngay_ket_thuc: e.target.value })}
                />
              </div>
            </div>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              Tên kỳ:{' '}
              {form.ngay_bat_dau ? (
                <span className="font-semibold text-slate-900">{tenKyHoc(form.ngay_bat_dau)}</span>
              ) : (
                <span className="text-slate-400">chọn ngày bắt đầu</span>
              )}
              <span className="block text-xs text-slate-500">Tự đặt theo ngày bắt đầu. Ngày kết thúc không bắt buộc.</span>
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-phu" onClick={() => setForm(null)}>
                Hủy
              </button>
              <button className="btn-chinh" disabled={luu.isPending}>
                {luu.isPending ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ThemLopVaoKy ky={themLopCho} onDong={() => setThemLopCho(null)} />
    </>
  );
}

// Chọn các lớp đã tạo để đưa vào kỳ: lớp chưa có kỳ ở trên, lớp đang ở kỳ khác (sẽ chuyển sang) ở dưới
function ThemLopVaoKy({ ky, onDong }: { ky: KyHoc | null; onDong: () => void }) {
  const qc = useQueryClient();
  const { data: dsLop, isLoading } = useDsLop();
  const [chon, setChon] = useState<Set<number>>(new Set());
  const ngoaiKy = (dsLop ?? []).filter((l) => ky && l.ky_hoc_id !== ky.id);
  const chuaCoKy = ngoaiKy.filter((l) => l.ky_hoc_id == null);
  const kyKhac = ngoaiKy.filter((l) => l.ky_hoc_id != null);

  const dong = () => {
    setChon(new Set());
    onDong();
  };
  const them = useMutation({
    mutationFn: () => api.kyHoc.themLop(ky!.id, [...chon]),
    onSuccess: (r) => {
      qc.invalidateQueries();
      thongBao(`Đã thêm ${r.so_lop} lớp vào ${ky!.ten}`);
      dong();
    },
  });
  const bat = (id: number) => {
    const moi = new Set(chon);
    if (moi.has(id)) moi.delete(id);
    else moi.add(id);
    setChon(moi);
  };
  const nhom = (tieuDe: string, ds: typeof ngoaiKy) =>
    ds.length > 0 && (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="nhan mb-0">
            {tieuDe} ({ds.length})
          </div>
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline"
            onClick={() => setChon(new Set([...chon, ...ds.map((l) => l.id)]))}
          >
            Chọn tất cả
          </button>
        </div>
        <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {ds.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={chon.has(l.id)} onChange={() => bat(l.id)} />
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{l.ten_sheet}</span>
                <span className="ml-1 text-slate-500">· {l.truong_ma}</span>
                <span className="block truncate text-xs text-slate-500">
                  {l.hoc_phan}
                  {l.ngay_bat_dau && ` · bắt đầu ${dinhDangNgay(l.ngay_bat_dau)}`}
                  {l.ky_hoc_ten && ` · đang ở ${l.ky_hoc_ten}`}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    );

  return (
    <Modal mo={!!ky} tieuDe={ky ? `Thêm lớp vào ${ky.ten}` : ''} onDong={dong}>
      {isLoading ? (
        <DangTai />
      ) : !ngoaiKy.length ? (
        <p className="text-sm text-slate-500">Mọi lớp đã nằm trong kỳ này.</p>
      ) : (
        <div className="space-y-4">
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {nhom('Lớp chưa có kỳ học', chuaCoKy)}
            {nhom('Lớp đang ở kỳ khác (sẽ chuyển sang kỳ này)', kyKhac)}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn-phu" onClick={dong}>
              Hủy
            </button>
            <button className="btn-chinh" disabled={!chon.size || them.isPending} onClick={() => them.mutate()}>
              {them.isPending ? 'Đang thêm…' : `Thêm ${chon.size || ''} lớp`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
