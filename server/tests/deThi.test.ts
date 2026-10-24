import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mẫu tải lên ghi vào DATA_DIR → dùng thư mục tạm (phải đặt trước khi import mã nguồn)
const thuMucTam = vi.hoisted(() => {
  const os = process.getBuiltinModule('node:os') as typeof import('node:os');
  const fsm = process.getBuiltinModule('node:fs') as typeof import('node:fs');
  const pathm = process.getBuiltinModule('node:path') as typeof import('node:path');
  const d = fsm.mkdtempSync(pathm.join(os.tmpdir(), 'de-thi-test-'));
  process.env.DATA_DIR = d;
  return d;
});

import { taoApp } from '../src/app.js';
import { datDb, moDb } from '../src/db/connection.js';
import { THU_MUC_MAU_SAN } from '../src/repositories/mauDe.js';
import { datNhaCungCap } from '../src/services/aiSoanCau.js';
import { bocDe, dinhDangDiem, type CauNganHang } from '../src/services/bocDe.js';
import { dienMau, kiemTraMau } from '../src/services/mauWord.js';
import { phanTichVanBan } from '../src/services/phanTichCauHoi.js';
import { tenFileDeThi } from '../src/services/sinhDe.js';

const app = taoApp();
const api = () => request(app);

beforeEach(() => {
  datDb(moDb(':memory:'));
});
afterAll(() => {
  fs.rmSync(thuMucTam, { recursive: true, force: true });
});

// Random cố định để test lặp lại được
function hatGiong(s: number) {
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const nganHang = (n: number, them: Partial<CauNganHang> = {}): CauNganHang[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, chu_de: null, muc_do: 'tb', diem: null, so_lan_dung: 0, ...them }));

