-- 003: lịch sử nhập file Excel cũ (phát hiện file trùng bằng SHA-256)
CREATE TABLE nhap_file (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  hash      TEXT NOT NULL,
  ten_file  TEXT NOT NULL,
  truong_id INTEGER REFERENCES truong(id) ON DELETE SET NULL,
  so_lop    INTEGER NOT NULL DEFAULT 0,
  nhap_luc  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_nhap_file_hash ON nhap_file(hash);
