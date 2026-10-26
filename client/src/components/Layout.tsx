import { useMutation, useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, khoa } from '../api';
import { thongBao } from '../lib/thongBao';
import { useNguoiDung, useVaoTaiKhoan } from './CongDangNhap';
import { Toasts } from './Toasts';

const MENU = [
  { to: '/', nhan: 'Tổng quan', end: true },
  { to: '/cham-buoi', nhan: 'Chấm buổi' },
  { to: '/lop', nhan: 'Lớp học' },
  { to: '/truong', nhan: 'Trường' },
  { to: '/dia-diem', nhan: 'Địa điểm' },
  { to: '/excel', nhan: 'Xuất / Nhập Excel' },
  { to: '/de-thi', nhan: 'Đề thi' },
  { to: '/cai-dat', nhan: 'Cài đặt' },
];

export function Layout() {
  const { data: caiDat } = useQuery({ queryKey: khoa.caiDat, queryFn: api.caiDat.lay });
  const toi = useNguoiDung();
  const vao = useVaoTaiKhoan();
  const navigate = useNavigate();
  const dangXuat = useMutation({
    mutationFn: api.taiKhoan.dangXuat,
    onSuccess: () => {
      navigate('/');
      vao(null);
      thongBao('Đã đăng xuất');
    },
  });
  const menu = toi?.la_quan_tri ? [...MENU, { to: '/tai-khoan', nhan: 'Tài khoản' }] : MENU;
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="font-semibold text-slate-900">Quản lý giảng dạy</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {caiDat ? `${caiDat.ten_gv} · ${caiDat.ma_gv}` : ' '}
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {m.nhan}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1.5 border-t border-slate-200 px-4 py-3 text-xs">
          {toi && (
            <div className="flex items-center justify-between gap-2">
              <NavLink
                to="/ho-so"
                title="Hồ sơ của bạn"
                className={({ isActive }) => `truncate hover:underline ${isActive ? 'font-medium text-blue-700' : 'text-slate-600'}`}
              >
                {toi.ho_ten}
              </NavLink>
              <button className="shrink-0 text-blue-700 hover:underline" onClick={() => dangXuat.mutate()} disabled={dangXuat.isPending}>
                Đăng xuất
              </button>
            </div>
          )}
          <div className="text-slate-400">{caiDat?.nam_hoc ? `Năm học ${caiDat.nam_hoc}` : ''}</div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-5">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
      <Toasts />
    </div>
  );
}
