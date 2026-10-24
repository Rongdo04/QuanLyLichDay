-- Sinh đề thi lý thuyết (tự luận): môn học, ngân hàng câu hỏi, mẫu Word theo trường, lịch sử đề

CREATE TABLE mon (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ten        TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- 'Thiết kế Web' (khớp với lop.hoc_phan)
  ma         TEXT,                                  -- mã học phần, VD 'CT14'
  nganh      TEXT NOT NULL DEFAULT 'Công nghệ thông tin',
  trinh_do   TEXT NOT NULL DEFAULT 'Trung cấp',
  de_cuong   TEXT,                                  -- nội dung / đề cương môn, AI bám theo khi soạn câu hỏi
  tao_luc    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE cau_hoi (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mon_id        INTEGER NOT NULL REFERENCES mon(id) ON DELETE CASCADE,
  chu_de        TEXT,                                -- chương / chủ đề
  muc_do        TEXT NOT NULL DEFAULT 'tb',          -- 'de' | 'tb' | 'kho'
  diem          REAL,                                -- điểm gợi ý
  noi_dung      TEXT NOT NULL,
  dap_an        TEXT NOT NULL DEFAULT '',            -- ý chính + thang điểm
  nguon         TEXT NOT NULL DEFAULT 'tay',         -- 'tay' | 'ai'
  so_lan_dung   INTEGER NOT NULL DEFAULT 0,
  lan_dung_cuoi TEXT,
  tao_luc       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_cau_hoi_mon ON cau_hoi(mon_id);

CREATE TABLE mau_de (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ten        TEXT NOT NULL,
  truong_id  INTEGER REFERENCES truong(id) ON DELETE SET NULL,  -- NULL = mẫu chung
  tep        TEXT NOT NULL,             -- 'san:tchn.docx' (có sẵn) hoặc 'tai:<tên file trong data/mau-de>'
  co_san     INTEGER NOT NULL DEFAULT 0,
  cau_truc   TEXT NOT NULL DEFAULT '[3,3,4]',   -- điểm từng câu mặc định (JSON)
  thoi_gian  INTEGER NOT NULL DEFAULT 60,       -- phút
  tao_luc    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO mau_de (ten, truong_id, tep, co_san) VALUES
  ('Mẫu Trường Trung cấp Hà Nội', (SELECT id FROM truong WHERE ma = 'HN'), 'san:tchn.docx', 1),
  ('Mẫu Trường TC Kỹ thuật Đa ngành', (SELECT id FROM truong WHERE ma = 'DANGANH'), 'san:danganh.docx', 1),
  ('Mẫu chung (các trường chưa có mẫu riêng)', NULL, 'san:chung.docx', 1);

CREATE TABLE de_thi (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mon_id      INTEGER REFERENCES mon(id) ON DELETE SET NULL,
  lop_id      INTEGER REFERENCES lop(id) ON DELETE SET NULL,
  truong_id   INTEGER REFERENCES truong(id) ON DELETE SET NULL,
  mau_de_id   INTEGER REFERENCES mau_de(id) ON DELETE SET NULL,
  ten_file    TEXT NOT NULL,
  thong_tin   TEXT NOT NULL,     -- JSON: thông tin đầu đề (học phần, lớp, thời gian…)
  noi_dung    TEXT NOT NULL,     -- JSON: các đề, mỗi đề gồm các câu (lưu bản chụp nội dung)
  tao_luc     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
