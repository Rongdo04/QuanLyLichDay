import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Người dùng mới có thư mục dữ liệu riêng trong DATA_DIR → dùng thư mục tạm (đặt trước khi import mã nguồn)
const thuMucTam = vi.hoisted(() => {
  const os = process.getBuiltinModule('node:os') as typeof import('node:os');
  const fsm = process.getBuiltinModule('node:fs') as typeof import('node:fs');
  const pathm = process.getBuiltinModule('node:path') as typeof import('node:path');
  const d = fsm.mkdtempSync(pathm.join(os.tmpdir(), 'tai-khoan-test-'));
  process.env.DATA_DIR = d;
  return d;
});

import { taoApp } from '../src/app.js';
import { batBuocKhongGian, datDb, moDb } from '../src/db/connection.js';
import { bamMatKhau, datDbHeThong, dungMatKhau, taoNguoiDung } from '../src/services/taiKhoan.js';

// Như khi chạy thật: mọi truy cập dữ liệu phải nằm trong không gian của một người dùng
batBuocKhongGian();
const app = taoApp();

const lopMau = {
  truong_id: 4,
  ten_sheet: 'AutoCad_TT',
  hoc_phan: 'Vẽ kỹ thuật và Autocad',
  don_gia: 400,
};

// Tạo quản trị (nhận DB mặc định) + một người bạn, trả về hai phiên đăng nhập
async function chuanBi() {
  // Không có đăng ký qua web: quản trị đầu tiên tạo như lệnh "npm run tai-khoan -- tao"
  taoNguoiDung({ ten_dang_nhap: 'hien', ho_ten: 'Đặng Mạnh Hiền', email: 'hien@example.com', mat_khau: 'matkhau1', la_quan_tri: true });
  const qt = request.agent(app);
  await qt.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'hien', mat_khau: 'matkhau1' }).expect(200);
  await qt
    .post('/api/tai-khoan/nguoi-dung')
    .send({ ten_dang_nhap: 'Lan', ho_ten: 'Nguyễn Thị Lan', mat_khau: 'matkhau2' })
    .expect(201);
  const ban = request.agent(app);
  await ban.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(200);
  return { qt, ban };
}

beforeEach(() => {
  datDb(moDb(':memory:'));
  datDbHeThong(':memory:');
});

afterAll(() => {
  datDbHeThong(':memory:'); // đóng các DB của người dùng trước khi xóa thư mục
  fs.rmSync(thuMucTam, { recursive: true, force: true });
});

describe('mật khẩu', () => {
  it('băm có muối, kiểm tra đúng / sai', () => {
    const a = bamMatKhau('bimat123');
    expect(a).not.toContain('bimat123');
    expect(a).not.toBe(bamMatKhau('bimat123'));
    expect(dungMatKhau('bimat123', a)).toBe(true);
    expect(dungMatKhau('bimat124', a)).toBe(false);
    expect(dungMatKhau('x', 'hỏng')).toBe(false);
  });
});

