import { dongThongBao, useThongBao } from '../lib/thongBao';

const MAU = {
  'thanh-cong': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  loi: 'border-red-200 bg-red-50 text-red-800',
  'thong-tin': 'border-slate-200 bg-white text-slate-800',
};

export function Toasts() {
  const ds = useThongBao();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {ds.map((t) => (
        <div
          key={t.id}
          role={t.loai === 'loi' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-md ${MAU[t.loai]}`}
        >
          <span className="flex-1">{t.noiDung}</span>
          <button className="opacity-60 hover:opacity-100" onClick={() => dongThongBao(t.id)} aria-label="Đóng">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
