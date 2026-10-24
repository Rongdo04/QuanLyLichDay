import type { MucDo } from '../../api/types';

export const NHAN_MUC_DO: Record<MucDo, string> = { de: 'Dễ', tb: 'Trung bình', kho: 'Khó' };
export const MAU_MUC_DO: Record<MucDo, string> = {
  de: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  tb: 'bg-sky-50 text-sky-700 border-sky-200',
  kho: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function NhanMucDo({ mucDo }: { mucDo: MucDo }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${MAU_MUC_DO[mucDo]}`}>
      {NHAN_MUC_DO[mucDo]}
    </span>
  );
}

// 2.5 → "2,5"
export const dinhDangDiem = (d: number | null | undefined) =>
  d == null ? '' : String(Math.round(d * 100) / 100).replace('.', ',');

// "2,5" → 2.5; không hợp lệ → null
export const docSoDiem = (s: string): number | null => {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 && n <= 10 ? n : null;
};

// "3; 3; 4" hoặc "3 3 4" → [3, 3, 4]; có giá trị sai → null
export function docDanhSachDiem(s: string): number[] | null {
  const phan = s.split(/[;\s/+]+/).filter(Boolean);
  if (!phan.length) return null;
  const ds = phan.map(docSoDiem);
  return ds.every((x): x is number => x !== null) ? ds : null;
}

// Tải file qua đường dẫn API (trình duyệt tự lưu file)
export function taiFile(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Ô chọn mức độ dùng chung
export function ChonMucDo({
  giaTri,
  onDoi,
  choPhepTrong,
  ...con
}: {
  giaTri: MucDo | null;
  onDoi: (v: MucDo | null) => void;
  choPhepTrong?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  return (
    <select
      {...con}
      className={con.className ?? 'o-nhap'}
      value={giaTri ?? ''}
      onChange={(e) => onDoi((e.target.value || null) as MucDo | null)}
    >
      {choPhepTrong && <option value="">{choPhepTrong}</option>}
      <option value="de">Dễ</option>
      <option value="tb">Trung bình</option>
      <option value="kho">Khó</option>
    </select>
  );
}