describe('đăng nhập', () => {
  it('chưa đăng nhập: dữ liệu bị chặn; không có đăng ký qua web, kể cả khi chưa có tài khoản nào', async () => {
    const { body } = await request(app).get('/api/tai-khoan/toi').expect(200);
    expect(body).toEqual({ nguoi_dung: null });
    await request(app).get('/api/lop').expect(401);
    await request(app).get('/api/suc-khoe').expect(200);
    await request(app).post('/api/tai-khoan/khoi-tao').send({ ten_dang_nhap: 'nguoi.la', ho_ten: 'X', mat_khau: 'matkhau1' }).expect(401);
    await request(app).post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'nguoi.la', ho_ten: 'X', mat_khau: 'matkhau1' }).expect(401);
  });

  it('đăng nhập: cookie phiên HttpOnly', async () => {
    taoNguoiDung({ ten_dang_nhap: 'hien', ho_ten: 'Hiền', mat_khau: 'matkhau1' });
    const r = await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'hien', mat_khau: 'matkhau1' }).expect(200);
    expect(r.body.nguoi_dung).toMatchObject({ ten_dang_nhap: 'hien', la_quan_tri: 1, email: null });
    expect(r.headers['set-cookie'][0]).toMatch(/^phien=.+HttpOnly; SameSite=Lax/);
  });

  it('đăng nhập bằng email (không phân biệt hoa thường); email trùng / sai bị từ chối', async () => {
    const { qt } = await chuanBi();
    const r = await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'HIEN@example.com', mat_khau: 'matkhau1' }).expect(200);
    expect(r.body.nguoi_dung).toMatchObject({ ten_dang_nhap: 'hien', email: 'hien@example.com' });
    await qt.post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'khac', ho_ten: 'K', email: 'hien@example.com', mat_khau: '123456' }).expect(409);
    await qt.post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'khac', ho_ten: 'K', email: 'khong-phai-email', mat_khau: '123456' }).expect(400);
  });

  it('quản trị nhận dữ liệu đang có; không lộ mật khẩu ra API', async () => {
    const { qt } = await chuanBi();
    const toi = await qt.get('/api/tai-khoan/toi').expect(200);
    expect(toi.body.nguoi_dung.ho_ten).toBe('Đặng Mạnh Hiền');
    const ds = await qt.get('/api/tai-khoan/nguoi-dung').expect(200);
    expect(ds.body.map((n: { ten_dang_nhap: string }) => n.ten_dang_nhap)).toEqual(['hien', 'lan']);
    expect(JSON.stringify([toi.body, ds.body])).not.toMatch(/scrypt|mat_khau|thu_muc/);
  });

  it('sai mật khẩu, tài khoản không tồn tại → cùng một thông báo; sai nhiều lần thì chặn tạm', async () => {
    await chuanBi();
    const sai = await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'sai' }).expect(401);
    const khongCo = await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'ai', mat_khau: 'sai' }).expect(401);
    expect(sai.body.loi).toBe(khongCo.body.loi);
    for (let i = 0; i < 4; i++)
      await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'sai' }).expect(401);
    // Đã sai 5 lần: kể cả đúng mật khẩu cũng phải chờ
    await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(429);
  });

  it('khóa tăng dần: sai 5 lần chờ 5 phút, sai 10 lần chờ 30 phút; xóa cookie không giúp gì', async () => {
    await chuanBi();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const sai = () => request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'sai' });
      for (let i = 1; i <= 4; i++) expect((await sai().expect(401)).body.loi).toContain(`Còn ${5 - i} lần thử`);
      expect((await sai().expect(401)).body.loi).toContain('chờ 5 phút');
      // Mỗi request là một trình duyệt "mới" không cookie: vẫn bị chặn vì server đếm theo tên + IP
      await sai().expect(429);
      for (let i = 6; i <= 10; i++) {
        vi.advanceTimersByTime(5 * 60_000 + 1000);
        await sai().expect(401);
      }
      vi.advanceTimersByTime(5 * 60_000 + 1000);
      expect((await sai().expect(429)).body.loi).toMatch(/2[0-9] phút/); // còn ~25 phút của mức 30 phút
      vi.advanceTimersByTime(25 * 60_000);
      await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('nhiều IP cùng đoán một tài khoản (botnet) cũng bị chặn', async () => {
    await chuanBi();
    const tu = (ip: string, mk: string) =>
      request(app).post('/api/tai-khoan/dang-nhap').set('X-Forwarded-For', ip).send({ ten_dang_nhap: 'lan', mat_khau: mk });
    for (let i = 0; i < 20; i++) await tu(`198.51.100.${i}`, 'sai').expect(401);
    await tu('198.51.100.200', 'matkhau2').expect(429);
    // Người khác cùng mạng nhưng tài khoản khác vẫn vào được
    await request(app)
      .post('/api/tai-khoan/dang-nhap')
      .set('X-Forwarded-For', '198.51.100.200')
      .send({ ten_dang_nhap: 'hien', mat_khau: 'matkhau1' })
      .expect(200);
  });

  it('đăng xuất thì phiên hết dùng được', async () => {
    const { ban } = await chuanBi();
    await ban.get('/api/lop').expect(200);
    await ban.post('/api/tai-khoan/dang-xuat').expect(204);
    await ban.get('/api/lop').expect(401);
  });
});

