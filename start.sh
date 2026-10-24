#!/usr/bin/env sh
# Khởi động phần mềm Quản lý giảng dạy (macOS / Linux)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Chưa cài Node.js. Hãy tải bản LTS tại https://nodejs.org rồi chạy lại."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Lần đầu chạy: đang cài thư viện, vui lòng chờ vài phút..."
  npm install || { echo "Cài thư viện không thành công."; exit 1; }
fi

export MO_TRINH_DUYET="${MO_TRINH_DUYET:-1}"
echo "Đang khởi động phần mềm... Trình duyệt sẽ tự mở http://localhost:3000"
echo "Nhấn Ctrl+C để tắt phần mềm."
npm start
