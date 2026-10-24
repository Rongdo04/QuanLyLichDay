import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ApiError as LoiGemini, GoogleGenAI } from '@google/genai';
import { z as z4 } from 'zod/v4';
import { layDb } from '../db/connection.js';
import type { CauHoi, MucDo } from '../repositories/cauHoi.js';
import type { Mon } from '../repositories/mon.js';
import { LoiApp } from '../utils/loi.js';
import { dinhDangDiem, NHAN_MUC_DO } from './bocDe.js';

// AI soạn câu hỏi tự luận lý thuyết kèm đáp án cho ngân hàng câu hỏi.
// Hỗ trợ Gemini (Google, có gói miễn phí — mặc định) và Claude (Anthropic, trả phí).
// Câu AI soạn chỉ là bản nháp: thầy duyệt, sửa rồi mới lưu vào ngân hàng.

export type MaNhaCungCap = 'gemini' | 'claude';

// ---- Kết quả AI phải trả về ----

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
type KetQuaAi = z4.infer<typeof SchemaKetQua>;

// JSON Schema cho Gemini (bỏ khóa $schema)
const { $schema: _boQua, ...JSON_SCHEMA_KET_QUA } = z4.toJSONSchema(SchemaKetQua) as Record<string, unknown>;

// ---- Các nhà cung cấp ----

interface NhaCungCap {
  ten: string;
  mo_hinh: string;
  mien_phi: boolean;
  bien_moi_truong: string;
  soan(khoa: string, heThong: string, noiDung: string): Promise<KetQuaAi>;
  kiemTra(khoa: string): Promise<void>;
}

const GEMINI: NhaCungCap = {
  ten: 'Gemini (Google)',
  mo_hinh: 'gemini-3.8-flash',
  mien_phi: true,
  bien_moi_truong: 'GEMINI_API_KEY',
  async soan(khoa, heThong, noiDung) {
    const ai = new GoogleGenAI({ apiKey: khoa });
    const r = await ai.models.generateContent({
      model: this.mo_hinh,
      contents: noiDung,
      config: {
        systemInstruction: heThong,
        responseMimeType: 'application/json',
        responseJsonSchema: JSON_SCHEMA_KET_QUA,
      },
    });
    const lyDoDung = r.candidates?.[0]?.finishReason;
    if (lyDoDung === 'SAFETY' || lyDoDung === 'PROHIBITED_CONTENT' || r.promptFeedback?.blockReason)
      throw new LoiApp(422, 'AI từ chối soạn nội dung này. Hãy diễn đạt lại yêu cầu.');
    if (lyDoDung === 'MAX_TOKENS') throw new LoiApp(422, 'AI trả lời quá dài nên bị cắt. Hãy giảm số câu mỗi lần soạn.');
    return docJson(r.text);
  },
  async kiemTra(khoa) {
    const ai = new GoogleGenAI({ apiKey: khoa });
    await ai.models.generateContent({ model: this.mo_hinh, contents: 'Trả lời đúng một chữ: OK' });
  },
};

const CLAUDE: NhaCungCap = {
  ten: 'Claude (Anthropic)',
  mo_hinh: 'claude-opus-5-5',
  mien_phi: false,
  bien_moi_truong: 'ANTHROPIC_API_KEY',
  async soan(khoa, heThong, noiDung) {
    const client = new Anthropic({ apiKey: khoa, timeout: 5 * 60 * 1000 });
    const r = await client.beta.messages.parse({
      model: this.mo_hinh,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: betaZodOutputFormat(SchemaKetQua) },
      // Nếu bị bộ lọc an toàn từ chối nhầm, máy chủ tự chạy lại bằng mô hình dự phòng
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: heThong,
      messages: [{ role: 'user', content: noiDung }],
    });
    if (r.stop_reason === 'refusal') throw new LoiApp(422, 'AI từ chối soạn nội dung này. Hãy diễn đạt lại yêu cầu.');
    if (r.stop_reason === 'max_tokens') throw new LoiApp(422, 'AI trả lời quá dài nên bị cắt. Hãy giảm số câu mỗi lần soạn.');
    if (!r.parsed_output) throw new LoiApp(502, 'AI trả kết quả không đúng định dạng. Hãy thử lại.');
    return r.parsed_output;
  },
  async kiemTra(khoa) {
    const client = new Anthropic({ apiKey: khoa });
    await client.messages.create({
      model: this.mo_hinh,
      max_tokens: 64,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Trả lời đúng một chữ: OK' }],
    });
  },
};

