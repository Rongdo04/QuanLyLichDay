import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { LoiApp } from '../utils/loi.js';

// Điền dữ liệu đề thi vào mẫu Word (.docx) có các ô {…} của docxtemplater

export interface CauTrongDe {
  so: number;
  diem: string;     // "3" hoặc "2,5"
  noi_dung: string;
  dap_an: string;
}

export interface DeTrongFile {
  so_de: string;     // "01"
  tong_diem: string;
  cau: CauTrongDe[];
}

export interface DuLieuMau {
  truong: string;
  truong_in_hoa: string;
  dia_danh: string;
  hoc_phan: string;
  ma_hoc_phan: string;
  nganh: string;
  trinh_do: string;
  lop: string;
  lop_van_hoa: string;
  nam_hoc: string;
  hoc_ky: string;
  hinh_thuc: string;
  thoi_gian: string;
  ngay_thi: string;
  tai_lieu: string;  // "không được" / "được"
  ten_gv: string;
  ma_gv: string;
  so_de_thi: number;
  de: DeTrongFile[];
}

// Danh sách ô điền (hiện ở trang hướng dẫn tải mẫu lên)
export const CAC_O_DIEN: { o: string; mo_ta: string }[] = [
  { o: '{truong}', mo_ta: 'Tên trường' },
  { o: '{truong_in_hoa}', mo_ta: 'Tên trường viết hoa' },
  { o: '{dia_danh}', mo_ta: 'Địa danh ở dòng ngày ký (mặc định "Hà Nội")' },
  { o: '{hoc_phan}', mo_ta: 'Tên học phần / môn' },
  { o: '{ma_hoc_phan}', mo_ta: 'Mã học phần (VD CT14)' },
  { o: '{nganh}', mo_ta: 'Ngành' },
  { o: '{trinh_do}', mo_ta: 'Trình độ đào tạo' },
  { o: '{lop}', mo_ta: 'Mã lớp' },
  { o: '{lop_van_hoa}', mo_ta: 'Lớp văn hóa' },
  { o: '{nam_hoc}', mo_ta: 'Năm học' },
  { o: '{hoc_ky}', mo_ta: 'Học kỳ (I, II…)' },
  { o: '{hinh_thuc}', mo_ta: 'Hình thức thi' },
  { o: '{thoi_gian}', mo_ta: 'Thời gian làm bài (phút)' },
  { o: '{ngay_thi}', mo_ta: 'Ngày thi' },
  { o: '{tai_lieu}', mo_ta: '"không được" hoặc "được" (sử dụng tài liệu)' },
  { o: '{ten_gv}', mo_ta: 'Tên giáo viên ra đề' },
  { o: '{#de} … {/de}', mo_ta: 'Lặp lại phần nằm giữa cho từng đề (đặt quanh cả trang đề, và quanh cả trang đáp án)' },
  { o: '{so_de}', mo_ta: 'Số thứ tự đề: 01, 02… (dùng trong {#de})' },
  { o: '{#cau} … {/cau}', mo_ta: 'Lặp lại cho từng câu hỏi (dùng trong {#de})' },
  { o: '{so} / {diem}', mo_ta: 'Số câu và điểm của câu (dùng trong {#cau})' },
  { o: '{noi_dung}', mo_ta: 'Nội dung câu hỏi (dùng trong {#cau})' },
  { o: '{dap_an}', mo_ta: 'Đáp án và thang điểm (dùng trong {#cau})' },
];

function taoDocx(mau: Buffer) {
  let zip: PizZip;
  try {
    zip = new PizZip(mau);
  } catch {
    throw new LoiApp(400, 'File mẫu không phải file Word .docx hợp lệ');
  }
  try {
    return new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
  } catch (e) {
    throw new LoiApp(400, `Mẫu Word có ô điền viết sai: ${moTaLoi(e)}`);
  }
}

// Lỗi docxtemplater → câu tiếng Việt dễ hiểu
function moTaLoi(e: unknown): string {
  const loi = (e as { properties?: { errors?: { properties?: { explanation?: string; xtag?: string; id?: string } }[] } })
    .properties?.errors;
  if (!loi?.length) return (e as Error).message;
  return loi
    .slice(0, 5)
    .map((x) => {
      const p = x.properties ?? {};
      const the = p.xtag ? `"{${p.xtag}}"` : '';
      switch (p.id) {
        case 'unclosed_loop':
          return `vòng lặp ${the} chưa có thẻ đóng`;
        case 'unopened_loop':
          return `thẻ đóng ${the} không có thẻ mở`;
        case 'unclosed_tag':
          return `ô ${the} thiếu dấu "}"`;
        case 'unopened_tag':
          return `thừa dấu "}" ở ${the}`;
        case 'closing_tag_does_not_match_opening_tag':
          return `thẻ đóng không khớp thẻ mở ${the}`;
        default:
          return p.explanation ?? 'lỗi không rõ';
      }
    })
    .join('; ');
}