describe('siêu quản trị (.env)', () => {
  beforeEach(() => {
    process.env.SIEU_QUAN_TRI_TEN = 'Admin';
    process.env.SIEU_QUAN_TRI_MAT_KHAU = 'mat-khau-sieu-123';
    // DB của siêu quản trị là file thật trong DATA_DIR tạm (đã đóng ở beforeEach chung): xóa để mỗi test bắt đầu trống
    fs.rmSync(path.join(thuMucTam, 'sieu-quan-tri'), { recursive: true, force: true });
  });
  afterEach(() => {
    delete process.env.SIEU_QUAN_TRI_TEN;
    delete process.env.SIEU_QUAN_TRI_MAT_KHAU;
  });

  const vaoSieu = async () => {
    const s = request.agent(app);
    await s.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'admin', mat_khau: 'mat-khau-sieu-123' }).expect(200);
    return s;
  };

  it('đăng nhập được, quản lý tài khoản; người mới có dữ liệu riêng', async () => {
    const s = await vaoSieu();
    expect((await s.get('/api/tai-khoan/toi')).body.nguoi_dung).toMatchObject({ ten_dang_nhap: 'admin', la_quan_tri: 1 });
    await s.post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'lan', ho_ten: 'Lan', mat_khau: 'matkhau2' }).expect(201);
    await s.post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'admin', ho_ten: 'Giả', mat_khau: 'matkhau2' }).expect(409);
    const truong = (await s.post('/api/truong').send({ ma: 'SQT', ten: 'Trường của siêu quản trị' }).expect(201)).body;
    await s.post('/api/lop').send({ ...lopMau, truong_id: truong.id }).expect(201);
    const lan = request.agent(app);
    await lan.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(200);
    expect((await lan.get('/api/lop')).body).toHaveLength(0);
    await s.put('/api/tai-khoan/mat-khau').send({ mat_khau_cu: 'mat-khau-sieu-123', mat_khau_moi: 'abcdef' }).expect(400);
  });

  it('dữ liệu riêng, không dùng chung với tài khoản đầu tiên (người giữ data/giangday.db)', async () => {
    const { qt } = await chuanBi(); // hien: tài khoản đầu tiên trong DB
    await qt.post('/api/lop').send(lopMau).expect(201);
    const s = await vaoSieu();
    expect((await s.get('/api/lop')).body).toHaveLength(0);
    expect((await s.get('/api/truong')).body).toHaveLength(0);
    const truong = (await s.post('/api/truong').send({ ma: 'SQT', ten: 'Trường của siêu quản trị' }).expect(201)).body;
    await s.post('/api/lop').send({ ...lopMau, truong_id: truong.id, ten_sheet: 'Cua_sieu' }).expect(201);
    await s.post('/api/lop').send({ ...lopMau, truong_id: truong.id, ten_sheet: 'Cua_sieu_2' }).expect(201);
    expect((await qt.get('/api/truong')).body.map((t: { ma: string }) => t.ma)).not.toContain('SQT');
    expect((await qt.get('/api/lop')).body).toHaveLength(1);
    expect((await s.get('/api/lop')).body).toHaveLength(2);
    expect((await s.get('/api/cai-dat')).body.ten_gv).toBe('Siêu quản trị');
  });

  it('mật khẩu dạng băm; đổi mật khẩu trong .env thì phiên cũ hết hiệu lực', async () => {
    process.env.SIEU_QUAN_TRI_MAT_KHAU = bamMatKhau('mat-khau-sieu-123');
    const s = await vaoSieu();
    await s.get('/api/lop').expect(200);
    process.env.SIEU_QUAN_TRI_MAT_KHAU = 'mat-khau-moi-456';
    await s.get('/api/lop').expect(401);
  });

  it('mật khẩu quá ngắn thì không bật', async () => {
    process.env.SIEU_QUAN_TRI_MAT_KHAU = 'ngan';
    await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'admin', mat_khau: 'ngan' }).expect(401);
  });
});

