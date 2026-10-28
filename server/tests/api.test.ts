import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { taoApp } from '../src/app.js';
import { datDb, moDb } from '../src/db/connection.js';

const app = taoApp({ boQuaDangNhap: true });
const api = () => request(app);

// Lớp mẫu: AutoCad_TT ở trường HN (id 4), địa điểm Thạch Thất (id 1)
const lopMau = {
  truong_id: 4,
  dia_diem_id: 1,
  ten_sheet: 'AutoCad_TT',
  ma_lop: 'CT.10T1',
  lop_van_hoa: '11A6',
  hoc_phan: 'Vẽ kỹ thuật và Autocad',
  so_buoi_ke_hoach: 15,
  don_gia: 400,
};

beforeEach(() => {
  datDb(moDb(':memory:'));
});

describe('API trường', () => {
  it('danh sách có 4 trường seed', async () => {
    const r = await api().get('/api/truong').expect(200);
    expect(r.body.map((t: { ma: string }) => t.ma)).toEqual(['GTCT', 'GTVT', 'DANGANH', 'HN']);
  });

  it('tạo, sửa, xóa', async () => {
    const tao = await api().post('/api/truong').send({ ma: 'VH', ten: 'Việt-Hung' }).expect(201);
    expect(tao.body).toMatchObject({ ma: 'VH', da_an: 0 });
    const sua = await api().put(`/api/truong/${tao.body.id}`).send({ da_an: true }).expect(200);
    expect(sua.body.da_an).toBe(1);
    await api().delete(`/api/truong/${tao.body.id}`).expect(204);
  });

  it('báo lỗi tiếng Việt khi thiếu dữ liệu', async () => {
    const r = await api().post('/api/truong').send({ ma: '' }).expect(400);
    expect(r.body.loi).toContain('Mã không được để trống');
    expect(r.body.loi).toContain('Thiếu Tên');
  });

  it('trùng mã trường → 409', async () => {
    const r = await api().post('/api/truong').send({ ma: 'GTCT', ten: 'x' }).expect(409);
    expect(r.body.loi).toBe('Mã trường "GTCT" đã tồn tại');
  });

  it('chặn xóa trường còn lớp', async () => {
    await api().post('/api/lop').send(lopMau).expect(201);
    const r = await api().delete('/api/truong/4').expect(409);
    expect(r.body.loi).toContain('Hãy ẩn trường');
  });

  it('404 khi không có trường', async () => {
    const r = await api().put('/api/truong/999').send({ ten: 'x' }).expect(404);
    expect(r.body.loi).toBe('Không tìm thấy trường');
  });
});

describe('API địa điểm', () => {
  it('sửa tiền DC và chặn xóa khi đang dùng', async () => {
    const r = await api().put('/api/dia-diem/3').send({ tien_dc: 50 }).expect(200);
    expect(r.body).toMatchObject({ ten_ngan: 'Xuân Mai', tien_dc: 50 });
    await api().post('/api/lop').send(lopMau).expect(201);
    await api().delete('/api/dia-diem/1').expect(409);
    await api().delete('/api/dia-diem/2').expect(204);
  });

  it('tiền DC âm bị từ chối', async () => {
    const r = await api().post('/api/dia-diem').send({ ten_ngan: 'A', tien_dc: -1 }).expect(400);
    expect(r.body.loi).toBe('Tiền DC phải lớn hơn hoặc bằng 0');
  });
});

