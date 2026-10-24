-- Lịch dạy hằng tuần của lớp, VD {"4":"C","7":"SC"} = chiều thứ 4 và cả ngày thứ 7 (CN = 8).
-- Dùng để tự sinh lịch khi tạo lớp và điền sẵn khi "Sinh thêm ngày".
ALTER TABLE lop ADD COLUMN lich_tuan TEXT;