const NHA_CUNG_CAP: Record<MaNhaCungCap, NhaCungCap> = { gemini: GEMINI, claude: CLAUDE };

// Dùng trong test: thay cách gọi AI thật bằng hàm giả
export function datNhaCungCap(ma: MaNhaCungCap, thay: Partial<Pick<NhaCungCap, 'soan' | 'kiemTra'>>) {
  Object.assign(NHA_CUNG_CAP[ma], thay);
}

function docJson(text: string | undefined): KetQuaAi {
  let du: unknown;
  try {
    du = JSON.parse(text ?? '');
  } catch {
    throw new LoiApp(502, 'AI trả kết quả không đúng định dạng. Hãy thử lại.');
  }
  const kq = SchemaKetQua.safeParse(du);
  if (!kq.success) throw new LoiApp(502, 'AI trả kết quả thiếu thông tin. Hãy thử lại.');
  return kq.data;
}

// ---- Cấu hình: nhà cung cấp đang dùng + API key (lưu trong cai_dat trên máy, hoặc biến môi trường) ----

const KHOA_CHON = 'ai_nha_cung_cap';
const khoaLuu = (ma: MaNhaCungCap) => (ma === 'claude' ? 'bi_mat_anthropic_api_key' : 'bi_mat_gemini_api_key');

function docCaiDat(khoa: string): string | null {
  const r = layDb().prepare('SELECT gia_tri FROM cai_dat WHERE khoa = ?').get(khoa) as { gia_tri: string } | undefined;
  return r?.gia_tri || null;
}
function ghiCaiDat(khoa: string, giaTri: string | null) {
  if (giaTri) {
    layDb()
      .prepare('INSERT INTO cai_dat (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri')
      .run(khoa, giaTri);
  } else layDb().prepare('DELETE FROM cai_dat WHERE khoa = ?').run(khoa);
}

export function layKhoaApi(ma: MaNhaCungCap): { khoa: string | null; nguon: 'cai_dat' | 'moi_truong' | null } {
  const luu = docCaiDat(khoaLuu(ma));
  if (luu) return { khoa: luu, nguon: 'cai_dat' };
  const env = process.env[NHA_CUNG_CAP[ma].bien_moi_truong];
  if (env) return { khoa: env, nguon: 'moi_truong' };
  return { khoa: null, nguon: null };
}

export function nhaCungCapDangDung(): MaNhaCungCap {
  return docCaiDat(KHOA_CHON) === 'claude' ? 'claude' : 'gemini';
}

// Chỉ hiện vài ký tự đầu/cuối, không bao giờ trả key đầy đủ ra giao diện
export function trangThaiKhoa() {
  const dangDung = nhaCungCapDangDung();
  const moTa = (ma: MaNhaCungCap) => {
    const { khoa, nguon } = layKhoaApi(ma);
    const n = NHA_CUNG_CAP[ma];
    return {
      ma,
      ten: n.ten,
      mo_hinh: n.mo_hinh,
      mien_phi: n.mien_phi,
      co_khoa: !!khoa,
      nguon,
      khoa_an: khoa ? `${khoa.slice(0, 5)}…${khoa.slice(-4)}` : null,
    };
  };
  const ds = (['gemini', 'claude'] as const).map(moTa);
  const hienTai = ds.find((d) => d.ma === dangDung)!;
  return { dang_dung: dangDung, co_khoa: hienTai.co_khoa, mo_hinh: hienTai.mo_hinh, ten: hienTai.ten, nha_cung_cap: ds };
}

// Lưu key (gọi thử trước, chỉ lưu key dùng được) và chọn nhà cung cấp đang dùng
export async function capNhatAi(ma: MaNhaCungCap, khoa: string | null | undefined) {
  if (khoa) {
    try {
      await NHA_CUNG_CAP[ma].kiemTra(khoa);
    } catch (e) {
      throw loiAi(e, ma);
    }
    ghiCaiDat(khoaLuu(ma), khoa);
  } else if (khoa === null) ghiCaiDat(khoaLuu(ma), null);
  ghiCaiDat(KHOA_CHON, ma);
  return trangThaiKhoa();
}

