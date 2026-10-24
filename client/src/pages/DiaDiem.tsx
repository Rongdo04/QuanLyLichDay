import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, khoa } from '../api';
import type { DiaDiem } from '../api/types';
import { BaoLoiTai, DangTai, Modal, TieuDeTrang, TrongRong } from '../components/ChungUI';
import { dinhDangTien } from '../lib/format';
import { thongBao } from '../lib/thongBao';

interface FormDiaDiem {
  id?: number;
  ten_ngan: string;
  ten_day_du: string;
  tien_dc: string;
}

export function TrangDiaDiem() {
  const qc = useQueryClient();
  const { data: ds, isLoading, error } = useQuery({ queryKey: khoa.diaDiem, queryFn: api.diaDiem.ds });
  const [form, setForm] = useState<FormDiaDiem | null>(null);

  const luu = useMutation({
    mutationFn: (f: FormDiaDiem) => {
      const d = { ten_ngan: f.ten_ngan.trim(), ten_day_du: f.ten_day_du.trim() || null, tien_dc: Number(f.tien_dc) || 0 };
      return f.id ? api.diaDiem.sua(f.id, d) : api.diaDiem.tao(d);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      thongBao(form?.id ? 'Đã lưu thay đổi' : 'Đã thêm địa điểm');
      setForm(null);
    },
  });
  const xoa = useMutation({
    mutationFn: (d: DiaDiem) => api.diaDiem.xoa(d.id),
    onSuccess: () => {
      qc.invalidateQueries();
      thongBao('Đã xóa địa điểm');
    },
  });

  const guiForm = (e: FormEvent) => {
    e.preventDefault();
    if (form) luu.mutate(form);
  };
  const tienDcNhap = Number(form?.tien_dc) || 0;

  return (
    <>
      <TieuDeTrang
        tieuDe="Địa điểm"
        phu="Nơi dạy quyết định tiền di chuyển (DC). Tiền DC tính theo ngày có dạy, không theo buổi."
      >
        <button className="btn-chinh" onClick={() => setForm({ ten_ngan: '', ten_day_du: '', tien_dc: '0' })}>
          + Thêm địa điểm
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
          <TrongRong>Chưa có địa điểm nào.</TrongRong>
        ) : (
          <table className="bang">
            <thead>
              <tr>
                <th>Tên ngắn</th>
                <th>Tên đầy đủ</th>
                <th className="text-right">Tiền DC / ngày</th>
                <th className="w-20 text-right">Số lớp</th>
                <th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {ds.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.ten_ngan}</td>
                  <td className="text-slate-600">{d.ten_day_du}</td>
                  <td className="text-right tabular-nums">{d.tien_dc > 0 ? dinhDangTien(d.tien_dc) : <span className="text-slate-400">0 đ</span>}</td>
                  <td className="text-right tabular-nums">{d.so_lop}</td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="btn-phu btn-nho"
                        onClick={() =>
                          setForm({ id: d.id, ten_ngan: d.ten_ngan, ten_day_du: d.ten_day_du ?? '', tien_dc: String(d.tien_dc) })
                        }
                      >
                        Sửa
                      </button>
                      <button
                        className="btn-nguy btn-nho"
                        disabled={d.so_lop > 0}
                        title={d.so_lop > 0 ? 'Địa điểm đang có lớp sử dụng' : undefined}
                        onClick={() => confirm(`Xóa địa điểm ${d.ten_ngan}?`) && xoa.mutate(d)}
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

      <Modal mo={!!form} tieuDe={form?.id ? 'Sửa địa điểm' : 'Thêm địa điểm'} onDong={() => setForm(null)}>
        {form && (
          <form onSubmit={guiForm} className="space-y-3">
            <div>
              <label className="nhan" htmlFor="ten-ngan">
                Tên ngắn
              </label>
              <input
                id="ten-ngan"
                className="o-nhap"
                value={form.ten_ngan}
                placeholder="VD: Thạch Thất"
                autoFocus
                required
                onChange={(e) => setForm({ ...form, ten_ngan: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Ghi vào cột "Ghi chú" của file Excel ở những ngày có dạy.</p>
            </div>
            <div>
              <label className="nhan" htmlFor="ten-day-du">
                Tên đầy đủ
              </label>
              <input
                id="ten-day-du"
                className="o-nhap"
                value={form.ten_day_du}
                placeholder="VD: Trung tâm GDNN-GDTX Thạch Thất - Cơ sở 2"
                onChange={(e) => setForm({ ...form, ten_day_du: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Hiện ở dòng "Địa điểm:" trong khối thông tin của file Excel.</p>
            </div>
            <div>
              <label className="nhan" htmlFor="tien-dc">
                Tiền di chuyển mỗi ngày (nghìn đồng)
              </label>
              <input
                id="tien-dc"
                type="number"
                min={0}
                className="o-nhap w-40"
                value={form.tien_dc}
                onChange={(e) => setForm({ ...form, tien_dc: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">= {dinhDangTien(tienDcNhap)} / ngày</p>
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
