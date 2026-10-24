// Chuẩn hóa các mẫu đề thi gốc (server/mau-de/goc) thành mẫu có ô điền {…} cho docxtemplater.
// Chạy lại khi cần: npx tsx scripts/taoMauDe.ts
// Kết quả: server/mau-de/tchn.docx, danganh.docx, chung.docx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser, XMLSerializer, type Document, type Element } from '@xmldom/xmldom';
import PizZip from 'pizzip';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const THU_MUC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../mau-de');

const conTrucTiep = (el: Element) => [...el.childNodes].filter((n): n is Element => n.nodeType === 1);
const ds = (el: Element | Document, ten: string) => [...el.getElementsByTagNameNS(W, ten)];
const chuCua = (el: Element) => ds(el, 't').map((t) => t.textContent ?? '').join('');

function tao(doc: Document, ten: string, thuocTinh: Record<string, string> = {}) {
  const el = doc.createElementNS(W, `w:${ten}`);
  for (const [k, v] of Object.entries(thuocTinh)) el.setAttributeNS(W, `w:${k}`, v);
  return el;
}

// Thay chuỗi trong một đoạn, kể cả khi chuỗi bị Word cắt qua nhiều run
function thayTrongDoan(p: Element, cu: string, moi: string): boolean {
  const nut = ds(p, 't');
  const toan = nut.map((t) => t.textContent ?? '').join('');
  const vt = toan.indexOf(cu);
  if (vt < 0) return false;
  let dem = 0;
  let daGhi = false;
  for (const t of nut) {
    const s = t.textContent ?? '';
    const dau = dem;
    const cuoi = dem + s.length;
    dem = cuoi;
    if (cuoi <= vt || dau >= vt + cu.length) continue;
    const truoc = vt > dau ? s.slice(0, vt - dau) : '';
    const sau = vt + cu.length < cuoi ? s.slice(vt + cu.length - dau) : '';
    t.textContent = truoc + (daGhi ? '' : moi) + sau;
    t.setAttribute('xml:space', 'preserve');
    daGhi = true;
  }
  return true;
}

function thayTrongKhoi(el: Element, cu: string, moi: string) {
  const ps = el.localName === 'p' ? [el] : ds(el, 'p');
  for (const p of ps) if (thayTrongDoan(p, cu, moi)) return;
  throw new Error(`Không tìm thấy "${cu}"`);
}

// Tạo run mới theo định dạng của run mẫu
function taoRun(doc: Document, mau: Element | undefined, chu: string, dam: boolean) {
  const r = tao(doc, 'r');
  const rPrMau = mau ? conTrucTiep(mau).find((c) => c.localName === 'rPr') : undefined;
  const rPr = (rPrMau?.cloneNode(true) as Element | undefined) ?? tao(doc, 'rPr');
  for (const c of conTrucTiep(rPr)) if (c.localName === 'b' || c.localName === 'bCs') rPr.removeChild(c);
  if (dam) rPr.insertBefore(tao(doc, 'b'), rPr.firstChild);
  r.appendChild(rPr);
  const t = tao(doc, 't');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = chu;
  r.appendChild(t);
  return r;
}

// Thêm chữ vào cuối đoạn (VD "Năm học:" + " {nam_hoc}"), không đậm
function themCuoiDoan(doc: Document, p: Element, chu: string) {
  const runs = ds(p, 'r');
  p.appendChild(taoRun(doc, runs.at(-1), chu, false));
}

function timDoan(el: Element, dieuKien: (t: string) => boolean): Element {
  const p = ds(el, 'p').find((x) => dieuKien(chuCua(x).trim()));
  if (!p) throw new Error('Không tìm thấy đoạn cần sửa');
  return p;
}

// Đoạn mới giữ định dạng đoạn (pPr) và chữ (rPr) của đoạn mẫu
function doanTheoMau(doc: Document, mau: Element, phan: { chu: string; dam?: boolean }[]) {
  const p = tao(doc, 'p');
  const pPr = conTrucTiep(mau).find((c) => c.localName === 'pPr');
  if (pPr) {
    const pp = pPr.cloneNode(true) as Element;
    for (const c of conTrucTiep(pp)) if (c.localName === 'jc' || c.localName === 'ind') pp.removeChild(c);
    pp.appendChild(tao(doc, 'jc', { val: 'both' }));
    p.appendChild(pp);
  }
  const runMau = ds(mau, 'r')[0];
  for (const x of phan) p.appendChild(taoRun(doc, runMau, x.chu, !!x.dam));
  return p;
}

