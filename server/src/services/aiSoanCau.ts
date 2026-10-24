import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z as z4 } from 'zod/v4';
import { layDb } from '../db/connection.js';
import type { CauHoi, MucDo } from '../repositories/cauHoi.js';
import type { Mon } from '../repositories/mon.js';
import { LoiApp } from '../utils/loi.js';
import { dinhDangDiem, NHAN_MUC_DO } from './bocDe.js';

// AI (Claude) soạn câu hỏi tự luận lý thuyết kèm đáp án cho ngân hàng câu hỏi.
// Câu AI soạn chỉ là bản nháp: thầy duyệt, sửa rồi mới lưu vào ngân hàng.

export const MO_HINH = 'claude-opus-5-5';
const KHOA_API = 'bi_mat_anthropic_api_key';

// ---- API key: lưu trong cai_dat (máy local), hoặc biến môi trường ANTHROPIC_API_KEY ----

export function layKhoaApi(): { khoa: string | null; nguon: 'cai_dat' | 'moi_truong' | null } {
  const r = layDb().prepare('SELECT gia_tri FROM cai_dat WHERE khoa = ?').get(KHOA_API) as { gia_tri: string } | undefined;
  if (r?.gia_tri) return { khoa: r.gia_tri, nguon: 'cai_dat' };
  if (process.env.ANTHROPIC_API_KEY) return { khoa: process.env.ANTHROPIC_API_KEY, nguon: 'moi_truong' };
  return { khoa: null, nguon: null };
}

export function ghiKhoaApi(khoa: string | null) {
  if (khoa) {
    layDb()
      .prepare('INSERT INTO cai_dat (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri')
      .run(KHOA_API, khoa);
  } else layDb().prepare('DELETE FROM cai_dat WHERE khoa = ?').run(KHOA_API);
}

// Chỉ hiện vài ký tự cuối, không bao giờ trả key đầy đủ ra giao diện
export function trangThaiKhoa() {
  const { khoa, nguon } = layKhoaApi();
  return { co_khoa: !!khoa, nguon, khoa_an: khoa ? `${khoa.slice(0, 7)}…${khoa.slice(-4)}` : null, mo_hinh: MO_HINH };
}

let taoClient = (apiKey: string): Pick<Anthropic, 'beta'> => new Anthropic({ apiKey, timeout: 5 * 60 * 1000 });
// Dùng trong test: thay client thật bằng client giả
export function datTaoClient(f: typeof taoClient) {
  taoClient = f;
}

// ---- Soạn câu hỏi ----

const SchemaKetQua = z4.object({
  cau_hoi: z4.array(
    z4.object({
      chu_de: z4.string().describe('Chương / chủ đề của câu hỏi, ngắn gọn'),
      muc_do: z4.enum(['de', 'tb', 'kho']).describe('de = dễ (nhớ, hiểu), tb = trung bình (hiểu, vận dụng), kho = khó (vận dụng, phân tích)'),
      diem: z4.number().describe('Điểm của câu'),
      noi_dung: z4.string().describe('Nội dung câu hỏi. Ý nhỏ a), b)… mỗi ý một dòng'),
      dap_an: z4.string().describe('Đáp án: mỗi ý một dòng bắt đầu bằng "- ", cuối mỗi ý ghi điểm trong ngoặc, VD "(1 điểm)"'),
    }),
  ),
});

export interface YeuCauSoan {
  so_cau: number;
  diem: number[];               // điểm gợi ý cho các câu (VD [3, 3, 4]); câu thứ i lấy diem[i % length]
  muc_do: MucDo | 'tron';       // 'tron' = trộn đủ mức
  chu_de: string | null;        // giới hạn trong chương / chủ đề này
  yeu_cau_them: string | null;  // VD "tập trung vào CSS", "có câu so sánh"
}

export interface CauAiSoan {
  chu_de: string | null;
  muc_do: MucDo;
  diem: number;
  noi_dung: string;
  dap_an: string;
}

const HE_THONG = `Bạn là giáo viên dạy nghề lâu năm ở Việt Nam, soạn đề thi kết thúc học phần LÝ THUYẾT dạng TỰ LUẬN cho học sinh hệ trung cấp.

Yêu cầu chung:
- Viết tiếng Việt chuẩn, có dấu, thuật ngữ chuyên ngành đúng như trong giáo trình trung cấp; thuật ngữ tiếng Anh thông dụng giữ nguyên (VD: HTML, CSS, router).
- Câu hỏi rõ ràng, một nghĩa, học sinh trung cấp làm được trong thời gian thi; không hỏi mẹo, không hỏi kiến thức ngoài chương trình.
- Đa dạng dạng câu: trình bày khái niệm, liệt kê và giải thích, so sánh / phân biệt, nêu ví dụ, giải thích tình huống thực tế đơn giản. Câu nhiều điểm (từ 3 điểm) nên có 2–3 ý nhỏ a), b), c).
- Đáp án là hướng dẫn chấm: liệt kê các ý chính học sinh cần nêu, mỗi ý một dòng bắt đầu bằng "- ", cuối mỗi ý ghi số điểm trong ngoặc như "(0,5 điểm)". Tổng điểm các ý đúng bằng điểm của câu. Dùng dấu phẩy cho số thập phân (0,5; 1,5).
- Không trùng hoặc gần trùng với các câu đã có trong ngân hàng.`;