const tachDong = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((d) => d.trimEnd())
    .filter((d, i, a) => d || (i > 0 && i < a.length - 1));

// Mẫu có sẵn đặt mỗi dòng nội dung thành một đoạn riêng (căn đều không bị giãn chữ):
// dong_dau = dòng đầu câu hỏi, dong_sau = các dòng còn lại, dong_dap_an = các dòng đáp án
function themDong(duLieu: DuLieuMau) {
  return {
    ...duLieu,
    de: duLieu.de.map((d) => ({
      ...d,
      cau: d.cau.map((c) => {
        const [dau = '', ...sau] = tachDong(c.noi_dung);
        return {
          ...c,
          dong_dau: dau,
          dong_sau: sau.map((chu) => ({ chu })),
          dong_dap_an: tachDong(c.dap_an).map((chu) => ({ chu })),
        };
      }),
    })),
  };
}

// Giãn dòng mọi đoạn: Multiple 1.3 (312/240), Before = After = 0
const GIAN_DONG = '<w:spacing w:before="0" w:after="0" w:beforeAutospacing="0" w:afterAutospacing="0" w:line="312" w:lineRule="auto"/>';
// Các thẻ đứng sau w:spacing trong w:pPr (Word đòi đúng thứ tự)
const SAU_SPACING =
  /<w:(ind|contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)[\s/>]/;

export function datGianDong(xml: string): string {
  return (
    xml
      // bỏ giãn dòng cũ của đoạn (giữ <w:spacing w:val> giãn chữ trong w:rPr)
      .replace(/<w:spacing\b(?![^>]*\bw:val=)[^>]*\/>/g, '')
      .replace(/<w:pPr\/>/g, '<w:pPr></w:pPr>')
      .replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (_, trong: string) => {
        const i = trong.search(SAU_SPACING);
        return i < 0 ? `<w:pPr>${trong}${GIAN_DONG}</w:pPr>` : `<w:pPr>${trong.slice(0, i)}${GIAN_DONG}${trong.slice(i)}</w:pPr>`;
      })
      // đoạn chưa có w:pPr
      .replace(/<w:p(\s[^>]*)?\/>/g, (_, tt = '') => `<w:p${tt}><w:pPr>${GIAN_DONG}</w:pPr></w:p>`)
      .replace(/<w:p(\s[^>]*)?>(?!<w:pPr[\s/>])/g, (_, tt = '') => `<w:p${tt}><w:pPr>${GIAN_DONG}</w:pPr>`)
  );
}

export function dienMau(mau: Buffer, duLieu: DuLieuMau): Buffer {
  const doc = taoDocx(mau);
  try {
    doc.render(themDong(duLieu));
  } catch (e) {
    throw new LoiApp(400, `Không điền được mẫu Word: ${moTaLoi(e)}`);
  }
  const zip = doc.getZip();
  zip.file('word/document.xml', datGianDong(zip.file('word/document.xml')!.asText()));
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Kiểm tra mẫu tải lên: đọc được, có vòng lặp đề và câu hỏi
export function kiemTraMau(mau: Buffer): { canh_bao: string[]; o_dien: string[] } {
  const doc = taoDocx(mau);
  const chu = doc.getFullText();
  const oDien = [...new Set([...chu.matchAll(/\{([#/]?[a-z_]+)\}/g)].map((m) => m[1]))];
  if (!oDien.includes('#cau')) {
    throw new LoiApp(
      400,
      'Mẫu chưa có ô {#cau}…{/cau} để chèn câu hỏi. Hãy gõ vào chỗ đặt câu hỏi: {#cau}Câu {so} ({diem} điểm): {noi_dung}{/cau}',
    );
  }
  const canhBao: string[] = [];
  if (!oDien.includes('#de')) canhBao.push('Mẫu không có {#de}…{/de}: chỉ in được 1 đề trong file');
  if (!oDien.includes('dap_an') && !oDien.includes('#dong_dap_an')) canhBao.push('Mẫu không có ô {dap_an}: file sinh ra sẽ không có đáp án');
  if (!oDien.includes('so_de')) canhBao.push('Mẫu không có ô {so_de}: các đề sẽ không ghi số đề');
  return { canh_bao: canhBao, o_dien: oDien };
}