const doanChu = (doc: Document, chu: string) => {
  const p = tao(doc, 'p');
  p.appendChild(taoRun(doc, undefined, chu, false));
  return p;
};
const doanTrong = (doc: Document) => tao(doc, 'p');

// Đoạn trống có "ngắt trang trước": mỗi đề / đáp án bắt đầu trang mới
function doanNgatTrang(doc: Document) {
  const p = tao(doc, 'p');
  const pPr = tao(doc, 'pPr');
  pPr.appendChild(tao(doc, 'pageBreakBefore'));
  pPr.appendChild(tao(doc, 'spacing', { before: '0', after: '0' }));
  p.appendChild(pPr);
  return p;
}

// Khối câu hỏi: mỗi câu và mỗi dòng nội dung là một đoạn riêng (thẻ lặp nằm ở đoạn riêng)
function khoiCauHoi(doc: Document, mau: Element) {
  return [
    doanChu(doc, '{#cau}'),
    doanTheoMau(doc, mau, [{ chu: 'Câu {so} ({diem} điểm): ', dam: true }, { chu: '{dong_dau}' }]),
    doanChu(doc, '{#dong_sau}'),
    doanTheoMau(doc, mau, [{ chu: '{chu}' }]),
    doanChu(doc, '{/dong_sau}'),
    doanChu(doc, '{/cau}'),
  ];
}

function khoiDapAn(doc: Document, mau: Element) {
  return [
    doanChu(doc, '{#cau}'),
    doanTheoMau(doc, mau, [{ chu: 'Câu {so} ({diem} điểm):', dam: true }]),
    doanChu(doc, '{#dong_dap_an}'),
    doanTheoMau(doc, mau, [{ chu: '{chu}' }]),
    doanChu(doc, '{/dong_dap_an}'),
    doanChu(doc, '{/cau}'),
  ];
}

function moMau(tenGoc: string) {
  const zip = new PizZip(fs.readFileSync(path.join(THU_MUC, 'goc', tenGoc)));
  const doc = new DOMParser().parseFromString(zip.file('word/document.xml')!.asText(), 'text/xml');
  const body = ds(doc, 'body')[0];
  // Chữ trong file gốc có chỗ gõ dạng tổ hợp (NFD): chuẩn hóa về NFC để so khớp
  for (const t of ds(doc, 't')) t.textContent = (t.textContent ?? '').normalize('NFC');
  // Chỉ đánh số đoạn văn và bảng (bỏ bookmark… ở cấp body)
  const phanTu = conTrucTiep(body).filter((c) => c.localName === 'p' || c.localName === 'tbl');
  return { zip, doc, body, phanTu };
}

