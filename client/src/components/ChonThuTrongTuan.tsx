import type { DuKien } from '../api/types';
import { moTaThu, type LichTheoThu } from '../lib/nghiepVu';

const CAC_THU = [2, 3, 4, 5, 6, 7, 8];
const TEN_THU: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'CN' };

// Chọn các thứ dạy trong tuần, mỗi thứ chọn Sáng / Chiều / Cả ngày
export function ChonThuTrongTuan({
  thu,
  onDoi,
  goiY = 'Chọn ít nhất một thứ.',
}: {
  thu: LichTheoThu;
  onDoi: (thu: LichTheoThu) => void;
  goiY?: string;
}) {
  const coThu = Object.values(thu).some(Boolean);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {CAC_THU.map((t) => {
          const dk = thu[t];
          return (
            <div
              key={t}
              className={`rounded-md border p-1.5 text-center ${dk ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
            >
              <label className="flex cursor-pointer items-center justify-center gap-1 text-sm font-medium">
                <input
                  type="checkbox"
                  aria-label={`Dạy ${TEN_THU[t]}`}
                  checked={!!dk}
                  onChange={(e) => onDoi({ ...thu, [t]: e.target.checked ? 'S' : undefined })}
                />
                {TEN_THU[t]}
              </label>
              <select
                className="mt-1 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs disabled:opacity-40"
                aria-label={`Buổi dự kiến ${TEN_THU[t]}`}
                disabled={!dk}
                value={dk ?? 'S'}
                onChange={(e) => onDoi({ ...thu, [t]: e.target.value as DuKien })}
              >
                <option value="S">Sáng</option>
                <option value="C">Chiều</option>
                <option value="SC">Cả ngày</option>
              </select>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-sm text-slate-600">{coThu ? moTaThu(thu) : goiY}</p>
    </div>
  );
}

// {"4":"C"} (chuỗi JSON lưu trong lớp) ↔ { 4: 'C' }
export function docLichTuan(json: string | null | undefined): LichTheoThu {
  if (!json) return {};
  try {
    const kq: LichTheoThu = {};
    for (const [k, v] of Object.entries(JSON.parse(json) as Record<string, DuKien>)) kq[Number(k)] = v;
    return kq;
  } catch {
    return {};
  }
}

export const lichTuanGui = (thu: LichTheoThu): Record<string, DuKien> =>
  Object.fromEntries(Object.entries(thu).filter(([, v]) => v)) as Record<string, DuKien>;
