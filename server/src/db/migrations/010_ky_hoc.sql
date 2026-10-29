-- 010: kỳ học do người dùng tự tạo (VD "HK1 2026-2027"); mỗi lớp thuộc tối đa một kỳ
CREATE TABLE ky_hoc (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ten           TEXT NOT NULL UNIQUE,
  ngay_bat_dau  TEXT,                 -- YYYY-MM-DD, dùng để gợi ý kỳ cho lớp mới
  ngay_ket_thuc TEXT
);
ALTER TABLE lop ADD COLUMN ky_hoc_id INTEGER REFERENCES ky_hoc(id) ON DELETE SET NULL;