function ghiMau(zip: PizZip, doc: Document, body: Element, moi: Element[], tenRa: string) {
  const sectPr = conTrucTiep(body).find((c) => c.localName === 'sectPr');
  while (body.firstChild) body.removeChild(body.firstChild);
  for (const el of moi) body.appendChild(el);
  if (sectPr) body.appendChild(sectPr);
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  fs.writeFileSync(path.join(THU_MUC, tenRa), zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('Đã tạo', tenRa);
}

// --------------------------------------------------------------------------
// Trường Trung cấp Hà Nội: mỗi đề 1 trang, sau đó các trang đáp án
function mauTCHN(truongChung = false) {
  const { zip, doc, body, phanTu: e } = moMau('tchn.docx');
  const kiemTra = (i: number, chua: string) => {
    if (!chuCua(e[i]).includes(chua)) throw new Error(`Mẫu TCHN khác dự kiến ở phần tử ${i}: cần "${chua}"`);
  };
  kiemTra(7, 'Đề thi số:01');
  kiemTra(13, 'NỘI DUNG ĐỀ THI');
  kiemTra(21, '---Hết---');
  kiemTra(31, 'NGƯỜI RA ĐỀ');
  kiemTra(79, 'ĐÁP ÁN ĐỀ THI');
  kiemTra(80, 'Đề thi số:01');

  // Thông tin đề
  thayTrongKhoi(e[7], 'Đề thi số:01', 'Đề thi số: {so_de}');
  thayTrongKhoi(e[9], 'Học phần:Thiết kế Web', 'Học phần: {hoc_phan}');
  thayTrongKhoi(e[9], '……………….', '{hinh_thuc}');
  thayTrongKhoi(e[10], 'Công nghệ thông tin', '{nganh}');
  thayTrongKhoi(e[10], '60 phút', '{thoi_gian} phút');
  thayTrongKhoi(e[11], 'Trung cấp', '{trinh_do}');
  thayTrongKhoi(e[11], '…/…/ 202…', '{ngay_thi}');
  thayTrongKhoi(e[12], 'CT.10T1', '{lop}');
  thayTrongKhoi(e[24], 'không được/ được', '{tai_lieu}');
  thayTrongKhoi(e[80], 'Đề thi số:01', 'Đề thi số: {so_de}');
  if (truongChung) {
    thayTrongKhoi(e[1], 'TRƯỜNG TRUNG CẤP HÀ NỘI', '{truong_in_hoa}');
    thayTrongKhoi(e[76], 'TRƯỜNG TRUNG CẤP HÀ NỘI', '{truong_in_hoa}');
    thayTrongKhoi(e[30], 'Hà Nội', '{dia_danh}');
  }

  // Đoạn đầu trang: ngắt trang trước để mỗi đề sang trang mới
  const pPr0 = conTrucTiep(e[0]).find((c) => c.localName === 'pPr') ?? e[0].insertBefore(tao(doc, 'pPr'), e[0].firstChild);
  pPr0.insertBefore(tao(doc, 'pageBreakBefore'), pPr0.firstChild);

  const mau = e[12];
  const moi: Element[] = [
    doanChu(doc, '{#de}'),
    ...e.slice(0, 14),
    doanTrong(doc),
    ...khoiCauHoi(doc, mau),
    doanTrong(doc),
    ...e.slice(21, 32),
    doanChu(doc, '{/de}'),
    doanChu(doc, '{#de}'),
    doanNgatTrang(doc),
    ...e.slice(76, 81),
    doanTrong(doc),
    ...khoiDapAn(doc, mau),
    doanChu(doc, '{/de}'),
  ];
  ghiMau(zip, doc, body, moi, truongChung ? 'chung.docx' : 'tchn.docx');
}

// --------------------------------------------------------------------------
// Trường Trung cấp Kỹ thuật Đa ngành Hà Nội: Câu 1 (3đ), Câu 2 (3đ), Câu 3 (4đ) + trang đáp án
function mauDaNganh() {
  const { zip, doc, body, phanTu: e } = moMau('danganh.docx');
  const kiemTra = (i: number, chua: string) => {
    if (!chuCua(e[i]).includes(chua)) throw new Error(`Mẫu Đa Ngành khác dự kiến ở phần tử ${i}: cần "${chua}"`);
  };
  kiemTra(2, 'Đề số 01');
  kiemTra(4, 'Câu 1');
  kiemTra(7, '***');
  kiemTra(31, 'Đáp án Đề số 01');
  kiemTra(33, 'Câu 1');
  kiemTra(37, 'Hết');

  for (const bang of [e[0], e[29]]) {
    themCuoiDoan(doc, timDoan(bang, (t) => t.startsWith('HỘI ĐỒNG THI HỌC KỲ')), '{hoc_ky}');
    themCuoiDoan(doc, timDoan(bang, (t) => t === 'Năm học:'), ' {nam_hoc}');
    themCuoiDoan(doc, timDoan(bang, (t) => t === 'Môn/MĐ:'), ' {hoc_phan}');
    themCuoiDoan(doc, timDoan(bang, (t) => t === 'Lớp:'), ' {lop}');
    themCuoiDoan(doc, timDoan(bang, (t) => t === 'Ngày thi:'), ' {ngay_thi}');
    thayTrongKhoi(timDoan(bang, (t) => t.startsWith('Thời gian làm bài')), '...', '{thoi_gian}');
  }
  thayTrongKhoi(e[2], '01', '{so_de}');
  thayTrongKhoi(e[31], '01', '{so_de}');

  const mauCau = e[4];
  const moi: Element[] = [
    doanChu(doc, '{#de}'),
    doanNgatTrang(doc),
    ...e.slice(0, 4),
    ...khoiCauHoi(doc, mauCau),
    e[7],
    e[8],
    doanChu(doc, '{/de}'),
    doanChu(doc, '{#de}'),
    doanNgatTrang(doc),
    ...e.slice(29, 33),
    ...khoiDapAn(doc, mauCau),
    e[36],
    e[37],
    doanChu(doc, '{/de}'),
  ];
  ghiMau(zip, doc, body, moi, 'danganh.docx');
}

mauTCHN();
mauTCHN(true);
mauDaNganh();
