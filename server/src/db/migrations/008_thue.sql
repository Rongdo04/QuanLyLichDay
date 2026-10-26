-- 008: thuế theo trường (phần trăm), mặc định 10% cho mọi trường. Tiền đang tính là tiền nhận về;
-- trường có thuế thì cộng thêm thue% của tiền dạy (không tính trên tiền DC). VD 10%: 400 → 440 / buổi.
ALTER TABLE truong ADD COLUMN thue INTEGER NOT NULL DEFAULT 10;