describe('API lớp + buổi', () => {
  it('validate tên sheet', async () => {
    const r1 = await api().post('/api/lop').send({ ...lopMau, ten_sheet: 'A/B' }).expect(400);
    expect(r1.body.loi).toContain('không được chứa');
    const r2 = await api().post('/api/lop').send({ ...lopMau, ten_sheet: 'x'.repeat(32) }).expect(400);
    expect(r2.body.loi).toBe('Tên sheet tối đa 31 ký tự');
    await api().post('/api/lop').send(lopMau).expect(201);
    const r3 = await api().post('/api/lop').send({ ...lopMau, ten_sheet: 'autocad_tt' }).expect(409);
    expect(r3.body.loi).toContain('đã có lớp với tên sheet');
  });

  it('sinh lịch, chấm buổi và tính tiền (ví dụ AutoCad)', async () => {
    const { body: lop } = await api().post('/api/lop').send(lopMau).expect(201);
    expect(lop.thu_tu).toBe(1);

    const xem = await api()
      .post(`/api/lop/${lop.id}/sinh-lich/xem-truoc`)
      .send({ batDau: '2026-09-23', soBuoi: 15, thu: { '4': 'C', '7': 'SC' } })
      .expect(200);
    expect(xem.body.soNgay).toBe(10);
    expect(xem.body.tongBuoi).toBe(15);

    const tao = await api().post(`/api/lop/${lop.id}/sinh-lich`).send({ ngay: xem.body.ngay }).expect(201);
    expect(tao.body).toEqual({ soMoi: 10, boQua: 0 });
    // tạo lại không bị trùng
    const lai = await api().post(`/api/lop/${lop.id}/sinh-lich`).send({ ngay: xem.body.ngay }).expect(201);
    expect(lai.body).toEqual({ soMoi: 0, boQua: 10 });

    const { body: ct } = await api().get(`/api/lop/${lop.id}`).expect(200);
    expect(ct.buoi).toHaveLength(10);
    expect(ct.ngay_bat_dau).toBe('2026-09-23');
    expect(ct.ngay_ket_thuc).toBe('2026-10-24');
    expect(ct.tienDay).toBe(0);

    // chấm theo dự kiến
    for (const b of ct.buoi) {
      await api()
        .patch(`/api/buoi/${b.id}`)
        .send({ sang: b.du_kien === 'SC', chieu: true })
        .expect(200);
    }
    const { body: sau } = await api().get(`/api/lop/${lop.id}`).expect(200);
    expect(sau).toMatchObject({ soBuoi: 15, tienDay: 6000, tienDc: 660, tong: 6660, tienDo: 1 });

    const { body: ds } = await api().get('/api/lop?truongId=4').expect(200);
    expect(ds[0]).toMatchObject({ ten_sheet: 'AutoCad_TT', tong: 6660, soNgay: 10, truong_ma: 'HN' });
    expect((await api().get('/api/lop?trangThai=hoan_thanh').expect(200)).body).toHaveLength(0);
  });

  it('sinh lịch Thanh Trì: T5+T6 29/10 → 04/12/2026 ra 12 ngày', async () => {
    const { body: lop } = await api()
      .post('/api/lop')
      .send({ ...lopMau, truong_id: 3, dia_diem_id: null, ten_sheet: 'Mạng Máy tính_Thanh Trì', hoc_phan: 'Mạng máy tính', don_gia: 450 })
      .expect(201);
    const r = await api()
      .post(`/api/lop/${lop.id}/sinh-lich/xem-truoc`)
      .send({ batDau: '2026-10-29', ketThuc: '2026-12-04', thu: { '5': 'S', '6': 'S' } })
      .expect(200);
    expect(r.body.soNgay).toBe(12);
  });

  it('sinh lịch bỏ qua ngày nghỉ trong cài đặt', async () => {
    const { body: lop } = await api().post('/api/lop').send(lopMau).expect(201);
    await api()
      .put('/api/cai-dat')
      .send({ ngay_nghi: [{ tu: '2026-11-19', den: '2026-11-20', ten: 'Nghỉ 20/11' }] })
      .expect(200);
    const ts = { batDau: '2026-10-29', ketThuc: '2026-12-04', thu: { '5': 'S', '6': 'S' } };
    const r = await api().post(`/api/lop/${lop.id}/sinh-lich/xem-truoc`).send(ts).expect(200);
    expect(r.body.soNgay).toBe(10);
    const r2 = await api()
      .post(`/api/lop/${lop.id}/sinh-lich/xem-truoc`)
      .send({ ...ts, boQuaNgayNghi: false })
      .expect(200);
    expect(r2.body.soNgay).toBe(12);
  });

  it('sinh lịch thiếu tham số → lỗi tiếng Việt', async () => {
    const { body: lop } = await api().post('/api/lop').send(lopMau).expect(201);
    const r = await api()
      .post(`/api/lop/${lop.id}/sinh-lich/xem-truoc`)
      .send({ batDau: '2026-10-29', thu: { '5': 'S' } })
      .expect(400);
    expect(r.body.loi).toBe('Cần nhập ngày kết thúc hoặc số buổi');
  });

  it('thêm ngày lẻ, trùng ngày, sửa, xóa', async () => {
    const { body: lop } = await api().post('/api/lop').send(lopMau).expect(201);
    const { body: b } = await api()
      .post('/api/buoi')
      .send({ lop_id: lop.id, ngay: '2026-10-25', sang: 1, ghi_chu: 'dạy bù' })
      .expect(201);
    expect(b).toMatchObject({ sang: 1, chieu: 0, co_tien_dc: 1, ghi_chu: 'dạy bù' });
    const trung = await api().post('/api/buoi').send({ lop_id: lop.id, ngay: '2026-10-25' }).expect(409);
    expect(trung.body.loi).toBe('Lớp đã có ngày 25/10/2026');
    const ngaySai = await api().post('/api/buoi').send({ lop_id: lop.id, ngay: '2026-02-30' }).expect(400);
    expect(ngaySai.body.loi).toBe('Ngày không tồn tại');
    await api().patch(`/api/buoi/${b.id}`).send({ co_tien_dc: false }).expect(200);
    const { body: ct } = await api().get(`/api/lop/${lop.id}`);
    expect(ct).toMatchObject({ tienDay: 400, tienDc: 0 });
    await api().delete(`/api/buoi/${b.id}`).expect(204);
    await api().delete(`/api/buoi/${b.id}`).expect(404);
  });

  it('lọc buổi theo khoảng ngày và trường', async () => {
    const { body: lop } = await api().post('/api/lop').send(lopMau).expect(201);
    for (const ngay of ['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01'])
      await api().post('/api/buoi').send({ lop_id: lop.id, ngay }).expect(201);
    const r = await api().get('/api/buoi?tu=2026-10-01&den=2026-10-31&truongId=4').expect(200);
    expect(r.body.map((b: { ngay: string }) => b.ngay)).toEqual(['2026-10-01', '2026-10-31']);
    expect(r.body[0]).toMatchObject({ ten_sheet: 'AutoCad_TT', truong_ma: 'HN', tien_dc_dia_diem: 66 });
    expect((await api().get('/api/buoi?truongId=1').expect(200)).body).toHaveLength(0);
  });

  it('nhân bản lớp không chép ngày dạy', async () => {
    const { body: lop } = await api().post('/api/lop').send(lopMau).expect(201);
    await api().post('/api/buoi').send({ lop_id: lop.id, ngay: '2026-10-01', sang: 1 }).expect(201);
    const { body: nb } = await api().post(`/api/lop/${lop.id}/nhan-ban`).send({ hoc_phan: 'Thiết kế Web' }).expect(201);
    expect(nb).toMatchObject({ ten_sheet: 'AutoCad_TT_2', hoc_phan: 'Thiết kế Web', ma_lop: 'CT.10T1', thu_tu: 2 });
    const { body: ct } = await api().get(`/api/lop/${nb.id}`);
    expect(ct.buoi).toHaveLength(0);
  });

  it('xóa lớp xóa luôn các ngày', async () => {
    const { body: lop } = await api().post('/api/lop').send(lopMau).expect(201);
    await api().post('/api/buoi').send({ lop_id: lop.id, ngay: '2026-10-01' }).expect(201);
    await api().delete(`/api/lop/${lop.id}`).expect(204);
    expect((await api().get('/api/buoi').expect(200)).body).toHaveLength(0);
  });
});

