import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, khoa } from '../api';
import type { NguoiDung, TrangThaiDangNhap } from '../api/types';
import { thongBao, xoaHetThongBao } from '../lib/thongBao';
import { BaoLoiTai, DangTai } from './ChungUI';
import { Toasts } from './Toasts';

// Chặn toàn bộ app cho đến khi đăng nhập. Chưa có tài khoản nào thì hiện màn tạo quản trị.

export function useNguoiDung(): NguoiDung | null {
  const { data } = useQuery({ queryKey: khoa.toi, queryFn: api.taiKhoan.toi });
  return data?.nguoi_dung ?? null;
}

// Đổi người dùng (đăng nhập / đăng xuất): cập nhật trạng thái đăng nhập ngay trên query đang được
// theo dõi (không dùng qc.clear(): màn chặn vẫn bám vào query cũ, và nó xóa cả bộ đệm mutation),
// rồi bỏ hết dữ liệu đã tải của người trước
export function useVaoTaiKhoan() {
  const qc = useQueryClient();
  return (nguoi_dung: NguoiDung | null) => {
    const laTrangThai = (k: readonly unknown[]) => k[0] === khoa.toi[0] && k[1] === khoa.toi[1];
    qc.cancelQueries({ predicate: (q) => !laTrangThai(q.queryKey) });
    qc.setQueryData<TrangThaiDangNhap>(khoa.toi, { nguoi_dung, can_khoi_tao: false });
    qc.removeQueries({ predicate: (q) => !laTrangThai(q.queryKey) });
    // Không xóa bộ đệm mutation ở đây: hàm này chạy ngay trong onSuccess của mutation đăng nhập /
    // đăng xuất, xóa lúc đó làm React Query kẹt và các mutation sau (VD bấm Đăng xuất) không chạy nữa
  };
}

// Đăng nhập / tạo tài khoản xong: báo thành công rồi vào trang hồ sơ
function useSauKhiVao() {
  const vao = useVaoTaiKhoan();
  const navigate = useNavigate();
  return (nguoi_dung: NguoiDung, loiChao: string) => {
    vao(nguoi_dung);
    navigate('/ho-so', { replace: true });
    xoaHetThongBao(); // bỏ các lỗi "sai mật khẩu" của những lần thử trước
    thongBao(loiChao);
  };
}

export function CongDangNhap({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: khoa.toi, queryFn: api.taiKhoan.toi, staleTime: 60_000 });

  useEffect(() => {
    const hetPhien = () => qc.invalidateQueries({ queryKey: khoa.toi });
    window.addEventListener('het-phien', hetPhien);
    return () => window.removeEventListener('het-phien', hetPhien);
  }, [qc]);

  if (isLoading) return <DangTai />;
  if (error || !data) return <div className="p-6"><BaoLoiTai loi={error} /></div>;
  if (data.nguoi_dung) return <>{children}</>;
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 px-4 pt-[12vh]">
      <div className="the w-full max-w-sm">
        {data.can_khoi_tao ? <KhoiTao /> : <DangNhap />}
      </div>
      {/* Thông báo lỗi (sai mật khẩu…) — Layout chưa hiện nên phải đặt ở đây */}
      <Toasts />
    </div>
  );
}

function DangNhap() {
  const sauKhiVao = useSauKhiVao();
  const [ten, setTen] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const dn = useMutation({
    mutationFn: () => api.taiKhoan.dangNhap({ ten_dang_nhap: ten, mat_khau: matKhau }),
    onSuccess: (r) => sauKhiVao(r.nguoi_dung, `Đăng nhập thành công. Chào ${r.nguoi_dung.ho_ten}!`),
  });
  const gui = (e: FormEvent) => {
    e.preventDefault();
    dn.mutate();
  };
  return (
    <form onSubmit={gui} className="space-y-3 p-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Quản lý giảng dạy</h1>
        <p className="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
      </div>
      <div>
        <label className="nhan" htmlFor="dn-ten">
          Tên đăng nhập hoặc email
        </label>
        <input id="dn-ten" className="o-nhap" autoComplete="username" autoFocus required value={ten} onChange={(e) => setTen(e.target.value)} />
      </div>
      <div>
        <label className="nhan" htmlFor="dn-mk">
          Mật khẩu
        </label>
        <input
          id="dn-mk"
          type="password"
          className="o-nhap"
          autoComplete="current-password"
          required
          value={matKhau}
          onChange={(e) => setMatKhau(e.target.value)}
        />
      </div>
      <button className="btn-chinh w-full justify-center" disabled={dn.isPending}>
        {dn.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
      <p className="text-xs text-slate-500">Quên mật khẩu? Nhờ quản trị đặt lại.</p>
    </form>
  );
}

function KhoiTao() {
  const sauKhiVao = useSauKhiVao();
  const [f, setF] = useState({ ho_ten: '', ten_dang_nhap: '', email: '', mat_khau: '', nhap_lai: '' });
  const [loi, setLoi] = useState('');
  const kt = useMutation({
    mutationFn: () => api.taiKhoan.khoiTao({ ho_ten: f.ho_ten, ten_dang_nhap: f.ten_dang_nhap, email: f.email, mat_khau: f.mat_khau }),
    onSuccess: (r) => sauKhiVao(r.nguoi_dung, `Đã tạo tài khoản. Chào ${r.nguoi_dung.ho_ten}!`),
  });
  const gui = (e: FormEvent) => {
    e.preventDefault();
    if (f.mat_khau !== f.nhap_lai) return setLoi('Hai lần nhập mật khẩu không giống nhau');
    setLoi('');
    kt.mutate();
  };
  const o = (k: keyof typeof f, nhan: string, them: Partial<JSX.IntrinsicElements['input']> = {}) => (
    <div>
      <label className="nhan" htmlFor={`kt-${k}`}>
        {nhan}
      </label>
      <input id={`kt-${k}`} className="o-nhap" required={k !== 'email'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...them} />
    </div>
  );
  return (
    <form onSubmit={gui} className="space-y-3 p-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Tạo tài khoản</h1>
        <p className="text-sm text-slate-500">
          Tài khoản đầu tiên là quản trị: nhận toàn bộ dữ liệu đang có và tạo được tài khoản cho người khác.
        </p>
      </div>
      {o('ho_ten', 'Họ tên', { autoFocus: true })}
      {o('ten_dang_nhap', 'Tên đăng nhập', { autoComplete: 'username', placeholder: 'VD: hien' })}
      {o('email', 'Email (để lấy lại mật khẩu)', { type: 'email', autoComplete: 'email' })}
      {o('mat_khau', 'Mật khẩu (ít nhất 6 ký tự)', { type: 'password', autoComplete: 'new-password', minLength: 6 })}
      {o('nhap_lai', 'Nhập lại mật khẩu', { type: 'password', autoComplete: 'new-password' })}
      {loi && <p className="text-sm text-red-600">{loi}</p>}
      <button className="btn-chinh w-full justify-center" disabled={kt.isPending}>
        {kt.isPending ? 'Đang tạo…' : 'Tạo tài khoản và vào'}
      </button>
    </form>
  );
}
