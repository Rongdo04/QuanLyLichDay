import dayjs from 'dayjs';
import { z } from 'zod';

// Nhãn tiếng Việt cho tên trường dữ liệu, dùng trong thông báo lỗi
const NHAN: Record<string, string> = {
  ma: 'Mã',
  ten: 'Tên',
  ghi_chu: 'Ghi chú',
  da_an: 'Ẩn',
  ten_ngan: 'Tên ngắn',
  ten_day_du: 'Tên đầy đủ',
  tien_dc: 'Tiền DC',
  truong_id: 'Trường',
  dia_diem_id: 'Địa điểm',
  ten_sheet: 'Tên sheet',
  ma_lop: 'Mã lớp',
  lop_van_hoa: 'Lớp văn hóa',
  hoc_phan: 'Học phần',
  so_buoi_ke_hoach: 'Số buổi kế hoạch',
  don_gia: 'Đơn giá',
  lich_phan_cong: 'Lịch phân công',
  ngay_bat_dau: 'Ngày bắt đầu',
  ngay_ket_thuc: 'Ngày kết thúc',
  trang_thai: 'Trạng thái',
  thu_tu: 'Thứ tự',
  lop_id: 'Lớp',
  ngay: 'Ngày',
  sang: 'Sáng',
  chieu: 'Chiều',
  co_tien_dc: 'Có tiền DC',
  du_kien: 'Dự kiến',
  batDau: 'Ngày bắt đầu',
  ketThuc: 'Ngày kết thúc',
  soBuoi: 'Số buổi',
  thu: 'Thứ trong tuần',
  tu: 'Từ ngày',
  den: 'Đến ngày',
  id: 'Mã số',
};

function nhanCua(path: (string | number)[]): string {
  const ten = [...path].reverse().find((p) => typeof p === 'string') as string | undefined;
  if (!ten) return 'Dữ liệu';
  return NHAN[ten] ?? ten;
}

// Lỗi nằm trong mảng → thêm tiền tố "Sheet 2: ", "Ngày nghỉ 1: "…
const NHAN_MANG: Record<string, string> = { sheets: 'Sheet', ngay_nghi: 'Ngày nghỉ', buoi: 'Dòng', ngay: 'Ngày' };
function tienTo(path: (string | number)[]): string {
  const i = path.findIndex((p) => typeof p === 'number');
  if (i <= 0) return '';
  const cha = path[i - 1] as string;
  return `${NHAN_MANG[cha] ?? cha} ${(path[i] as number) + 1}: `;
}

const baoLoiTiengViet: z.ZodErrorMap = (issue, ctx) => {
  const { message } = baoLoiGoc(issue, ctx);
  return { message: tienTo(issue.path) + message };
};

const baoLoiGoc: z.ZodErrorMap = (issue, ctx) => {
  const nhan = nhanCua(issue.path);
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: `Thiếu ${nhan}` };
      return { message: `${nhan} sai kiểu dữ liệu (cần ${issue.expected === 'number' ? 'số' : issue.expected === 'string' ? 'chuỗi' : issue.expected})` };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: `${nhan} không được để trống` };
      if (issue.type === 'array') return { message: `${nhan} cần ít nhất ${issue.minimum} phần tử` };
      return { message: `${nhan} phải lớn hơn hoặc bằng ${issue.minimum}` };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `${nhan} tối đa ${issue.maximum} ký tự` };
      return { message: `${nhan} phải nhỏ hơn hoặc bằng ${issue.maximum}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `${nhan} phải là một trong: ${issue.options.join(', ')}` };
    case z.ZodIssueCode.invalid_string:
      return { message: `${nhan} không hợp lệ` };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Không nhận trường: ${issue.keys.join(', ')}` };
    default:
      return { message: issue.message ?? ctx.defaultError };
  }
};

z.setErrorMap(baoLoiTiengViet);

// Ngày dạng YYYY-MM-DD và có thật
export const zNgay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .refine((s) => dayjs(s).format('YYYY-MM-DD') === s, 'Ngày không tồn tại');

// Nhận true/false hoặc 0/1, lưu thành 0/1
export const zCo = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0));

// Chuỗi tùy chọn: chuỗi rỗng → null
export const zChuoiTuyChon = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

export const zId = z.coerce.number({ invalid_type_error: 'Mã số không hợp lệ' }).int().positive('Mã số không hợp lệ');

export const zIdThamSo = z.object({ id: zId });

// Tham số query: chuỗi rỗng coi như không có
const boRong = (v: unknown) => (v === '' ? undefined : v);
export const zQueryId = z.preprocess(boRong, zId.optional());
export const zQueryNgay = z.preprocess(boRong, zNgay.optional());

export const zTrangThai = z.enum(['dang_day', 'hoan_thanh', 'tam_dung']);

// Tên sheet Excel: ≤ 31 ký tự, không chứa : \ / ? * [ ]
export const zTenSheet = z
  .string()
  .trim()
  .min(1)
  .max(31)
  .refine((s) => !/[:\\/?*[\]]/.test(s), 'Tên sheet không được chứa các ký tự : \\ / ? * [ ]');

export { z };