describe('API thống kê', () => {
  async function chuanBi() {
    const { body: hn } = await api().post('/api/lop').send(lopMau).expect(201);
    const { body: gt } = await api()
      .post('/api/lop')
      .send({ ...lopMau, truong_id: 2, dia_diem_id: null, ten_sheet: 'TinHọcVPNC', don_gia: 350 })
      .expect(201);
    await api().post('/api/buoi').send({ lop_id: hn.id, ngay: '2026-09-26', sang: 1, chieu: 1 });
    await api().post('/api/buoi').send({ lop_id: hn.id, ngay: '2026-10-03', chieu: 1 });
    await api().post('/api/buoi').send({ lop_id: hn.id, ngay: '2026-10-07' }); // chưa dạy
    await api().post('/api/buoi').send({ lop_id: gt.id, ngay: '2026-10-06', sang: 1, chieu: 1 });
  }

  it('tổng hợp theo trường và lớp trong kỳ', async () => {
    await chuanBi();
    const { body } = await api().get('/api/thong-ke?tu=2026-10-01&den=2026-10-31').expect(200);
    // Mọi trường thuế 10% trên tiền dạy: HN 400 → 40, GTVT 700 → 70 (không tính trên tiền DC)
    expect(body.tong).toEqual({ soBuoi: 3, tienDay: 400 + 700, tienDc: 66, tong: 1166, tienThue: 110, tongCoThue: 1276 });
    expect(body.truong.map((t: { ma: string }) => t.ma)).toEqual(['GTVT', 'HN']);
    const hn = body.truong.find((t: { ma: string }) => t.ma === 'HN');
    expect(hn.lop[0]).toMatchObject({ ten_sheet: 'AutoCad_TT', soNgay: 2, soBuoi: 1, tong: 466 });

    const loc = await api().get('/api/thong-ke?truongId=4').expect(200);
    expect(loc.body.tong).toEqual({ soBuoi: 3, tienDay: 1200, tienDc: 132, tong: 1332, tienThue: 120, tongCoThue: 1452 });
  });

  it('lớp đã thanh toán: tích trên lớp, cộng riêng trong thống kê', async () => {
    await chuanBi();
    const ds = (await api().get('/api/lop').expect(200)).body;
    const gt = ds.find((l: { ten_sheet: string }) => l.ten_sheet === 'TinHọcVPNC');
    expect(gt.da_thanh_toan).toBe(0);
    const s = await api().put(`/api/lop/${gt.id}`).send({ da_thanh_toan: true }).expect(200);
    expect(s.body.da_thanh_toan).toBe(1);

    const { body } = await api().get('/api/thong-ke?tu=2026-10-01&den=2026-10-31').expect(200);
    expect(body.daThanhToan).toEqual({ soBuoi: 2, tienDay: 700, tienDc: 0, tong: 700, tienThue: 70, tongCoThue: 770 });
    expect(body.truong.find((t: { ma: string }) => t.ma === 'HN').daThanhToan.tong).toBe(0);
    expect(body.truong.find((t: { ma: string }) => t.ma === 'GTVT').lop[0].da_thanh_toan).toBe(1);

    const nb = await api().post(`/api/lop/${gt.id}/nhan-ban`).send({}).expect(201);
    expect(nb.body.da_thanh_toan).toBe(0);
  });

  it('theo tháng × trường', async () => {
    await chuanBi();
    const { body } = await api().get('/api/thong-ke/thang').expect(200);
    expect(body.namHoc).toBe('2026-2027');
    expect(body.thang).toHaveLength(12);
    expect(body.thang[0]).toMatchObject({ nhan: '09/2026', tong: { tong: 866 } });
    expect(body.thang[1].theoTruong['2']).toEqual({ soBuoi: 2, tienDay: 700, tienDc: 0, tong: 700, tienThue: 70, tongCoThue: 770 });
    expect(body.thang[1].theoTruong['4']).toMatchObject({ tienThue: 40, tongCoThue: 506 });
    expect(body.thang[1].theoTruong['4'].tong).toBe(466);
    expect(body.tong.tong).toBe(866 + 700 + 466);
  });

  it('khoảng ngày ngược → lỗi', async () => {
    const r = await api().get('/api/thong-ke?tu=2026-10-31&den=2026-10-01').expect(400);
    expect(r.body.loi).toBe('"Từ ngày" phải trước "Đến ngày"');
  });
});

