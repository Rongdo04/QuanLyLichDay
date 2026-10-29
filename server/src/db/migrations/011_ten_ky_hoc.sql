-- 011: tên kỳ học tự sinh theo ngày bắt đầu (HK1_2026-2027): tháng 8–1 là HK1, tháng 2–7 là HK2.
-- Đặt lại tên các kỳ đã tạo; trùng tên (hai kỳ cùng học kỳ) thì giữ tên cũ
UPDATE OR IGNORE ky_hoc SET ten =
  CASE
    WHEN CAST(strftime('%m', ngay_bat_dau) AS INTEGER) >= 8
      THEN 'HK1_' || strftime('%Y', ngay_bat_dau) || '-' || (CAST(strftime('%Y', ngay_bat_dau) AS INTEGER) + 1)
    WHEN CAST(strftime('%m', ngay_bat_dau) AS INTEGER) = 1
      THEN 'HK1_' || (CAST(strftime('%Y', ngay_bat_dau) AS INTEGER) - 1) || '-' || strftime('%Y', ngay_bat_dau)
    ELSE 'HK2_' || (CAST(strftime('%Y', ngay_bat_dau) AS INTEGER) - 1) || '-' || strftime('%Y', ngay_bat_dau)
  END
WHERE ngay_bat_dau IS NOT NULL;