// ---- Soạn câu hỏi ----

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
  const ma = nhaCungCapDangDung();
  const { khoa } = layKhoaApi(ma);
  if (!khoa) throw new LoiApp(400, `Chưa có API key của ${NHA_CUNG_CAP[ma].ten}. Vào Cài đặt → "AI soạn câu hỏi" để nhập key.`);
  let kq: KetQuaAi;
  try {
    kq = await NHA_CUNG_CAP[ma].soan(khoa, HE_THONG, moTaYeuCau(mon, y, cauDaCo));
  } catch (e) {
    throw loiAi(e, ma);
  }
  return kq.cau_hoi
    .filter((c) => c.noi_dung.trim())
    .map((c) => ({
      chu_de: c.chu_de.trim() || y.chu_de,
      muc_do: c.muc_do,
      diem: c.diem > 0 ? c.diem : y.diem[0],
      noi_dung: c.noi_dung.trim(),
      dap_an: c.dap_an.trim(),
    }));
}

// ---- Lỗi gọi AI → thông báo tiếng Việt ----

function loiAi(e: unknown, ma: MaNhaCungCap): LoiApp {
  if (e instanceof LoiApp) return e;
  const ten = NHA_CUNG_CAP[ma].ten;
  if (e instanceof LoiGemini) {
    const m = e.message.toLowerCase();
    if (m.includes('api key') || m.includes('api_key') || e.status === 401) return new LoiApp(400, 'API key Gemini không đúng hoặc đã bị xóa');
    if (e.status === 403) return new LoiApp(400, 'API key Gemini không có quyền dùng Gemini API (kiểm tra dự án trong Google AI Studio)');
    if (e.status === 429)
      return new LoiApp(429, 'Đã hết lượt dùng miễn phí của Gemini trong lúc này. Chờ một lát (hoặc sang ngày mai) rồi thử lại.');
    if (e.status === 404) return new LoiApp(502, `Mô hình ${NHA_CUNG_CAP.gemini.mo_hinh} không dùng được với key này`);
    if (e.status >= 500) return new LoiApp(502, `Gemini đang lỗi (${e.status}), thử lại sau`);
    return new LoiApp(400, `Gemini báo lỗi: ${e.message}`);
  }
  if (e instanceof Anthropic.AuthenticationError) return new LoiApp(400, 'API key Claude không đúng hoặc đã bị thu hồi');
  if (e instanceof Anthropic.PermissionDeniedError) return new LoiApp(400, 'API key Claude không có quyền dùng mô hình này');
  if (e instanceof Anthropic.RateLimitError) return new LoiApp(429, 'Gọi AI quá nhiều trong thời gian ngắn, chờ một lát rồi thử lại');
  if (e instanceof Anthropic.BadRequestError) {
    const m = e.message.toLowerCase();
    if (m.includes('credit') || m.includes('billing')) return new LoiApp(402, 'Tài khoản Claude API đã hết tiền. Hãy nạp thêm tại console.anthropic.com');
    return new LoiApp(400, `Yêu cầu gửi AI không hợp lệ: ${e.message}`);
  }
  if (e instanceof Anthropic.APIConnectionError) return new LoiApp(503, 'Không kết nối được tới AI. Kiểm tra mạng Internet rồi thử lại.');
  if (e instanceof Anthropic.APIError) return new LoiApp(502, `AI đang lỗi (${e.status ?? '?'}), thử lại sau`);
  // Lỗi mạng của fetch (Gemini SDK)
  if (e instanceof TypeError && /fetch|network|ENOTFOUND|ECONN/i.test(`${e.message} ${(e as { cause?: Error }).cause?.message ?? ''}`))
    return new LoiApp(503, 'Không kết nối được tới AI. Kiểm tra mạng Internet rồi thử lại.');
  return new LoiApp(500, `Lỗi khi gọi ${ten}: ${(e as Error).message}`);
}
