-- 009: đánh dấu trường đã thanh toán tiền cho lớp (0/1)
ALTER TABLE lop ADD COLUMN da_thanh_toan INTEGER NOT NULL DEFAULT 0;
