// Tách câu hỏi + đáp án từ văn bản dán vào (chép từ đề cũ trong Word)
//
// Nhận cả hai kiểu:
//   Câu 1 (3 điểm): …            hoặc     Câu 1 (3 điểm): …
//   Đáp án: …                             Câu 2 (3 điểm): …
//   Câu 2 (3 điểm): …                     ĐÁP ÁN
//   Đáp án: …                             Câu 1: …
//                                         Câu 2: …

export interface CauTachDuoc {
  noi_dung: string;
  dap_an: string;
  diem: number | null;
}

const RE_CAU = /^\s*Câu\s*(\d+)\s*(?:\(\s*([\d.,]+)\s*(?:điểm|đ)\s*\))?\s*[:.)\-–]?\s*(.*)$/iu;
const RE_DAP_AN_TRONG_CAU = /^\s*(?:Đáp\s*án|Hướng\s*dẫn\s*chấm|Gợi\s*ý(?:\s*trả\s*lời)?|Trả\s*lời)\s*[:.\-–]\s*(.*)$/iu;
const RE_DAP_AN_RIENG = /^\s*(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM)\b/u; // tiêu đề viết hoa → phần đáp án riêng
const RE_BO_QUA = /^\s*(?:-{2,}\s*Hết\s*-{2,}|=+\**=+|\**\s*Hết\s*\**|Đề\s*(?:thi\s*)?số\s*:?\s*\d+.*)\s*$/iu;

const soDiem = (s?: string) => {
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const gon = (dong: string[]) => dong.join('\n').replace(/\n{3,}/g, '\n\n').trim();

export function phanTichVanBan(vanBan: string): CauTachDuoc[] {
  const dong = vanBan.normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
  const ds: { so: number; diem: number | null; noi: string[]; da: string[] }[] = [];
  let hienTai: (typeof ds)[number] | null = null;
  let dangGhi: 'noi' | 'da' = 'noi';
  let cheDoDapAnRieng = false;
  let dapAnRieng: (typeof ds)[number] | null = null;

  for (const d of dong) {
    if (RE_BO_QUA.test(d)) continue;
    if (!cheDoDapAnRieng && RE_DAP_AN_RIENG.test(d) && !RE_DAP_AN_TRONG_CAU.test(d)) {
      cheDoDapAnRieng = true;
      dapAnRieng = null;
      continue;
    }
    const m = RE_CAU.exec(d);
    if (m) {
      const so = Number(m[1]);
      if (cheDoDapAnRieng) {
        // Gán vào câu cùng số (câu gần nhất có số đó)
        dapAnRieng = [...ds].reverse().find((c) => c.so === so) ?? null;
        if (dapAnRieng) {
          dapAnRieng.diem ??= soDiem(m[2]);
          if (m[3]) dapAnRieng.da.push(m[3]);
        }
        continue;
      }
      hienTai = { so, diem: soDiem(m[2]), noi: m[3] ? [m[3]] : [], da: [] };
      ds.push(hienTai);
      dangGhi = 'noi';
      continue;
    }
    if (cheDoDapAnRieng) {
      dapAnRieng?.da.push(d);
      continue;
    }
    if (!hienTai) continue;
    const da = RE_DAP_AN_TRONG_CAU.exec(d);
    if (da) {
      dangGhi = 'da';
      if (da[1]) hienTai.da.push(da[1]);
      continue;
    }
    hienTai[dangGhi].push(d);
  }
  return ds
    .map((c) => ({ noi_dung: gon(c.noi), dap_an: gon(c.da), diem: c.diem }))
    .filter((c) => c.noi_dung);
}
