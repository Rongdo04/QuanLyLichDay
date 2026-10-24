import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, khoa } from '../api';
import type { Truong } from '../api/types';
import { BaoLoiTai, DangTai, Modal, TieuDeTrang, TrongRong } from '../components/ChungUI';
import { thongBao } from '../lib/thongBao';

interface FormTruong {
  id?: number;
  ma: string;
  ten: string;
  ghi_chu: string;
}

export function TrangTruong() {
  const qc = useQueryClient();
  const { data: ds, isLoading, error } = useQuery({ queryKey: khoa.truong, queryFn: api.truong.ds });
  const [form, setForm] = useState<FormTruong | null>(null);

  const luu = useMutation({
    mutationFn: (f: FormTruong) => {
      const d = { ma: f.ma.trim().toUpperCase(), ten: f.ten.trim(), ghi_chu: f.ghi_chu.trim() || null };
      return f.id ? api.truong.sua(f.id, d) : api.truong.tao(d);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      thongBao(form?.id ? 'Đã lưu thay đổi' : 'Đã thêm trường');
      setForm(null);
    },
  });
  const anHien = useMutation({
    mutationFn: (t: Truong) => api.truong.sua(t.id, { da_an: t.da_an ? 0 : 1 }),
    onSuccess: (t) => {
      qc.invalidateQueries();
      thongBao(t.da_an ? `Đã ẩn ${t.ma}` : `Đã hiện lại ${t.ma}`);
    },
  });
  const xoa = useMutation({
    mutationFn: (t: Truong) => api.truong.xoa(t.id),
    onSuccess: () => {
      qc.invalidateQueries();
      thongBao('Đã xóa trường');
    },
  });

  const guiForm = (e: FormEvent) => {
    e.preventDefault();
    if (form) luu.mutate(form);
  };

  return (
    <>
      <TieuDeTrang tieuDe="Trường" phu="Các trường đang dạy thỉnh giảng. Trường không còn dạy thì ẩn đi thay vì xóa.">
        <button className="btn-chinh" onClick={() => setForm({ ma: '', ten: '', ghi_chu: '' })}>
          + Thêm trường
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
          <TrongRong>Chưa có trường nào.</TrongRong>
        ) : (
          <table className="bang">
            <thead>
              <tr>
                <th className="w-28">Mã</th>
                <th>Tên trường</th>
                <th>Ghi chú</th>
                <th className="w-20 text-right">Số lớp</th>
                <th className="w-64" />
              </tr>
            </thead>
            <tbody>
              {ds.map((t) => (
                <tr key={t.id} className={t.da_an ? 'text-slate-400' : ''}>
                  <td className="font-medium">{t.ma}</td>
                  <td>
                    {t.ten}
                    {t.da_an ? <span className="ml-2 text-xs">(đã ẩn)</span> : null}
                  </td>
                  <td className="text-slate-500">{t.ghi_chu}</td>
                  <td className="text-right tabular-nums">
                    {t.so_lop > 0 ? (
                      <Link className="lien-ket" to={`/lop?truong=${t.id}`}>
                        {t.so_lop}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="btn-phu btn-nho"
                        onClick={() => setForm({ id: t.id, ma: t.ma, ten: t.ten, ghi_chu: t.ghi_chu ?? '' })}
                      >
                        Sửa
                      </button>
                      <button className="btn-phu btn-nho" onClick={() => anHien.mutate(t)}>
                        {t.da_an ? 'Hiện lại' : 'Ẩn'}
                      </button>
                      <button
                        className="btn-nguy btn-nho"
                        disabled={t.so_lop > 0}
                        title={t.so_lop > 0 ? 'Trường còn lớp, hãy ẩn thay vì xóa' : undefined}
                        onClick={() => confirm(`Xóa trường ${t.ma}?`) && xoa.mutate(t)}
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

      <Modal mo={!!form} tieuDe={form?.id ? 'Sửa trường' : 'Thêm trường'} onDong={() => setForm(null)}>
        {form && (
          <form onSubmit={guiForm} className="space-y-3">
            <div>
              <label className="nhan" htmlFor="ma-truong">
                Mã trường
              </label>
              <input
                id="ma-truong"
                className="o-nhap uppercase"
                value={form.ma}
                maxLength={20}
                placeholder="VD: GTCT"
                autoFocus
                required
                onChange={(e) => setForm({ ...form, ma: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Dùng trong tên file xuất: THỐNG KÊ GIẢNG DẠY TRƯỜNG {form.ma.toUpperCase() || '…'}_…</p>
            </div>
            <div>
              <label className="nhan" htmlFor="ten-truong">
                Tên đầy đủ
              </label>
              <input
                id="ten-truong"
                className="o-nhap"
                value={form.ten}
                placeholder="VD: Trường Trung cấp Giao thông Công chính"
                required
                onChange={(e) => setForm({ ...form, ten: e.target.value })}
              />
            </div>
            <div>
              <label className="nhan" htmlFor="ghi-chu-truong">
                Ghi chú
              </label>
              <input
                id="ghi-chu-truong"
                className="o-nhap"
                value={form.ghi_chu}
                onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
              />
            </div>
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
    </>
  );
}
