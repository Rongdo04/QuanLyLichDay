import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { TrangThai } from '../api/types';
import { MAU_TRANG_THAI, NHAN_TRANG_THAI } from '../lib/format';

// Các component giao diện nhỏ dùng chung

export function Modal({
  mo,
  tieuDe,
  onDong,
  children,
  rong = 'max-w-lg',
}: {
  mo: boolean;
  tieuDe: string;
  onDong: () => void;
  children: ReactNode;
  rong?: string;
}) {
  useEffect(() => {
    if (!mo) return;
    const phim = (e: KeyboardEvent) => e.key === 'Escape' && onDong();
    window.addEventListener('keydown', phim);
    return () => window.removeEventListener('keydown', phim);
  }, [mo, onDong]);
  if (!mo) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onDong()}
    >
      <div role="dialog" aria-label={tieuDe} className={`the my-10 w-full ${rong} shadow-xl`}>
        <div className="the-dau">
          <h2 className="font-semibold text-slate-900">{tieuDe}</h2>
          <button className="text-xl leading-none text-slate-400 hover:text-slate-600" onClick={onDong} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function TheSoLieu({ nhan, giaTri, phu, noiBat }: { nhan: string; giaTri: string; phu?: string; noiBat?: boolean }) {
  return (
    <div className={`the p-4 ${noiBat ? 'border-blue-200 bg-blue-50/50' : ''}`}>
      <div className="text-sm text-slate-500">{nhan}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${noiBat ? 'text-blue-800' : 'text-slate-900'}`}>{giaTri}</div>
      {phu && <div className="mt-0.5 text-xs text-slate-500">{phu}</div>}
    </div>
  );
}

export function ThanhTienDo({ da, keHoach }: { da: number; keHoach: number | null }) {
  if (!keHoach) return <span className="text-sm tabular-nums text-slate-600">{da} buổi</span>;
  const vuot = da > keHoach;
  const du = da === keHoach;
  return (
    <div className="flex items-center gap-2" title={`${da}/${keHoach} buổi`}>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${vuot ? 'bg-red-500' : du ? 'bg-emerald-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.min(100, (da / keHoach) * 100)}%` }}
        />
      </div>
      <span className={`text-sm tabular-nums ${vuot ? 'font-medium text-red-600' : 'text-slate-700'}`}>
        {da}/{keHoach}
      </span>
    </div>
  );
}

export function NhanTrangThai({ trangThai }: { trangThai: TrangThai }) {
  return <span className={`nhan-trang-thai ${MAU_TRANG_THAI[trangThai]}`}>{NHAN_TRANG_THAI[trangThai]}</span>;
}

export function DangTai({ chu = 'Đang tải…' }: { chu?: string }) {
  return <div className="py-10 text-center text-sm text-slate-500">{chu}</div>;
}

export function BaoLoiTai({ loi }: { loi: unknown }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {loi instanceof Error ? loi.message : 'Không tải được dữ liệu'}
    </div>
  );
}

export function TrongRong({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function TieuDeTrang({ tieuDe, phu, children }: { tieuDe: string; phu?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{tieuDe}</h1>
        {phu && <div className="mt-0.5 text-sm text-slate-500">{phu}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