function moTaYeuCau(mon: Mon, y: YeuCauSoan, cauDaCo: Pick<CauHoi, 'noi_dung'>[]): string {
  const diemTungCau = Array.from({ length: y.so_cau }, (_, i) => dinhDangDiem(y.diem[i % y.diem.length]));
  const mucDo =
    y.muc_do === 'tron' ? 'trộn đều các mức dễ, trung bình, khó' : `tất cả ở mức ${NHAN_MUC_DO[y.muc_do].toLowerCase()}`;
  const phan = [
    `Môn / học phần: ${mon.ten}${mon.ma ? ` (mã ${mon.ma})` : ''}`,
    `Ngành: ${mon.nganh} — Trình độ: ${mon.trinh_do}`,
  ];
  if (mon.de_cuong?.trim()) phan.push(`Nội dung / đề cương môn (chỉ ra câu hỏi trong phạm vi này):\n${mon.de_cuong.trim()}`);
  if (y.chu_de) phan.push(`Chỉ soạn câu hỏi thuộc chủ đề: ${y.chu_de}`);
  phan.push(`Số câu cần soạn: ${y.so_cau}. Điểm lần lượt từng câu: ${diemTungCau.join('; ')}. Mức độ: ${mucDo}.`);
  if (y.yeu_cau_them) phan.push(`Yêu cầu thêm của giáo viên: ${y.yeu_cau_them}`);
  if (cauDaCo.length) {
    // Gửi tối đa 150 câu gần nhất, cắt ngắn, để AI tránh trùng
    const ds = cauDaCo
      .slice(-150)
      .map((c, i) => `${i + 1}. ${c.noi_dung.replace(/\s+/g, ' ').slice(0, 160)}`)
      .join('\n');
    phan.push(`Các câu đã có trong ngân hàng (không soạn trùng):\n${ds}`);
  }
  return phan.join('\n\n');
}

export async function soanCauHoi(mon: Mon, y: YeuCauSoan, cauDaCo: Pick<CauHoi, 'noi_dung'>[]): Promise<CauAiSoan[]> {
  const { khoa } = layKhoaApi();
  if (!khoa) throw new LoiApp(400, 'Chưa có API key của Claude. Vào Cài đặt → "AI soạn câu hỏi" để nhập key.');
  const client = taoClient(khoa);
  let phanHoi;
  try {
    phanHoi = await client.beta.messages.parse({
      model: MO_HINH,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: betaZodOutputFormat(SchemaKetQua) },
      // Nếu bị bộ lọc an toàn từ chối nhầm, máy chủ tự chạy lại bằng mô hình dự phòng
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: HE_THONG,
      messages: [{ role: 'user', content: moTaYeuCau(mon, y, cauDaCo) }],
    });
  } catch (e) {
    throw loiAi(e);
  }
  if (phanHoi.stop_reason === 'refusal') throw new LoiApp(422, 'AI từ chối soạn nội dung này. Hãy diễn đạt lại yêu cầu.');
  if (phanHoi.stop_reason === 'max_tokens') throw new LoiApp(422, 'AI trả lời quá dài nên bị cắt. Hãy giảm số câu mỗi lần soạn.');
  const kq = phanHoi.parsed_output;
  if (!kq) throw new LoiApp(502, 'AI trả kết quả không đúng định dạng. Hãy thử lại.');
  return kq.cau_hoi.map((c) => ({
    chu_de: c.chu_de.trim() || y.chu_de,
    muc_do: c.muc_do,
    diem: c.diem > 0 ? c.diem : y.diem[0],
    noi_dung: c.noi_dung.trim(),
    dap_an: c.dap_an.trim(),
  }));
}

// Kiểm tra key bằng một lời gọi rất nhỏ
export async function kiemTraKhoa(khoa: string): Promise<void> {
  try {
    await taoClient(khoa).beta.messages.create({
      model: MO_HINH,
      max_tokens: 64,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Trả lời đúng một chữ: OK' }],
    });
  } catch (e) {
    throw loiAi(e);
  }
}

function loiAi(e: unknown): LoiApp {
  if (e instanceof LoiApp) return e;
  if (e instanceof Anthropic.AuthenticationError) return new LoiApp(400, 'API key không đúng hoặc đã bị thu hồi');
  if (e instanceof Anthropic.PermissionDeniedError) return new LoiApp(400, 'API key không có quyền dùng mô hình này');
  if (e instanceof Anthropic.RateLimitError) return new LoiApp(429, 'Gọi AI quá nhiều trong thời gian ngắn, chờ một lát rồi thử lại');
  if (e instanceof Anthropic.BadRequestError) {
    const m = e.message.toLowerCase();
    if (m.includes('credit') || m.includes('billing')) return new LoiApp(402, 'Tài khoản Claude API đã hết tiền. Hãy nạp thêm tại console.anthropic.com');
    return new LoiApp(400, `Yêu cầu gửi AI không hợp lệ: ${e.message}`);
  }
  if (e instanceof Anthropic.APIConnectionError) return new LoiApp(503, 'Không kết nối được tới AI. Kiểm tra mạng Internet rồi thử lại.');
  if (e instanceof Anthropic.APIError) return new LoiApp(502, `AI đang lỗi (${e.status ?? '?'}), thử lại sau`);
  return new LoiApp(500, `Lỗi khi gọi AI: ${(e as Error).message}`);
}
