import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { taoApp } from '../src/app.js';
import { datDb, moDb } from '../src/db/connection.js';
import { ghiCaiDat } from '../src/repositories/caiDat.js';
import { dsBanSaoLuu, donBanCu, saoLuuNgay, saoLuuTuDong } from '../src/services/saoLuu.js';
import dayjs from 'dayjs';

let thuMuc: string;

beforeEach(() => {
  datDb(moDb(':memory:'));
  thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'saoluu-'));
  ghiCaiDat({ thu_muc_sao_luu: thuMuc });
});

function taoBanGia(luc: dayjs.Dayjs) {
  const ten = `giangday_${luc.format('YYYYMMDD_HHmmss')}.db`;
  fs.writeFileSync(path.join(thuMuc, ten), 'x');
  return ten;
}

describe('saoLuu', () => {
  it('sao lưu ra file SQLite mở được, đủ dữ liệu', () => {
    const ban = saoLuuNgay();
    expect(ban.ten).toMatch(/^giangday_\d{8}_\d{6}\.db$/);
    const db = new Database(ban.duong_dan, { readonly: true });
    expect((db.prepare('SELECT count(*) n FROM truong').get() as { n: number }).n).toBe(4);
    db.close();
    // Hai lần trong cùng một giây không ghi đè nhau
    const ban2 = saoLuuNgay();
    expect(ban2.ten).not.toBe(ban.ten);
    expect(dsBanSaoLuu()).toHaveLength(2);
  });

  it('chỉ giữ 30 bản mới nhất', () => {
    for (let i = 0; i < 35; i++) taoBanGia(dayjs().subtract(i + 1, 'day'));
    expect(donBanCu()).toBe(5);
    const ds = dsBanSaoLuu();
    expect(ds).toHaveLength(30);
    expect(ds[0].luc > ds[29].luc).toBe(true);
  });

  it('tự động: bỏ qua nếu bản gần nhất chưa quá 24 giờ', () => {
    taoBanGia(dayjs().subtract(3, 'hour'));
    expect(saoLuuTuDong()).toBeNull();
    expect(dsBanSaoLuu()).toHaveLength(1);
  });

  it('tự động: sao lưu khi chưa có bản nào hoặc bản cũ hơn 24 giờ', () => {
    expect(saoLuuTuDong()).not.toBeNull();
    fs.rmSync(thuMuc, { recursive: true });
    fs.mkdirSync(thuMuc);
    taoBanGia(dayjs().subtract(25, 'hour'));
    expect(saoLuuTuDong()).not.toBeNull();
    expect(dsBanSaoLuu()).toHaveLength(2);
  });

  it('API sao lưu', async () => {
    const app = taoApp();
    const r = await request(app).post('/api/sao-luu').expect(201);
    expect(fs.existsSync(r.body.duong_dan)).toBe(true);
    const ds = await request(app).get('/api/sao-luu').expect(200);
    expect(ds.body.thu_muc).toBe(thuMuc);
    expect(ds.body.ban).toHaveLength(1);
  });
});