describe('tách dữ liệu', () => {
  it('mỗi người chỉ thấy dữ liệu của mình', async () => {
    const { qt, ban } = await chuanBi();
    await qt.post('/api/lop').send(lopMau).expect(201);
    await ban.post('/api/truong').send({ ma: 'XYZ', ten: 'Trường của Lan' }).expect(201);

    expect((await qt.get('/api/lop').expect(200)).body).toHaveLength(1);
    expect((await ban.get('/api/lop').expect(200)).body).toHaveLength(0);
    const maQt = (await qt.get('/api/truong')).body.map((t: { ma: string }) => t.ma);
    const maBan = (await ban.get('/api/truong')).body.map((t: { ma: string }) => t.ma);
    expect(maQt).not.toContain('XYZ');
    expect(maBan).toContain('XYZ');

    // Người mới: thông tin giáo viên là của chính họ, không phải của quản trị
    const caiDat = (await ban.get('/api/cai-dat').expect(200)).body;
    expect(caiDat).toMatchObject({ ten_gv: 'Nguyễn Thị Lan', ma_gv: '', sdt: '' });
    // Trường, địa điểm của người mới bắt đầu trống (không mang theo của quản trị); chỉ còn mẫu đề chung
    expect(maBan).toEqual(['XYZ']);
    expect((await ban.get('/api/dia-diem')).body).toHaveLength(0);
    const mauDe = (await ban.get('/api/mau-de')).body.mau as { truong_id: number | null }[];
    expect(mauDe.length).toBeGreaterThan(0);
    expect(mauDe.every((m) => m.truong_id === null)).toBe(true);
    expect((await qt.get('/api/dia-diem')).body.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(thuMucTam, 'nguoi-dung', '2', 'giangday.db'))).toBe(true);
  });

  it('tải file lên vẫn ghi vào dữ liệu của đúng người', async () => {
    const { ban } = await chuanBi();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Lớp A');
    ws.getCell('A2').value = 'NGÀY';
    ws.getCell('A5').value = new Date(Date.UTC(2026, 9, 3));
    ws.getCell('C5').value = 'x';
    ws.getCell('G5').value = { formula: 'COUNTA(C5:D5)*400', result: 400 };
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const r = await ban.post('/api/nhap/xem-truoc').attach('file', buffer, 'lop.xlsx').expect(200);
    expect(r.body.sheets[0]).toMatchObject({ ten_sheet: 'Lớp A', don_gia: 400 });
  });

  it('sao lưu của người dùng thường luôn nằm trong thư mục của họ', async () => {
    const { ban } = await chuanBi();
    await ban.put('/api/cai-dat').send({ thu_muc_sao_luu: 'C:\\\\Windows' }).expect(200);
    const b = (await ban.post('/api/sao-luu').expect(201)).body;
    expect(path.resolve(b.duong_dan).startsWith(path.join(thuMucTam, 'nguoi-dung', '2'))).toBe(true);
  });
});

