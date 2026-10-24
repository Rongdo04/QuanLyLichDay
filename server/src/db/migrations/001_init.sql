-- 001_init.sql

CREATE TABLE cai_dat (               -- thông tin giáo viên & cấu hình (key-value)
  khoa    TEXT PRIMARY KEY,
  gia_tri TEXT NOT NULL
);

CREATE TABLE truong (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ma         TEXT NOT NULL UNIQUE,
  ten        TEXT NOT NULL,
  ghi_chu    TEXT,
  da_an      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dia_diem (              -- nơi dạy, quyết định tiền di chuyển
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ten_ngan    TEXT NOT NULL UNIQUE,
  ten_day_du  TEXT,
  tien_dc     INTEGER NOT NULL DEFAULT 0  -- nghìn đồng / ngày
);

CREATE TABLE lop (                   -- một lớp + một học phần = một sheet Excel
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  truong_id        INTEGER NOT NULL REFERENCES truong(id),
  dia_diem_id      INTEGER REFERENCES dia_diem(id),
  ten_sheet        TEXT NOT NULL,
  ma_lop           TEXT,
  lop_van_hoa      TEXT,
  hoc_phan         TEXT NOT NULL,
  so_buoi_ke_hoach INTEGER,
  don_gia          INTEGER NOT NULL,   -- nghìn đồng / buổi
  lich_phan_cong   TEXT,
  ngay_bat_dau     TEXT,
  ngay_ket_thuc    TEXT,
  trang_thai       TEXT NOT NULL DEFAULT 'dang_day',
  thu_tu           INTEGER NOT NULL DEFAULT 0,
  tao_luc          TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE buoi (                  -- một dòng = một NGÀY của một lớp
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lop_id      INTEGER NOT NULL REFERENCES lop(id) ON DELETE CASCADE,
  ngay        TEXT NOT NULL,
  sang        INTEGER NOT NULL DEFAULT 0,
  chieu       INTEGER NOT NULL DEFAULT 0,
  co_tien_dc  INTEGER NOT NULL DEFAULT 1,
  ghi_chu     TEXT,
  UNIQUE (lop_id, ngay)
);
CREATE INDEX idx_buoi_ngay ON buoi(ngay);

-- Dữ liệu ban đầu
INSERT INTO cai_dat (khoa, gia_tri) VALUES
  ('ten_gv', 'Đặng Mạnh Hiền'),
  ('ma_gv', 'G366'),
  ('sdt', '0329615098'),
  ('gio_sang', '07h30'),
  ('gio_chieu', '13h30'),
  ('nam_hoc', '2026-2027'),
  ('ngay_nghi', '[]'),
  ('thu_muc_sao_luu', '');

INSERT INTO dia_diem (ten_ngan, ten_day_du, tien_dc) VALUES
  ('Thạch Thất', 'Trung tâm GDNN-GDTX Thạch Thất - Cơ sở 2', 66),
  ('Chương Mỹ', NULL, 75),
  ('Xuân Mai', NULL, 0);

INSERT INTO truong (ma, ten) VALUES
  ('GTCT', 'Trường Trung cấp Giao thông Công chính'),
  ('GTVT', 'Trường Trung cấp Giao thông Vận tải'),
  ('DANGANH', 'Trường Trung cấp Đa Ngành'),
  ('HN', 'Trường Trung cấp Hà Nội');