describe('API cài đặt', () => {
  it('đọc và ghi', async () => {
    const { body } = await api().get('/api/cai-dat').expect(200);
    expect(body).toMatchObject({ ten_gv: 'Đặng Mạnh Hiền', ma_gv: 'G366', ngay_nghi: [] });
    const r = await api().put('/api/cai-dat').send({ gio_sang: '07h00', nam_hoc: '2027' }).expect(400);
    expect(r.body.loi).toBe('Năm học phải có dạng 2026-2027');
    const ok = await api().put('/api/cai-dat').send({ gio_sang: '07h00' }).expect(200);
    expect(ok.body.gio_sang).toBe('07h00');
  });
});

describe('Lỗi chung', () => {
  it('JSON sai cú pháp và đường dẫn lạ', async () => {
    const r = await api().post('/api/truong').set('Content-Type', 'application/json').send('{sai').expect(400);
    expect(r.body.loi).toBe('Dữ liệu gửi lên không phải JSON hợp lệ');
    const r2 = await api().get('/api/khong-co').expect(404);
    expect(r2.body.loi).toBe('Không tìm thấy đường dẫn API');
    const r3 = await api().get('/api/lop/abc').expect(400);
    expect(r3.body.loi).toBe('Mã số không hợp lệ');
  });
});

