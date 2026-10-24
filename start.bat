@echo off
chcp 65001 >nul
title Quản lý giảng dạy
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Chưa cài Node.js. Hãy tải bản LTS tại https://nodejs.org rồi chạy lại file này.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Lần đầu chạy: đang cài thư viện, vui lòng chờ vài phút...
  call npm install
  if errorlevel 1 (
    echo Cài thư viện không thành công. Hãy kiểm tra kết nối mạng rồi chạy lại.
    pause
    exit /b 1
  )
)

if not defined MO_TRINH_DUYET set MO_TRINH_DUYET=1
echo Đang khởi động phần mềm... Trình duyệt sẽ tự mở http://localhost:3000
echo Giữ cửa sổ này mở trong khi dùng. Đóng cửa sổ này để tắt phần mềm.
echo.
call npm start
pause
