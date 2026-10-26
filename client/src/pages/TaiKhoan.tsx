import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, khoa } from '../api';
import type { NguoiDung } from '../api/types';
import { BaoLoiTai, DangTai, Modal, TieuDeTrang } from '../components/ChungUI';
import { useNguoiDung } from '../components/CongDangNhap';
import { dinhDangNgay } from '../lib/format';
import { thongBao } from '../lib/thongBao';

// Quản trị: tạo tài khoản cho bạn bè, đặt lại mật khẩu khi quên, khóa / mở khóa.
// Mỗi tài khoản có dữ liệu riêng hoàn toàn (trường, lớp, lịch, đề thi, cài đặt).

export function TrangTaiKhoan() {
  const toi = useNguoiDung();
  const qc = useQueryClient();
  const { data: ds, isLoading, error } = useQuery({ queryKey: khoa.nguoiDung, queryFn: api.taiKhoan.ds, enabled: !!toi?.la_quan_tri });
  const [moTao, setMoTao] = useState(false);
  const [datLai, setDatLai] = useState<NguoiDung | null>(null);

  const doiKhoa = useMutation({
    mutationFn: (n: NguoiDung) => api.taiKhoan.sua(n.id, { bi_khoa: !n.bi_khoa }),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: khoa.nguoiDung });
      thongBao(n.bi_khoa ? `Đã khóa ${n.ten_dang_nhap}` : `Đã mở khóa ${n.ten_dang_nhap}`);
    },
  });

  if (!toi?.la_quan_tri) return <BaoLoiTai loi={new Error('Chỉ quản trị mới xem được trang này')} />;
  if (isLoading) return <DangTai />;
  if (error || !ds) return <BaoLoiTai loi={error} />;

  return (
    <>
      <TieuDeTrang tieuDe="Tài khoản">
        <button className="btn-chinh" onClick={() => setMoTao(true)}>
          + Thêm tài khoản
        </button>
      </TieuDeTrang>
      <div className="the overflow-hidden">
        <table className="bang">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th className="w-40">Tên đăng nhập</th>
              <th>Email</th>
              <th className="w-28">Vai trò</th>
              <th className="w-28">Tạo ngày</th>
              <th className="w-56" />
            </tr>
          </thead>
          <tbody>
            {ds.map((n) => (
              <tr key={n.id} className={n.bi_khoa ? 'text-slate-400' : ''}>
                <td className="font-medium">
                  {n.ho_ten}
                  {n.id === toi.id && <span className="ml-2 text-xs font-normal text-slate-500">(bạn)</span>}
                  {n.bi_khoa ? <span className="ml-2 text-xs font-normal">(đã khóa)</span> : null}
                </td>
                <td>{n.ten_dang_nhap}</td>
                <td className="text-slate-500">{n.email}</td>
                <td>{n.la_quan_tri ? 'Quản trị' : 'Người dùng'}</td>
                <td className="tabular-nums">{dinhDangNgay(n.tao_luc.slice(0, 10))}</td>
                <td className="text-right">
                  <button className="btn-phu btn-nho" onClick={() => setDatLai(n)}>
                    Đặt lại mật khẩu
                  </button>{' '}
                  {n.id !== toi.id && (
                    <button className="btn-phu btn-nho" onClick={() => doiKhoa.mutate(n)} disabled={doiKhoa.isPending}>
                      {n.bi_khoa ? 'Mở khóa' : 'Khóa'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Mỗi tài khoản có dữ liệu riêng: trường, lớp, lịch dạy, đề thi, cài đặt và bản sao lưu. Tài khoản mới bắt đầu với danh sách
        trường, địa điểm mẫu và tự sửa lại cho mình.
      </p>

      <TaoTaiKhoan mo={moTao} onDong={() => setMoTao(false)} />
      <DatLaiMatKhau n={datLai} onDong={() => setDatLai(null)} />
    </>
  );
}

function TaoTaiKhoan({ mo, onDong }: { mo: boolean; onDong: () => void }) {
  const qc = useQueryClient();
  const rong = { ho_ten: '', ten_dang_nhap: '', email: '', mat_khau: '', la_quan_tri: false };
  const [f, setF] = useState(rong);
  const tao = useMutation({
    mutationFn: () => api.taiKhoan.tao(f),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: khoa.nguoiDung });
      thongBao(`Đã tạo tài khoản ${n.ten_dang_nhap}. Gửi tên đăng nhập và mật khẩu cho ${n.ho_ten}.`);
      setF(rong);
      onDong();
    },
  });
  const gui = (e: FormEvent) => {
    e.preventDefault();
    tao.mutate();
  };
  return (
    <Modal mo={mo} tieuDe="Thêm tài khoản" onDong={onDong}>
      <form onSubmit={gui} className="space-y-3">
        <div>
          <label className="nhan" htmlFor="tk-ho-ten">
            Họ tên
          </label>
          <input id="tk-ho-ten" className="o-nhap" required autoFocus value={f.ho_ten} onChange={(e) => setF({ ...f, ho_ten: e.target.value })} />
        </div>
        <div>
          <label className="nhan" htmlFor="tk-ten">
            Tên đăng nhập
          </label>
          <input
            id="tk-ten"
            className="o-nhap"
            required
            autoComplete="off"
            placeholder="Chữ không dấu, số, . _ - (VD: lan.nguyen)"
            value={f.ten_dang_nhap}
            onChange={(e) => setF({ ...f, ten_dang_nhap: e.target.value })}
          />
        </div>
        <div>
          <label className="nhan" htmlFor="tk-email">
            Email (không bắt buộc)
          </label>
          <input
            id="tk-email"
            type="email"
            className="o-nhap"
            autoComplete="off"
            placeholder="Để lấy lại mật khẩu; cũng dùng để đăng nhập"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </div>
        <div>
          <label className="nhan" htmlFor="tk-mk">
            Mật khẩu ban đầu
          </label>
          <input
            id="tk-mk"
            className="o-nhap"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Ít nhất 6 ký tự; người dùng tự đổi sau trong Cài đặt"
            value={f.mat_khau}
            onChange={(e) => setF({ ...f, mat_khau: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.la_quan_tri} onChange={(e) => setF({ ...f, la_quan_tri: e.target.checked })} />
          Quyền quản trị (tạo / khóa tài khoản khác)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-phu" onClick={onDong}>
            Hủy
          </button>
          <button className="btn-chinh" disabled={tao.isPending}>
            {tao.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DatLaiMatKhau({ n, onDong }: { n: NguoiDung | null; onDong: () => void }) {
  const [matKhau, setMatKhau] = useState('');
  const dat = useMutation({
    mutationFn: () => api.taiKhoan.sua(n!.id, { mat_khau: matKhau }),
    onSuccess: () => {
      thongBao(`Đã đặt lại mật khẩu cho ${n!.ten_dang_nhap}`);
      setMatKhau('');
      onDong();
    },
  });
  const gui = (e: FormEvent) => {
    e.preventDefault();
    dat.mutate();
  };
  return (
    <Modal mo={!!n} tieuDe={`Đặt lại mật khẩu: ${n?.ho_ten ?? ''}`} onDong={onDong}>
      <form onSubmit={gui} className="space-y-3">
        <div>
          <label className="nhan" htmlFor="dl-mk">
            Mật khẩu mới
          </label>
          <input
            id="dl-mk"
            className="o-nhap"
            required
            minLength={6}
            autoFocus
            autoComplete="new-password"
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Người đó sẽ bị đăng xuất khỏi mọi nơi và phải đăng nhập lại bằng mật khẩu mới.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-phu" onClick={onDong}>
            Hủy
          </button>
          <button className="btn-chinh" disabled={dat.isPending}>
            {dat.isPending ? 'Đang lưu…' : 'Đặt lại'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