describe('Tạo lớp kèm lịch dạy hằng tuần', () => {
  const lop = { truong_id: 3, ten_sheet: 'Mạng Máy tính_Thanh Trì', hoc_phan: 'Mạng máy tính', don_gia: 450 };

  it('chọn sáng T5 + T6 từ 29/10 đến 04/12/2026 → tự sinh đúng 12 ngày', async () => {
    const r = await api()
      .post('/api/lop')
      .send({ ...lop, ngay_bat_dau: '2026-10-29', ngay_ket_thuc: '2026-12-04', lich_tuan: { 5: 'S', 6: 'S' } })
      .expect(201);
    expect(r.body.so_ngay_sinh).toBe(12);
    expect(JSON.parse(r.body.lich_tuan)).toEqual({ 5: 'S', 6: 'S' });
    expect(r.body.lich_phan_cong).toBe('Sáng T5, T6. Bắt đầu từ sáng thứ 5 29/10/2026');
    const ct = (await api().get(`/api/lop/${r.body.id}`)).body;
    expect(ct.buoi).toHaveLength(12);
    expect(ct.buoi.every((b: { du_kien: string; sang: number }) => b.du_kien === 'S' && b.sang === 0)).toBe(true);
  });

  it('chỉ có số buổi kế hoạch: sinh đến khi đủ buổi (cả ngày tính 2 buổi), tự điền ngày kết thúc', async () => {
    const r = await api()
      .post('/api/lop')
      .send({ ...lop, ngay_bat_dau: '2026-10-28', so_buoi_ke_hoach: 18, lich_tuan: { 4: 'C', 7: 'SC' } })
      .expect(201);
    // Mỗi tuần 3 buổi (chiều T4 + cả ngày T7) → 6 tuần = 12 ngày
    expect(r.body.so_ngay_sinh).toBe(12);
    expect(r.body.ngay_ket_thuc).toBe('2026-12-05');
    expect(r.body.lich_phan_cong).toBe('Chiều T4 và cả ngày T7. Bắt đầu từ chiều thứ 4 28/10/2026');
  });

  it('bỏ qua ngày nghỉ lễ trong Cài đặt', async () => {
    await api().put('/api/cai-dat').send({ ngay_nghi: [{ tu: '2026-11-20', ten: 'Nhà giáo VN' }] }).expect(200);
    const r = await api()
      .post('/api/lop')
      .send({ ...lop, ngay_bat_dau: '2026-10-29', ngay_ket_thuc: '2026-12-04', lich_tuan: { 5: 'S', 6: 'S' } })
      .expect(201);
    expect(r.body.so_ngay_sinh).toBe(11);
    expect(r.body.ngay_bo_qua[0]).toMatchObject({ ngay: '2026-11-20' });
  });

  it('thiếu ngày bắt đầu hoặc mốc kết thúc thì báo lỗi, không tạo lớp', async () => {
    let r = await api().post('/api/lop').send({ ...lop, lich_tuan: { 5: 'S' } }).expect(400);
    expect(r.body.loi).toContain('ngày bắt đầu');
    r = await api().post('/api/lop').send({ ...lop, ngay_bat_dau: '2026-10-29', lich_tuan: { 5: 'S' } }).expect(400);
    expect(r.body.loi).toContain('ngày kết thúc hoặc số buổi');
    expect((await api().get('/api/lop')).body).toHaveLength(0);
  });

  it('không chọn thứ nào thì tạo lớp như cũ; sửa lớp lưu được lịch tuần; nhân bản giữ lịch tuần', async () => {
    const r = await api().post('/api/lop').send(lop).expect(201);
    expect(r.body).toMatchObject({ so_ngay_sinh: 0, lich_tuan: null });
    const s = await api().put(`/api/lop/${r.body.id}`).send({ lich_tuan: { 2: 'SC' } }).expect(200);
    expect(s.body.lich_tuan).toBe('{"2":"SC"}');
    const nb = await api().post(`/api/lop/${r.body.id}/nhan-ban`).send({}).expect(201);
    expect(nb.body.lich_tuan).toBe('{"2":"SC"}');
    expect((await api().put(`/api/lop/${r.body.id}`).send({ lich_tuan: {} }).expect(200)).body.lich_tuan).toBeNull();
  });

  it('sửa lịch tuần có dong_bo_lich: đổi các ngày đã có, giữ ngày đã chấm và ngày kết thúc', async () => {
    const r = await api()
      .post('/api/lop')
      .send({ ...lop, ngay_bat_dau: '2026-10-28', ngay_ket_thuc: '2026-12-05', lich_tuan: { 4: 'C', 7: 'SC' } })
      .expect(201);
    const id = r.body.id;
    const cu = (await api().get(`/api/lop/${id}`)).body.buoi as { id: number; ngay: string }[];
    // Đã chấm chiều T7 31/10 → phải giữ
    const t7 = cu.find((b) => b.ngay === '2026-10-31')!;
    await api().patch(`/api/buoi/${t7.id}`).send({ chieu: 1 }).expect(200);

    const s = await api()
      .put(`/api/lop/${id}`)
      .send({ lich_tuan: { 2: 'C', 4: 'C' }, lich_phan_cong: r.body.lich_phan_cong, dong_bo_lich: true })
      .expect(200);
    expect(s.body.doi_lich).toMatchObject({ them: 5, xoa: 4, doi_du_kien: 0, giu_da_cham: 1 });
    expect(s.body.lich_phan_cong).toBe('Chiều T2, T4. Bắt đầu từ chiều thứ 4 28/10/2026');
    const moi = (await api().get(`/api/lop/${id}`)).body.buoi as { ngay: string; du_kien: string }[];
    expect(moi.map((b) => b.ngay)).toEqual([
      '2026-10-28', '2026-10-31', '2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16',
      '2026-11-18', '2026-11-23', '2026-11-25', '2026-11-30', '2026-12-02', '2026-12-05',
    ]);
    // Ngày kết thúc là buổi cuối: giữ, kể cả không đúng thứ trong lịch tuần mới
    expect(moi.at(-1)!.du_kien).toBe('SC');
    expect(s.body.ngay_ket_thuc).toBe('2026-12-05');
    expect(moi.find((b) => b.ngay === '2026-11-02')!.du_kien).toBe('C');

    // Không gửi dong_bo_lich thì không đụng các ngày
    await api().put(`/api/lop/${id}`).send({ lich_tuan: { 6: 'S' } }).expect(200);
    expect((await api().get(`/api/lop/${id}`)).body.buoi).toHaveLength(13);
  });

  it('đổi lịch không đủ số buổi kế hoạch: báo thiếu, hoặc kéo dài đến khi đủ', async () => {
    const r = await api()
      .post('/api/lop')
      .send({ ...lop, so_buoi_ke_hoach: 18, ngay_bat_dau: '2026-10-28', ngay_ket_thuc: '2026-12-05', lich_tuan: { 4: 'C', 7: 'SC' } })
      .expect(201);
    const id = r.body.id;
    const doi = { lich_tuan: { 2: 'C', 4: 'C' }, dong_bo_lich: true };

    // Giữ ngày kết thúc: 11 chiều T2/T4 + cả ngày 05/12 = 13 buổi, thiếu 5
    const giu = await api().put(`/api/lop/${id}`).send(doi).expect(200);
    expect(giu.body.doi_lich).toMatchObject({ tong_buoi: 13, thieu: 5 });
    expect(giu.body.ngay_ket_thuc).toBe('2026-12-05');

    // Kéo dài: đủ 18 chiều T2/T4, buổi cuối 28/12
    const keo = await api().put(`/api/lop/${id}`).send({ ...doi, keo_dai_lich: true }).expect(200);
    expect(keo.body.doi_lich).toMatchObject({ tong_buoi: 18, thieu: 0 });
    expect(keo.body.ngay_ket_thuc).toBe('2026-12-28');
    const ds = (await api().get(`/api/lop/${id}`)).body.buoi as { ngay: string }[];
    expect(ds).toHaveLength(18);
    expect(ds.at(-1)!.ngay).toBe('2026-12-28');
  });
});