// Chữ trong document.xml của file docx
function chuTrongDocx(buf: Buffer): string {
  const xml = new PizZip(buf).file('word/document.xml')!.asText();
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

describe('bocDe', () => {
  it('trong một đề không lặp câu; đủ câu thì các đề không dùng chung câu', () => {
    const { de, canh_bao } = bocDe(nganHang(9), 3, [{ diem: 3 }, { diem: 3 }, { diem: 4 }], hatGiong(1));
    expect(de).toHaveLength(3);
    const tatCa = de.flatMap((d) => d.cau.map((c) => c.cau_hoi_id));
    expect(new Set(tatCa).size).toBe(9);
    expect(de[0].cau.map((c) => c.diem)).toEqual([3, 3, 4]);
    expect(canh_bao).toEqual([]);
  });

  it('thiếu câu cho nhiều đề thì dùng lại và cảnh báo, nhưng trong đề vẫn không lặp', () => {
    const { de, canh_bao } = bocDe(nganHang(4), 2, [{ diem: 3 }, { diem: 3 }, { diem: 4 }], hatGiong(2));
    for (const d of de) expect(new Set(d.cau.map((c) => c.cau_hoi_id)).size).toBe(3);
    expect(canh_bao.join(' ')).toContain('dùng lại');
  });

  it('báo lỗi khi ngân hàng ít câu hơn số câu một đề', () => {
    expect(() => bocDe(nganHang(2), 1, [{ diem: 3 }, { diem: 3 }, { diem: 4 }])).toThrow(/mới có 2 câu/);
  });

  it('ưu tiên đúng mức độ, đúng điểm, câu ít dùng và khác chủ đề', () => {
    const ds: CauNganHang[] = [
      { id: 1, chu_de: 'A', muc_do: 'de', diem: 3, so_lan_dung: 5 },
      { id: 2, chu_de: 'A', muc_do: 'de', diem: 3, so_lan_dung: 0 },
      { id: 3, chu_de: 'B', muc_do: 'kho', diem: 4, so_lan_dung: 0 },
      { id: 4, chu_de: 'A', muc_do: 'kho', diem: 2, so_lan_dung: 0 },
      { id: 5, chu_de: 'B', muc_do: 'de', diem: 3, so_lan_dung: 0 },
    ];
    const { de } = bocDe(ds, 1, [{ diem: 3, muc_do: 'de' }, { diem: 3, muc_do: 'de' }, { diem: 4, muc_do: 'kho' }], hatGiong(3));
    const ids = de[0].cau.map((c) => c.cau_hoi_id);
    expect(ids).not.toContain(1); // dùng nhiều lần rồi
    expect(new Set(ids.slice(0, 2))).toEqual(new Set([2, 5])); // 2 câu dễ khác chủ đề
    expect(ids[2]).toBe(3); // câu khó đúng 4 điểm
  });

  it('hết câu đúng mức thì lấy mức khác và cảnh báo', () => {
    const { de, canh_bao } = bocDe(nganHang(3), 1, [{ diem: 3, muc_do: 'kho' }, { diem: 3 }, { diem: 4 }]);
    expect(de[0].cau).toHaveLength(3);
    expect(canh_bao[0]).toContain('Khó');
  });

  it('định dạng điểm kiểu Việt Nam', () => {
    expect(dinhDangDiem(2.5)).toBe('2,5');
    expect(dinhDangDiem(3)).toBe('3');
  });
});

describe('phanTichVanBan (dán câu hỏi từ Word)', () => {
  it('đáp án nằm ngay dưới từng câu', () => {
    const kq = phanTichVanBan(
      'Đề số 01\nCâu 1 (3 điểm): Trình bày khái niệm HTML.\nNêu ví dụ.\nĐáp án:\n- Khái niệm (2 điểm)\n- Ví dụ (1 điểm)\nCâu 2 (2,5 điểm): Thẻ div là gì?\nĐáp án: Thẻ khối (2,5 điểm)\n---Hết---',
    );
    expect(kq).toEqual([
      { noi_dung: 'Trình bày khái niệm HTML.\nNêu ví dụ.', dap_an: '- Khái niệm (2 điểm)\n- Ví dụ (1 điểm)', diem: 3 },
      { noi_dung: 'Thẻ div là gì?', dap_an: 'Thẻ khối (2,5 điểm)', diem: 2.5 },
    ]);
  });

  it('đáp án gom thành phần riêng ở cuối', () => {
    const kq = phanTichVanBan(
      'Câu 1 (3 điểm): Hỏi một\nCâu 2 (4 điểm): Hỏi hai\n\nĐÁP ÁN ĐỀ THI\nCâu 1 (3 điểm):\n- Ý một\nCâu 2:\n- Ý hai a\n- Ý hai b',
    );
    expect(kq.map((c) => [c.noi_dung, c.dap_an, c.diem])).toEqual([
      ['Hỏi một', '- Ý một', 3],
      ['Hỏi hai', '- Ý hai a\n- Ý hai b', 4],
    ]);
  });
});

describe('mẫu Word', () => {
  const duLieu = {
    truong: 'Trường Trung cấp Giao thông Công chính',
    truong_in_hoa: 'TRƯỜNG TRUNG CẤP GIAO THÔNG CÔNG CHÍNH',
    dia_danh: 'Hà Nội',
    hoc_phan: 'Thiết kế Web',
    ma_hoc_phan: 'CT14',
    nganh: 'Công nghệ thông tin',
    trinh_do: 'Trung cấp',
    lop: 'CT.10T1',
    lop_van_hoa: '11A6',
    nam_hoc: '2026-2027',
    hoc_ky: 'I',
    hinh_thuc: 'Tự luận',
    thoi_gian: '45',
    ngay_thi: '…/…/ 202…',
    tai_lieu: 'không được',
    ten_gv: 'Đặng Mạnh Hiền',
    ma_gv: 'G366',
    so_de_thi: 2,
    de: [1, 2].map((n) => ({
      so_de: `0${n}`,
      tong_diem: '10',
      cau: [
        { so: 1, diem: '3', noi_dung: `Câu hỏi A của đề ${n}`, dap_an: '- Ý 1 (1 điểm)\n- Ý 2 (2 điểm)' },
        { so: 2, diem: '7', noi_dung: `Câu hỏi B của đề ${n}\na) ý nhỏ`, dap_an: '- Ý chính (7 điểm)' },
      ],
    })),
  };

  for (const ten of ['tchn.docx', 'danganh.docx', 'chung.docx']) {
    it(`điền đủ thông tin vào mẫu ${ten}, không còn ô {…} sót lại`, () => {
      const mau = fs.readFileSync(path.join(THU_MUC_MAU_SAN, ten));
      expect(kiemTraMau(mau).canh_bao).toEqual([]);
      const chu = chuTrongDocx(dienMau(mau, duLieu));
      expect(chu).not.toMatch(/\{[#/a-z_]+\}/);
      for (const n of [1, 2]) {
        expect(chu).toContain(`Câu hỏi A của đề ${n}`);
        expect(chu).toContain(`Câu hỏi B của đề ${n}`);
      }
      expect(chu).toContain('a) ý nhỏ');
      expect(chu).toContain('- Ý 2 (2 điểm)');
      expect(chu).toContain('Câu 2 (7 điểm)');
      expect(chu).toContain('CT.10T1');
      expect(chu).toContain('45 phút');
      expect(chu).toContain('Thiết kế Web');
      if (ten === 'chung.docx') expect(chu).toContain('TRƯỜNG TRUNG CẤP GIAO THÔNG CÔNG CHÍNH');
      if (ten === 'tchn.docx') expect(chu).toContain('TRƯỜNG TRUNG CẤP HÀ NỘI');
      if (ten === 'danganh.docx') expect(chu).toContain('HỘI ĐỒNG THI HỌC KỲ I');
    });
  }

  it('từ chối mẫu chưa có ô {#cau}', () => {
    const mau = fs.readFileSync(path.join(THU_MUC_MAU_SAN, 'goc', 'tchn.docx'));
    expect(() => kiemTraMau(mau)).toThrow(/\{#cau\}/);
  });

  it('báo lỗi dễ hiểu khi mẫu viết sai ô điền', () => {
    const zip = new PizZip(fs.readFileSync(path.join(THU_MUC_MAU_SAN, 'chung.docx')));
    const xml = zip.file('word/document.xml')!.asText().replace('{/cau}', '');
    zip.file('word/document.xml', xml);
    expect(() => kiemTraMau(zip.generate({ type: 'nodebuffer' }))).toThrow(/chưa có thẻ đóng/);
  });

  it('tên file giống mẫu của thầy', () => {
    expect(tenFileDeThi({ lop: 'CT.10T1', ma_hoc_phan: 'CT14', hoc_phan: 'Thiết kế Web' })).toBe(
      'CT.10T1 - CT14 Thiết kế Web (Đề thi & Đáp án).docx',
    );
    expect(tenFileDeThi({ lop: '', ma_hoc_phan: '', hoc_phan: 'Mạng: cơ bản' })).toBe('Mạng- cơ bản (Đề thi & Đáp án).docx');
  });
});

// Đọc phản hồi nhị phân (file docx) trong supertest
const nhiPhan = (r: request.Test) =>
  r.buffer(true).parse((res, cb) => {
    const ds: Buffer[] = [];
    res.on('data', (c: Buffer) => ds.push(c));
    res.on('end', () => cb(null, Buffer.concat(ds)));
  });

async function taoMonCoCauHoi(soCau = 6) {
  const mon = (await api().post('/api/mon').send({ ten: 'Thiết kế Web', ma: 'CT14' }).expect(201)).body;
  const cau_hoi = Array.from({ length: soCau }, (_, i) => ({
    chu_de: `Chương ${(i % 3) + 1}`,
    muc_do: i % 2 ? 'kho' : 'de',
    diem: i % 3 === 2 ? 4 : 3,
    noi_dung: `Nội dung câu ${i + 1}`,
    dap_an: `- Đáp án câu ${i + 1} (3 điểm)`,
  }));
  if (soCau) await api().post(`/api/mon/${mon.id}/cau-hoi`).send({ cau_hoi }).expect(201);
  return mon as { id: number };
}

describe('API đề thi', () => {
  it('3 mẫu có sẵn: Hà Nội, Đa Ngành và mẫu chung', async () => {
    const r = await api().get('/api/mau-de').expect(200);
    expect(r.body.mau.map((m: { truong_ma: string | null }) => m.truong_ma)).toEqual(['DANGANH', 'HN', null]);
    expect(r.body.o_dien.length).toBeGreaterThan(10);
  });

  it('môn: tạo, trùng tên (không phân biệt hoa thường/dấu cách), gợi ý từ học phần của lớp', async () => {
    await api()
      .post('/api/lop')
      .send({ truong_id: 4, ten_sheet: 'Web_TT', hoc_phan: 'Thiết kế  Web', don_gia: 400 })
      .expect(201);
    let r = await api().get('/api/mon').expect(200);
    expect(r.body.goi_y).toEqual(['Thiết kế  Web']);
    await api().post('/api/mon').send({ ten: 'Thiết kế Web' }).expect(201);
    r = await api().post('/api/mon').send({ ten: 'thiết kế web' }).expect(409);
    expect(r.body.loi).toContain('Đã có môn');
    r = await api().get('/api/mon').expect(200);
    expect(r.body.goi_y).toEqual([]);
    expect(r.body.mon[0]).toMatchObject({ so_lop: 1, so_cau: 0 });
  });

  it('dán văn bản → tách câu hỏi để xem trước', async () => {
    const mon = await taoMonCoCauHoi(0);
    const r = await api()
      .post(`/api/mon/${mon.id}/cau-hoi/tach-van-ban`)
      .send({ van_ban: 'Câu 1 (3 điểm): Hỏi\nĐáp án: Đáp' })
      .expect(200);
    expect(r.body).toEqual([{ noi_dung: 'Hỏi', dap_an: 'Đáp', diem: 3 }]);
  });

  it('luồng đầy đủ: gợi ý theo lớp → xem trước → sinh đề → tải file Word → lịch sử', async () => {
    const lop = (
      await api()
        .post('/api/lop')
        .send({ truong_id: 4, ten_sheet: 'Web_TT', ma_lop: 'CT.10T1', hoc_phan: 'Thiết kế Web', don_gia: 400 })
        .expect(201)
    ).body;
    const mon = await taoMonCoCauHoi(6);

    const goiY = (await api().get(`/api/de-thi/goi-y?lopId=${lop.id}`).expect(200)).body;
    expect(goiY.mon_id).toBe(mon.id);
    expect(goiY.truong_id).toBe(4);
    expect(goiY.thong_tin).toMatchObject({ lop: 'CT.10T1', hoc_phan: 'Thiết kế Web', ma_hoc_phan: 'CT14', nam_hoc: '2026-2027' });
    const mauHN = (await api().get('/api/mau-de').expect(200)).body.mau.find((m: { truong_ma: string }) => m.truong_ma === 'HN');
    expect(goiY.mau_de_id).toBe(mauHN.id);
    expect(goiY.cau_truc.map((c: { diem: number }) => c.diem)).toEqual([3, 3, 4]);

    const xt = (await api().post('/api/de-thi/xem-truoc').send({ mon_id: mon.id, so_de: 2, cau_truc: goiY.cau_truc }).expect(200))
      .body;
    expect(xt.de).toHaveLength(2);
    expect(xt.ngan_hang).toHaveLength(6);

    const tao = await api()
      .post('/api/de-thi')
      .send({
        mon_id: mon.id,
        lop_id: lop.id,
        truong_id: 4,
        mau_de_id: goiY.mau_de_id,
        thong_tin: goiY.thong_tin,
        de: xt.de.map((d: { cau: unknown[] }) => ({ cau: d.cau })),
      })
      .expect(201);
    expect(tao.body.ten_file).toBe('CT.10T1 - CT14 Thiết kế Web (Đề thi & Đáp án).docx');

    const file = await nhiPhan(api().get(`/api/de-thi/${tao.body.id}/tai`)).expect(200);
    expect(file.headers['content-type']).toContain('wordprocessingml');
    expect(file.headers['content-disposition']).toContain("filename*=UTF-8''");
    const chu = chuTrongDocx(file.body as Buffer);
    expect(chu).toContain('TRƯỜNG TRUNG CẤP HÀ NỘI');
    expect(chu).toContain('Đề thi số: 02');
    expect(chu).not.toMatch(/\{[#/a-z_]+\}/);

    // Số lần dùng tăng; sửa câu hỏi sau đó không làm đổi đề đã sinh
    const ct = (await api().get(`/api/mon/${mon.id}`).expect(200)).body;
    expect(ct.cau_hoi.filter((c: { so_lan_dung: number }) => c.so_lan_dung > 0)).toHaveLength(6);
    const idDau = xt.de[0].cau[0].cau_hoi_id;
    await api().put(`/api/cau-hoi/${idDau}`).send({ noi_dung: 'ĐÃ SỬA' }).expect(200);
    const daLuu = (await api().get(`/api/de-thi/${tao.body.id}`).expect(200)).body;
    expect(daLuu.noi_dung[0].cau[0].noi_dung).not.toBe('ĐÃ SỬA');

    const ls = (await api().get('/api/de-thi').expect(200)).body;
    expect(ls[0]).toMatchObject({ mon_ten: 'Thiết kế Web', truong_ma: 'HN', so_de: 2, so_cau: 3, lop: 'CT.10T1' });
  });

  it('chặn câu hỏi của môn khác và câu bị chọn hai lần', async () => {
    const mon = await taoMonCoCauHoi(3);
    const mon2 = (await api().post('/api/mon').send({ ten: 'Tin học' }).expect(201)).body;
    const ids = (await api().get(`/api/mon/${mon.id}`)).body.cau_hoi.map((c: { id: number }) => c.id);
    const goiY = (await api().get(`/api/de-thi/goi-y?monId=${mon2.id}`)).body;
    const gui = (monId: number, cau: number[]) =>
      api()
        .post('/api/de-thi')
        .send({ mon_id: monId, mau_de_id: goiY.mau_de_id, thong_tin: { ...goiY.thong_tin, hoc_phan: 'X' }, de: [{ cau: cau.map((id) => ({ cau_hoi_id: id, diem: 5 })) }] });
    expect((await gui(mon2.id, [ids[0]]).expect(400)).body.loi).toContain('không thuộc môn');
    expect((await gui(mon.id, [ids[0], ids[0]]).expect(400)).body.loi).toContain('hai lần');
  });

  it('xem trước báo lỗi tiếng Việt khi ngân hàng chưa đủ câu', async () => {
    const mon = await taoMonCoCauHoi(2);
    const r = await api()
      .post('/api/de-thi/xem-truoc')
      .send({ mon_id: mon.id, so_de: 1, cau_truc: [{ diem: 3 }, { diem: 3 }, { diem: 4 }] })
      .expect(400);
    expect(r.body.loi).toContain('mới có 2 câu');
  });

  it('tải mẫu lên cho trường, kiểm tra ô điền, tải về, xóa', async () => {
    const mauChung = fs.readFileSync(path.join(THU_MUC_MAU_SAN, 'chung.docx'));
    const r = await api()
      .post('/api/mau-de')
      .field('ten', 'Mẫu GTCT')
      .field('truong_id', '1')
      .field('cau_truc', '[2,3,5]')
      .field('thoi_gian', '90')
      .attach('file', mauChung, 'mau.docx')
      .expect(201);
    expect(r.body).toMatchObject({ ten: 'Mẫu GTCT', truong_ma: 'GTCT', cau_truc: [2, 3, 5], thoi_gian: 90, canh_bao: [] });
    expect(fs.readdirSync(path.join(thuMucTam, 'mau-de'))).toHaveLength(1);

    // Gợi ý cho lớp của GTCT dùng mẫu vừa tải
    const lop = (await api().post('/api/lop').send({ truong_id: 1, ten_sheet: 'QTM', hoc_phan: 'Quản trị mạng', don_gia: 380 })).body;
    const goiY = (await api().get(`/api/de-thi/goi-y?lopId=${lop.id}`)).body;
    expect(goiY.mau_de_id).toBe(r.body.id);
    expect(goiY.thong_tin.thoi_gian).toBe(90);

    const tai = await nhiPhan(api().get(`/api/mau-de/${r.body.id}/tai`)).expect(200);
    expect((tai.body as Buffer).equals(mauChung)).toBe(true);

    // Mẫu gốc chưa có ô điền → từ chối
    const goc = fs.readFileSync(path.join(THU_MUC_MAU_SAN, 'goc', 'tchn.docx'));
    const loi = await api().post('/api/mau-de').field('ten', 'Sai').attach('file', goc, 'goc.docx').expect(400);
    expect(loi.body.loi).toContain('{#cau}');
    const khongPhaiWord = await api().post('/api/mau-de').field('ten', 'Sai').attach('file', Buffer.from('xin chào'), 'a.txt').expect(400);
    expect(khongPhaiWord.body.loi).toContain('không phải Word');

    await api().delete(`/api/mau-de/${r.body.id}`).expect(204);
    expect(fs.readdirSync(path.join(thuMucTam, 'mau-de'))).toHaveLength(0);
    // Mẫu có sẵn không xóa được
    expect((await api().delete(`/api/mau-de/${goiY.mau_de_id === 1 ? 1 : 3}`).expect(400)).body.loi).toContain('có sẵn');
  });
});

describe('AI soạn câu hỏi', () => {
  const ketQuaGia = {
    cau_hoi: [
      { chu_de: 'CSS', muc_do: 'tb' as const, diem: 3, noi_dung: ' Trình bày CSS ', dap_an: '- Ý (3 điểm)' },
      { chu_de: '', muc_do: 'kho' as const, diem: 0, noi_dung: 'So sánh', dap_an: '- Ý (4 điểm)' },
    ],
  };

  it('mặc định dùng Gemini; chưa có key thì báo hướng dẫn', async () => {
    const mon = await taoMonCoCauHoi(0);
    const r = await api().post(`/api/mon/${mon.id}/ai-soan`).send({ so_cau: 3, diem: [3, 3, 4] }).expect(400);
    expect(r.body.loi).toContain('API key của Gemini');
    const tt = (await api().get('/api/ai').expect(200)).body;
    expect(tt).toMatchObject({ dang_dung: 'gemini', co_khoa: false, mo_hinh: 'gemini-3.8-flash' });
    expect(tt.nha_cung_cap.map((n: { ma: string }) => n.ma)).toEqual(['gemini', 'claude']);
  });

  it('Gemini: lưu key sau khi gọi thử, gửi đúng yêu cầu, key không lộ', async () => {
    let daGui: { heThong: string; noiDung: string; khoa: string } | undefined;
    datNhaCungCap('gemini', {
      kiemTra: async (k) => {
        if (k === 'sai') throw new Error('API key not valid');
      },
      soan: async (khoa, heThong, noiDung) => {
        daGui = { khoa, heThong, noiDung };
        return ketQuaGia;
      },
    });
    const mon = await taoMonCoCauHoi(1);
    // Key sai: không lưu
    await api().put('/api/ai').send({ nha_cung_cap: 'gemini', khoa: 'sai' }).expect(500);
    expect((await api().get('/api/ai')).body.co_khoa).toBe(false);

    const tt = (await api().put('/api/ai').send({ nha_cung_cap: 'gemini', khoa: 'AQ.thu-nghiem-gemini-9876' }).expect(200)).body;
    expect(tt).toMatchObject({ dang_dung: 'gemini', co_khoa: true });
    expect(tt.nha_cung_cap[0].khoa_an).toBe('AQ.th…9876');
    expect(JSON.stringify((await api().get('/api/cai-dat')).body)).not.toContain('thu-nghiem');

    const r = await api()
      .post(`/api/mon/${mon.id}/ai-soan`)
      .send({ so_cau: 2, diem: [3, 4], chu_de: 'CSS', yeu_cau_them: 'có câu so sánh' })
      .expect(200);
    expect(r.body).toEqual([
      { chu_de: 'CSS', muc_do: 'tb', diem: 3, noi_dung: 'Trình bày CSS', dap_an: '- Ý (3 điểm)' },
      { chu_de: 'CSS', muc_do: 'kho', diem: 3, noi_dung: 'So sánh', dap_an: '- Ý (4 điểm)' },
    ]);
    expect(daGui!.khoa).toBe('AQ.thu-nghiem-gemini-9876');
    expect(daGui!.heThong).toContain('TỰ LUẬN');
    expect(daGui!.noiDung).toContain('Thiết kế Web');
    expect(daGui!.noiDung).toContain('có câu so sánh');
    expect(daGui!.noiDung).toContain('Nội dung câu 1'); // gửi câu đã có để tránh trùng

    // Xóa key
    expect((await api().put('/api/ai').send({ nha_cung_cap: 'gemini', khoa: null }).expect(200)).body.co_khoa).toBe(false);
  });

  it('chuyển sang Claude: dùng key riêng của Claude', async () => {
    let goi = 0;
    datNhaCungCap('claude', { kiemTra: async () => {}, soan: async () => (goi++, ketQuaGia) });
    const mon = await taoMonCoCauHoi(0);
    let tt = (await api().put('/api/ai').send({ nha_cung_cap: 'claude' }).expect(200)).body;
    expect(tt).toMatchObject({ dang_dung: 'claude', co_khoa: false, mo_hinh: 'claude-opus-5-5' });
    expect((await api().post(`/api/mon/${mon.id}/ai-soan`).send({ so_cau: 2, diem: [3] }).expect(400)).body.loi).toContain('Claude');
    tt = (await api().put('/api/ai').send({ nha_cung_cap: 'claude', khoa: 'sk-ant-thu-1234' }).expect(200)).body;
    expect(tt.co_khoa).toBe(true);
    await api().post(`/api/mon/${mon.id}/ai-soan`).send({ so_cau: 2, diem: [3] }).expect(200);
    expect(goi).toBe(1);
  });
});
