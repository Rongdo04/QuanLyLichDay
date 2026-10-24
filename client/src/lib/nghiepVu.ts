// Dùng chung quy tắc nghiệp vụ với server (một nguồn duy nhất, không chép lại):
// tính tiền, thứ trong tuần, đọc/viết lịch phân công.
export { tinhLop, tienDcNgay, soBuoiTrongNgay, congKetQua } from '../../../server/src/services/tinhTien';
export { thuCuaNgay } from '../../../server/src/utils/thu';
export {
  moTaThu,
  phanTichLichPhanCong,
  taoLichPhanCong,
  type LichTheoThu,
} from '../../../server/src/utils/lichPhanCong';