describe('quản trị', () => {
  it('người dùng thường không quản lý được tài khoản', async () => {
    const { ban } = await chuanBi();
    await ban.get('/api/tai-khoan/nguoi-dung').expect(403);
    await ban.post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'kho', ho_ten: 'K', mat_khau: '123456' }).expect(403);
  });

  it('tên đăng nhập trùng (không phân biệt hoa thường) bị từ chối', async () => {
    const { qt } = await chuanBi();
    await qt.post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'LAN', ho_ten: 'X', mat_khau: '123456' }).expect(409);
    await qt.post('/api/tai-khoan/nguoi-dung').send({ ten_dang_nhap: 'có dấu', ho_ten: 'X', mat_khau: '123456' }).expect(400);
  });

  it('đặt lại mật khẩu và khóa tài khoản thì đăng xuất người đó', async () => {
    const { qt, ban } = await chuanBi();
    await qt.put('/api/tai-khoan/nguoi-dung/2').send({ mat_khau: 'moi12345' }).expect(200);
    await ban.get('/api/lop').expect(401);
    await ban.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'moi12345' }).expect(200);

    await qt.put('/api/tai-khoan/nguoi-dung/2').send({ bi_khoa: true }).expect(200);
    await ban.get('/api/lop').expect(401);
    await ban.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'moi12345' }).expect(403);
  });

  it('không tự khóa mình', async () => {
    const { qt } = await chuanBi();
    await qt.put('/api/tai-khoan/nguoi-dung/1').send({ bi_khoa: true }).expect(400);
  });

  it('xóa tài khoản: đăng xuất, không đăng nhập lại được, dữ liệu chuyển vào data/da-xoa', async () => {
    const { qt, ban } = await chuanBi();
    await ban.delete('/api/tai-khoan/nguoi-dung/1').expect(403); // người thường không xóa được ai
    await ban.get('/api/lop').expect(200);
    const r = await qt.delete('/api/tai-khoan/nguoi-dung/2').expect(200);
    expect(r.body.thu_muc_luu).toMatch(/^da-xoa[\\/]lan-2-\d+$/);
    expect(fs.existsSync(path.join(thuMucTam, 'nguoi-dung', '2'))).toBe(false);
    expect(fs.existsSync(path.join(thuMucTam, r.body.thu_muc_luu, 'giangday.db'))).toBe(true);
    await ban.get('/api/lop').expect(401);
    await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(401);
    expect((await qt.get('/api/tai-khoan/nguoi-dung')).body.map((n: { ten_dang_nhap: string }) => n.ten_dang_nhap)).toEqual(['hien']);
    await qt.delete('/api/tai-khoan/nguoi-dung/2').expect(404);
  });

  it('không tự xóa mình; không xóa tài khoản giữ dữ liệu gốc', async () => {
    const { qt } = await chuanBi();
    await qt.delete('/api/tai-khoan/nguoi-dung/1').expect(400);
    await qt.put('/api/tai-khoan/nguoi-dung/2').send({ la_quan_tri: true }).expect(200);
    const lan = request.agent(app);
    await lan.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(200);
    const r = await lan.delete('/api/tai-khoan/nguoi-dung/1').expect(400);
    expect(r.body.loi).toContain('dữ liệu gốc');
  });
});

describe('hồ sơ', () => {
  it('tự sửa họ tên, email; không tự nâng quyền được', async () => {
    const { ban } = await chuanBi();
    const r = await ban.put('/api/tai-khoan/toi').send({ ho_ten: 'Lan Nguyễn', email: 'lan@example.com', la_quan_tri: true }).expect(200);
    expect(r.body).toMatchObject({ ho_ten: 'Lan Nguyễn', email: 'lan@example.com', la_quan_tri: 0 });
    await ban.put('/api/tai-khoan/toi').send({ email: 'hien@example.com' }).expect(409);
    await request(app).put('/api/tai-khoan/toi').send({ ho_ten: 'X' }).expect(401);
  });
});

describe('đổi mật khẩu', () => {
  it('cần mật khẩu hiện tại; đổi xong thì nơi khác bị đăng xuất, nơi đang dùng vẫn giữ', async () => {
    const { ban } = await chuanBi();
    const noiKhac = request.agent(app);
    await noiKhac.post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(200);

    await ban.put('/api/tai-khoan/mat-khau').send({ mat_khau_cu: 'sai', mat_khau_moi: 'matkhau3' }).expect(400);
    await ban.put('/api/tai-khoan/mat-khau').send({ mat_khau_cu: 'matkhau2', mat_khau_moi: '123' }).expect(400);
    await ban.put('/api/tai-khoan/mat-khau').send({ mat_khau_cu: 'matkhau2', mat_khau_moi: 'matkhau3' }).expect(204);

    await ban.get('/api/lop').expect(200);
    await noiKhac.get('/api/lop').expect(401);
    await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau2' }).expect(401);
    await request(app).post('/api/tai-khoan/dang-nhap').send({ ten_dang_nhap: 'lan', mat_khau: 'matkhau3' }).expect(200);
  });
});
