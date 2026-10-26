# Quản lý giảng dạy

Phần mềm chạy trên máy cá nhân để theo dõi lịch dạy thỉnh giảng, tính tiền dạy và tiền di chuyển, rồi xuất file Excel đúng mẫu để nộp trường. Đặc tả đầy đủ ở [SPEC.md](SPEC.md).

## Cách dùng hằng ngày

1. Nháy đúp **`start.bat`**. Lần đầu tiên phần mềm sẽ cài thư viện, mất vài phút và cần có mạng.
2. Trình duyệt tự mở **http://localhost:3000**.
3. Giữ cửa sổ đen mở trong lúc dùng. Đóng cửa sổ đó là tắt phần mềm.

Máy cần cài **Node.js bản LTS** (https://nodejs.org).

## Bắt đầu nhanh

- **Đưa dữ liệu cũ vào:** vào *Xuất / Nhập Excel*, kéo thả các file `THỐNG KÊ GỜ GIẢNG TRƯỜNG …xlsx`, kiểm tra bảng xem trước rồi bấm *Xác nhận*.
- **Lớp mới:** vào *Lớp học*, bấm *Thêm lớp*, điền thông tin rồi bấm *Tạo lớp và sinh lịch*. Chọn thứ trong tuần, xem trước rồi bấm *Xác nhận*.
- **Sau mỗi buổi dạy:** vào *Chấm buổi*, bấm vào ô Sáng hoặc Chiều. Dữ liệu được lưu ngay.
- **Nộp trường:** vào *Xuất / Nhập Excel*, chọn trường, bấm *Tải file Excel*. Chọn *Tháng này* nếu cần nộp theo tháng.

## Sinh đề thi

Vào mục **Đề thi**. Đề là đề lý thuyết tự luận, mỗi lần sinh được nhiều đề, kèm đáp án và thang điểm.

1. **Ngân hàng câu hỏi:** mỗi môn có một ngân hàng câu hỏi riêng. Môn đặt tên giống học phần của lớp để phần mềm tự nhận ra. Có 3 cách đưa câu hỏi vào:
   - **AI soạn câu hỏi:** mặc định dùng **Gemini của Google (miễn phí)**: lấy key tại https://aistudio.google.com/apikey rồi dán vào *Cài đặt → AI soạn câu hỏi*. Có thể chuyển sang Claude (trả phí). Cần có mạng. Câu AI soạn chỉ được lưu sau khi thầy đọc và duyệt.
   - **Dán câu hỏi từ Word:** chép đề cũ vào, phần mềm tự tách từng câu, điểm và đáp án.
   - **Thêm câu:** gõ từng câu bằng tay.
2. **Sinh đề:**
   - Chọn lớp. Phần mềm tự điền học phần, lớp, môn và chọn mẫu của trường.
   - Đặt số đề và điểm từng câu, chọn mức độ nếu muốn, rồi bấm *Bốc đề*.
   - Xem trước, đổi câu nếu cần, rồi bấm *Sinh file Word*.
   - Phần mềm không lặp câu trong cùng một đề, hạn chế trùng câu giữa các đề và ưu tiên câu ít được dùng.
3. **Mẫu đề theo trường:** có sẵn mẫu Trường Trung cấp Hà Nội, mẫu TC Kỹ thuật Đa ngành và một mẫu chung. Trường khác chưa có mẫu thì làm như sau:
   - Tải *Mẫu chung* về, sửa theo mẫu của trường, giữ nguyên các ô `{…}`.
   - Tải lên trong tab *Mẫu đề theo trường*. Nhận cả file `.doc`, phần mềm tự chuyển sang `.docx` nhờ Word có trên máy.
4. Các đề đã sinh được lưu trong tab *Đề đã sinh* để tải lại. Sửa ngân hàng câu hỏi sau đó không làm thay đổi đề cũ.

## Tài khoản (nhiều người dùng)

- Mở phần mềm sẽ thấy màn **đăng nhập** (bằng tên đăng nhập hoặc email). Nếu chưa có tài khoản nào thì hiện form *Tạo tài khoản*: tài khoản đầu tiên là **quản trị** và giữ toàn bộ dữ liệu đang có.
- Quản trị vào menu **Tài khoản** để tạo tài khoản cho người khác, đặt lại mật khẩu khi họ quên, hoặc khóa tài khoản. Mỗi người có dữ liệu **riêng hoàn toàn**: trường, lớp, lịch, đề thi, cài đặt, sao lưu. Không ai thấy dữ liệu của người khác.
- Mỗi người tự đổi mật khẩu trong **Cài đặt → Đổi mật khẩu**. Đăng xuất ở góc dưới thanh menu.
- **Quản trị quên mật khẩu:** trên máy chạy server, mở cửa sổ lệnh trong thư mục phần mềm và chạy
  `npm run tai-khoan -w server -- dat-lai <tên đăng nhập hoặc email> <mật khẩu mới>`.
  Xem danh sách tài khoản: `npm run tai-khoan -w server -- ds`. Tạo tài khoản: `npm run tai-khoan -w server -- tao <tên> <mật khẩu> [email] [họ tên] [--quan-tri]`.
- **Đưa lên mạng cho người ở xa dùng:** cách dễ nhất là [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), trỏ về `http://localhost:3000`. Tunnel tự có HTTPS, và server vẫn chỉ nghe trên máy này. Muốn máy khác trong mạng nội bộ vào thẳng thì chạy với `HOST=0.0.0.0`.

## Dữ liệu và sao lưu

- Toàn bộ dữ liệu nằm trong thư mục **`data/`**. Muốn chuyển sang máy khác, chỉ cần chép cả thư mục phần mềm, trong đó có `data/`.
- Mỗi lần mở phần mềm sẽ tự sao lưu vào `data/backups/` nếu bản gần nhất đã quá 24 giờ. Phần mềm giữ 30 bản mới nhất. Có thể bấm *Sao lưu ngay* hoặc đổi thư mục sao lưu trong *Cài đặt*.
- Tài khoản và phiên đăng nhập nằm trong `data/he-thong.db`. Dữ liệu của quản trị đầu tiên vẫn là `data/giangday.db`; người dùng khác ở `data/nguoi-dung/<số>/` (có `giangday.db`, `backups/`, `mau-de/` riêng).
- Mẫu đề tải lên nằm trong `data/mau-de/`. Bản sao lưu tự động chỉ chép file dữ liệu `.db`, nên khi chuyển máy hãy chép cả thư mục `data/`.
- **Khôi phục từ bản sao lưu:** tắt phần mềm, chép file `giangday_YYYYMMDD_HHmmss.db` cần dùng đè lên `data/giangday.db`, xóa hai file `giangday.db-wal` và `giangday.db-shm` nếu có, rồi mở lại.

## Dành cho người phát triển

```
npm install
npm run dev     # server :3000 (tự chạy lại khi sửa code) + giao diện Vite :5173
npm test        # vitest phía server
npm start       # build giao diện, chạy một cổng duy nhất :3000
```

Mẫu đề có sẵn nằm ở `server/mau-de/` và được tạo từ file gốc trong `server/mau-de/goc/` bằng lệnh `npx tsx scripts/taoMauDe.ts` (chạy trong thư mục `server`).

Các test nhập Excel đọc trực tiếp các file thật ở thư mục cha (`D:\Các Trường\…`). Thiếu file thì test tự bỏ qua. Có thể đổi đường dẫn bằng biến môi trường `THU_MUC_FILE_CU`.
