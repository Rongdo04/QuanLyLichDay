import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, khoa } from '../api';
import type { TrangThaiDangNhap } from '../api/types';
import { TheSoLieu, TieuDeTrang } from '../components/ChungUI';
import { useNguoiDung } from '../components/CongDangNhap';
import { dinhDangNgay, dinhDangTien } from '../lib/format';
import { thongBao } from '../lib/thongBao';

// Hồ sơ của người đang đăng nhập: thông tin tài khoản, sửa họ tên / email, tóm tắt dữ liệu riêng

export function TrangHoSo() {
  const toi = useNguoiDung();
  const qc = useQueryClient();
  const { data: dsLop } = useQuery({ queryKey: khoa.dsLop(), queryFn: () => api.lop.ds() });
  const { data: dsTruong } = useQuery({ queryKey: khoa.truong, queryFn: api.truong.ds });
  const [f, setF] = useState({ ho_ten: '', email: '' });
  useEffect(() => {
    if (toi) setF({ ho_ten: toi.ho_ten, email: toi.email ?? '' });
  }, [toi]);

  const luu = useMutation({
    mutationFn: () => api.taiKhoan.suaToi({ ho_ten: f.ho_ten, email: f.email }),
    onSuccess: (n) => {
      qc.setQueryData<TrangThaiDangNhap>(khoa.toi, { nguoi_dung: n, can_khoi_tao: false });
      thongBao('Đã lưu hồ sơ');
    },
  });
  const gui = (e: FormEvent) => {
    e.preventDefault();
    luu.mutate();
  };

  if (!toi) return null;
  const dangDay = dsLop?.filter((l) => l.trang_thai === 'dang_day').length ?? 0;
  const tongTien = dsLop?.reduce((s, l) => s + l.tong, 0) ?? 0;
  const daSua = f.ho_ten.trim() !== toi.ho_ten || f.email.trim() !== (toi.email ?? '');

  return (
    <>
      <TieuDeTrang tieuDe="Hồ sơ" phu={`Xin chào, ${toi.ho_ten}`} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <TheSoLieu nhan="Lớp đang dạy" giaTri={String(dangDay)} phu={`${dsLop?.length ?? 0} lớp tất cả`} />
        <TheSoLieu nhan="Trường" giaTri={String(dsTruong?.filter((t) => !t.da_an).length ?? 0)} />
        <TheSoLieu nhan="Tổng tiền các lớp" giaTri={dinhDangTien(tongTien)} phu="tiền nhận về, từ trước đến nay" />
        <TheSoLieu nhan="Vai trò" giaTri={toi.la_quan_tri ? 'Quản trị' : 'Người dùng'} phu={`Tạo ngày ${dinhDangNgay(toi.tao_luc.slice(0, 10))}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <form onSubmit={gui} className="the">
          <div className="the-dau">
            <h2 className="font-medium">Thông tin tài khoản</h2>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <label className="nhan" htmlFor="hs-ten-dn">
                Tên đăng nhập
              </label>
              <input id="hs-ten-dn" className="o-nhap" value={toi.ten_dang_nhap} disabled />
            </div>
            <div>
              <label className="nhan" htmlFor="hs-ho-ten">
                Họ tên
              </label>
              <input id="hs-ho-ten" className="o-nhap" required value={f.ho_ten} onChange={(e) => setF({ ...f, ho_ten: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="nhan" htmlFor="hs-email">
                Email
              </label>
              <input
                id="hs-email"
                type="email"
                className="o-nhap"
                placeholder="Để lấy lại mật khẩu; cũng dùng để đăng nhập"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end px-4 pb-4">
            <button className="btn-chinh" disabled={!daSua || luu.isPending}>
              {luu.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>

        <div className="the space-y-2 p-4 text-sm">
          <h2 className="font-medium">Bảo mật</h2>
          <p className="text-slate-600">Dữ liệu của bạn (trường, lớp, lịch, đề thi, cài đặt) chỉ mình bạn thấy.</p>
          <Link className="lien-ket block" to="/cai-dat#doi-mat-khau">
            Đổi mật khẩu →
          </Link>
          <Link className="lien-ket block" to="/cai-dat">
            Thông tin giáo viên trên file Excel →
          </Link>
          {toi.la_quan_tri ? (
            <Link className="lien-ket block" to="/tai-khoan">
              Quản lý tài khoản người khác →
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
