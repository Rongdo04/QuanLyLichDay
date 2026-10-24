import type { MucDo } from '../repositories/cauHoi.js';

// Bốc câu hỏi từ ngân hàng cho nhiều đề (hàm thuần, không đụng DB)

export interface CauNganHang {
  id: number;
  chu_de: string | null;
  muc_do: MucDo;
  diem: number | null;
  so_lan_dung: number;
}

export interface OCau {
  diem: number;
  muc_do?: MucDo | null; // null = mức nào cũng được
}

export interface DeDaBoc {
  so_de: number;
  cau: { cau_hoi_id: number; diem: number }[];
}

export const NHAN_MUC_DO: Record<MucDo, string> = { de: 'Dễ', tb: 'Trung bình', kho: 'Khó' };

// Trộn ngẫu nhiên (Fisher–Yates); nhận hàm random để test lặp lại được
function tron<T>(a: T[], ngauNhien: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(ngauNhien() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function bocDe(
  nganHang: CauNganHang[],
  soDe: number,
  cauTruc: OCau[],
  ngauNhien: () => number = Math.random,
): { de: DeDaBoc[]; canh_bao: string[] } {
  if (cauTruc.length === 0) throw new Error('Đề phải có ít nhất 1 câu');
  if (nganHang.length < cauTruc.length) {
    throw new Error(
      `Ngân hàng mới có ${nganHang.length} câu, mỗi đề cần ${cauTruc.length} câu. Hãy thêm câu hỏi (hoặc nhờ AI soạn).`,
    );
  }
  const canhBao = new Set<string>();
  const daDungTrongDot = new Map<number, number>(); // id → số đề đã dùng trong lần sinh này
  const de: DeDaBoc[] = [];

  for (let d = 1; d <= soDe; d++) {
    const daChon = new Set<number>();
    const chuDeDaCo = new Set<string>();
    const cau: DeDaBoc['cau'] = [];
    for (const [i, o] of cauTruc.entries()) {
      let ungVien = nganHang.filter((c) => !daChon.has(c.id));
      if (o.muc_do) {
        const dungMuc = ungVien.filter((c) => c.muc_do === o.muc_do);
        if (dungMuc.length) ungVien = dungMuc;
        else canhBao.add(`Câu ${i + 1}: ngân hàng hết câu mức "${NHAN_MUC_DO[o.muc_do]}", đã lấy câu mức khác`);
      }
      // Xếp: chưa dùng trong đợt này → khác chủ đề → đúng điểm → ít được dùng trước đây → ngẫu nhiên
      const chon = tron(ungVien, ngauNhien)
        .map((c) => ({
          c,
          k: [
            daDungTrongDot.get(c.id) ?? 0,
            c.chu_de && chuDeDaCo.has(c.chu_de) ? 1 : 0,
            c.diem != null && c.diem !== o.diem ? 1 : 0,
            c.so_lan_dung,
          ],
        }))
        .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3] - b.k[3])[0].c;
      if ((daDungTrongDot.get(chon.id) ?? 0) > 0) {
        canhBao.add('Ngân hàng chưa đủ câu cho tất cả các đề nên có đề dùng lại câu của đề khác');
      }
      daChon.add(chon.id);
      if (chon.chu_de) chuDeDaCo.add(chon.chu_de);
      daDungTrongDot.set(chon.id, (daDungTrongDot.get(chon.id) ?? 0) + 1);
      cau.push({ cau_hoi_id: chon.id, diem: o.diem });
    }
    de.push({ so_de: d, cau });
  }
  return { de, canh_bao: [...canhBao] };
}

// 2.5 → "2,5"; 3 → "3"
export const dinhDangDiem = (d: number) => String(Math.round(d * 100) / 100).replace('.', ',');
