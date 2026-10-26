import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { bamMatKhau, datDbHeThong, dungMatKhau } from '../src/services/taiKhoan.js';

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
  const qt = request.agent(app);
  await qt
    .post('/api/tai-khoan/khoi-tao')
    .send({ ten_dang_nhap: 'hien', ho_ten: 'Đặng Mạnh Hiền', email: 'Hien@Example.com', mat_khau: 'matkhau1' })
    .expect(200);
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
  it('chưa có tài khoản: cần khởi tạo, dữ liệu bị chặn', async () => {
    const { body } = await request(app).get('/api/tai-khoan/toi').expect(200);
    expect(body).toEqual({ nguoi_dung: null, can_khoi_tao: true });
    await request(app).get('/api/lop').expect(401);
    await request(app).get('/api/suc-khoe').expect(200);
  });

  it('khởi tạo: tạo quản trị và vào luôn, chỉ làm được khi chưa có tài khoản', async () => {
    const d = { ten_dang_nhap: 'hien', ho_ten: 'Hiền', mat_khau: 'matkhau1' };
    const r = await request(app).post('/api/tai-khoan/khoi-tao').send(d).expect(200);
    expect(r.body.nguoi_dung).toMatchObject({ ten_dang_nhap: 'hien', la_quan_tri: 1, email: null });
    expect(r.headers['set-cookie'][0]).toMatch(/^phien=.+HttpOnly; SameSite=Lax/);
    await request(app).post('/api/tai-khoan/khoi-tao').send({ ...d, ten_dang_nhap: 'nguoi.la' }).expect(409);
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

  it('đăng xuất thì phiên hết dùng được', async () => {
    const { ban } = await chuanBi();
    await ban.get('/api/lop').expect(200);
    await ban.post('/api/tai-khoan/dang-xuat').expect(204);
    await ban.get('/api/lop').expect(401);
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
