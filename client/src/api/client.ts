// Gọi API của server. Lỗi trả về dạng { loi: "…" } → ném LoiApi kèm thông báo tiếng Việt.

export class LoiApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface TuyChonGoi {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  body?: BodyInit;
}

export async function goiApi<T>(duongDan: string, tc: TuyChonGoi = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + duongDan, {
      method: tc.method ?? (tc.json !== undefined || tc.body ? 'POST' : 'GET'),
      headers: tc.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: tc.json !== undefined ? JSON.stringify(tc.json) : tc.body,
    });
  } catch {
    throw new LoiApi(0, 'Không kết nối được máy chủ. Hãy kiểm tra phần mềm còn đang chạy.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new LoiApi(res.status, data?.loi ?? `Lỗi máy chủ (${res.status})`);
  return data as T;
}

type GiaTriQuery = string | number | null | undefined | number[];

// { tu: '2026-10-01', lopIds: [1, 2] } → "?tu=2026-10-01&lopIds=1,2"
export function chuoiQuery(thamSo: Record<string, GiaTriQuery>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(thamSo)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','));
    } else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
