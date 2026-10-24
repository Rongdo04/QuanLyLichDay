import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LoiApp } from '../utils/loi.js';

// Chuyển file Word cũ (.doc) sang .docx bằng Microsoft Word có trên máy (chỉ Windows)

const KICH_BAN = `
$ErrorActionPreference = 'Stop'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open($env:TEP_VAO, $false, $true)
  $d.SaveAs2($env:TEP_RA, 16)
  $d.Close($false)
} finally { $w.Quit() }
`;

export async function chuyenDocSangDocx(noiDung: Buffer): Promise<Buffer> {
  if (process.platform !== 'win32') {
    throw new LoiApp(400, 'Chỉ nhận file .docx. Hãy mở file trong Word và chọn Lưu thành (Save As) → .docx');
  }
  const thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'mau-de-'));
  const vao = path.join(thuMuc, 'mau.doc');
  const ra = path.join(thuMuc, 'mau.docx');
  fs.writeFileSync(vao, noiDung);
  try {
    await new Promise<void>((res, rej) => {
      // Đường dẫn truyền qua biến môi trường, không ghép vào câu lệnh
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', KICH_BAN],
        { env: { ...process.env, TEP_VAO: vao, TEP_RA: ra }, timeout: 90_000, windowsHide: true },
        (err) => (err ? rej(err) : res()),
      );
    });
    if (!fs.existsSync(ra)) throw new Error('Word không tạo được file');
    return fs.readFileSync(ra);
  } catch {
    throw new LoiApp(
      400,
      'Không chuyển được file .doc (máy cần có Microsoft Word). Hãy mở file trong Word, chọn Lưu thành (Save As) → .docx rồi tải lên lại.',
    );
  } finally {
    fs.rmSync(thuMuc, { recursive: true, force: true });
  }
}

// Nhận file mẫu tải lên: .docx dùng luôn, .doc thì chuyển đổi
export async function docFileWord(noiDung: Buffer, tenFile: string): Promise<Buffer> {
  const duoi = path.extname(tenFile).toLowerCase();
  // .docx là file zip (bắt đầu bằng "PK"); .doc là file OLE (D0 CF 11 E0)
  const laZip = noiDung[0] === 0x50 && noiDung[1] === 0x4b;
  const laOle = noiDung.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
  if (laZip) return noiDung;
  if (laOle || duoi === '.doc') return chuyenDocSangDocx(noiDung);
  throw new LoiApp(400, 'File không phải Word (.docx hoặc .doc)');
}
