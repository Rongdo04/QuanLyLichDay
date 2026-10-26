-- 007: tính tiền theo buổi (mặc định) hoặc theo tiết. Theo tiết: tiền một buổi = don_gia × tiet_moi_buoi.
-- tiet_moi_buoi lưu theo từng lớp để đổi cài đặt chung không làm thay đổi tiền của lớp cũ.
ALTER TABLE lop ADD COLUMN tinh_theo TEXT NOT NULL DEFAULT 'buoi';
ALTER TABLE lop ADD COLUMN tiet_moi_buoi INTEGER NOT NULL DEFAULT 5;
UPDATE lop SET tiet_moi_buoi = coalesce((SELECT CAST(gia_tri AS INTEGER) FROM cai_dat WHERE khoa = 'tiet_moi_buoi'), 5);
