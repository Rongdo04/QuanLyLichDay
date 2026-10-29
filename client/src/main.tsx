import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CongDangNhap } from './components/CongDangNhap';
import { Layout } from './components/Layout';
import { baoLoi } from './lib/thongBao';
import { TrangCaiDat } from './pages/CaiDat';
import { TrangChamBuoi } from './pages/ChamBuoi';
import { TrangChiTietLop } from './pages/ChiTietLop';
import { TrangDanhSachLop } from './pages/DanhSachLop';
import { TrangDeThi } from './pages/DeThi';
import { TrangDiaDiem } from './pages/DiaDiem';
import { TrangExcel } from './pages/Excel';
import { TrangHoSo } from './pages/HoSo';
import { TrangKyHoc } from './pages/KyHoc';
import { TrangTaiKhoan } from './pages/TaiKhoan';
import { TrangTongQuan } from './pages/TongQuan';
import { TrangTruong } from './pages/Truong';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 },
  },
  // Mọi lỗi khi lưu dữ liệu đều hiện thông báo
  mutationCache: new MutationCache({ onError: (e) => baoLoi(e) }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CongDangNhap>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<TrangTongQuan />} />
              <Route path="cham-buoi" element={<TrangChamBuoi />} />
              <Route path="lop" element={<TrangDanhSachLop />} />
              <Route path="lop/moi" element={<TrangChiTietLop />} />
              <Route path="lop/:id" element={<TrangChiTietLop />} />
              <Route path="ky-hoc" element={<TrangKyHoc />} />
              <Route path="truong" element={<TrangTruong />} />
              <Route path="dia-diem" element={<TrangDiaDiem />} />
              <Route path="excel" element={<TrangExcel />} />
              <Route path="de-thi" element={<TrangDeThi />} />
              <Route path="cai-dat" element={<TrangCaiDat />} />
              <Route path="tai-khoan" element={<TrangTaiKhoan />} />
              <Route path="ho-so" element={<TrangHoSo />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </CongDangNhap>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
