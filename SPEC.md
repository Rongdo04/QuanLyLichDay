# ĐẶC TẢ PHẦN MỀM: QUẢN LÝ GIẢNG DẠY CÁ NHÂN

> **Dành cho Claude Code:** Đây là bản đặc tả đầy đủ. Đặt file này ở thư mục gốc dự án, đọc hết trước khi code, làm lần lượt theo các **Giai đoạn** ở mục 11 và dừng lại sau mỗi giai đoạn để người dùng kiểm tra. Mọi giao diện, thông báo và tên cột Excel phải bằng **tiếng Việt có dấu**.
>
> **Xem mục 14** cho các điểm đã điều chỉnh sau khi đối chiếu file Excel thật (22/10/2026). Mục 14 được ưu tiên hơn các mục khác khi có mâu thuẫn.

---

## 1. Bối cảnh

- **Người dùng duy nhất:** một giáo viên. Họ tên, mã GV và số điện thoại nhập trong trang Cài đặt.
- Thầy dạy thỉnh giảng tại nhiều trường trung cấp (TC GTCT, TC GTVT, TC Đa Ngành, TC Hà Nội…). Mỗi trường có nhiều lớp/học phần.
- Hiện tại thầy theo dõi bằng nhiều file Excel, mỗi trường một file và mỗi lớp một sheet. Thầy đánh dấu `x` vào cột Sáng/Chiều cho mỗi buổi dạy, rồi tính tiền bằng công thức.
- **Mục tiêu:**
  1. Nhập dữ liệu ở một nơi duy nhất.
  2. Tự sinh lịch dạy.
  3. Xem tổng hợp tiền và số buổi.
  4. **Xuất Excel đúng mẫu cũ** để nộp cho trường.
- **Phạm vi:** chạy local trên một máy, không đăng nhập, không cần mạng.

## 2. Công nghệ

| Phần | Công nghệ |
|---|---|
| Runtime | Node.js ≥ 20 (LTS) |
| Backend | Express 4, `better-sqlite3`, `exceljs`, `zod` (validate), `dayjs` |
| Frontend | React 18 + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS |
| Database | SQLite, một file `data/giangday.db` |
| Ngôn ngữ | TypeScript cho cả server và client |
| Chạy | `npm run dev` (dev, chạy cả 2 phần), `npm start` (build client và để Express phục vụ luôn file tĩnh, một cổng duy nhất **http://localhost:5173** hoặc 3000) |

Dùng **npm workspaces** (monorepo). Không dùng ORM nặng. Viết SQL thuần qua `better-sqlite3` và tách một tầng `repositories/`.

## 3. Cấu trúc thư mục

```
quan-ly-giang-day/
├── package.json              # workspaces: server, client
├── SPEC.md                   # file này
├── data/
│   ├── giangday.db           # tự tạo khi chạy lần đầu
│   └── backups/              # bản sao lưu tự động
├── server/
│   ├── src/
│   │   ├── index.ts          # khởi động Express
│   │   ├── db/
│   │   │   ├── connection.ts
│   │   │   ├── migrations/   # 001_init.sql, ...
│   │   │   └── migrate.ts
│   │   ├── repositories/     # truong, lop, buoi, diaDiem, caiDat
│   │   ├── services/
│   │   │   ├── tinhTien.ts       # mọi quy tắc tính tiền (mục 5)
│   │   │   ├── sinhLich.ts       # sinh danh sách ngày (mục 6.3)
│   │   │   ├── xuatExcel.ts      # mục 8
│   │   │   └── nhapExcel.ts      # mục 9
│   │   ├── routes/           # mục 7
│   │   └── utils/thu.ts      # đổi ngày sang "Thứ 2"…"CN"
│   └── tests/                # vitest
└── client/
    └── src/
        ├── pages/            # mục 6
        ├── components/
        ├── api/              # hàm gọi API + kiểu dữ liệu
        └── lib/format.ts     # định dạng tiền, ngày
```

## 4. Cơ sở dữ liệu (SQLite)

Quy ước: ngày lưu dạng chuỗi `YYYY-MM-DD`. **Tiền lưu đơn vị nghìn đồng** dạng số nguyên, giống file Excel cũ (400 = 400.000đ). Bật `PRAGMA foreign_keys = ON`.

```sql
-- 001_init.sql

CREATE TABLE cai_dat (               -- thông tin giáo viên & cấu hình (key-value)
  khoa   TEXT PRIMARY KEY,
  gia_tri TEXT NOT NULL
);
-- seed: ten_gv='<họ tên GV>', ma_gv='<mã GV>', sdt='<số điện thoại>',
--       gio_sang='07h30', gio_chieu='13h30', nam_hoc='2026-2027'

CREATE TABLE truong (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ma         TEXT NOT NULL UNIQUE,     -- 'GTCT', 'GTVT', 'DANGANH', 'HN'
  ten        TEXT NOT NULL,            -- 'Trường Trung cấp Giao thông Công chính'
  ghi_chu    TEXT,
  da_an      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dia_diem (              -- nơi dạy, quyết định tiền di chuyển
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ten_ngan    TEXT NOT NULL UNIQUE,    -- 'Thạch Thất' (ghi vào cột Ghi chú khi xuất)
  ten_day_du  TEXT,                    -- 'Trung tâm GDNN-GDTX Thạch Thất - Cơ sở 2'
  tien_dc     INTEGER NOT NULL DEFAULT 0  -- nghìn đồng / ngày, VD 66
);
-- seed: ('Thạch Thất', 'Trung tâm GDNN-GDTX Thạch Thất - Cơ sở 2', 66),
--       ('Chương Mỹ', NULL, 75)

CREATE TABLE lop (                   -- một lớp + một học phần = một sheet Excel
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  truong_id       INTEGER NOT NULL REFERENCES truong(id),
  dia_diem_id     INTEGER REFERENCES dia_diem(id),   -- NULL = không có tiền DC
  ten_sheet       TEXT NOT NULL,       -- 'AutoCad_TT' (≤ 31 ký tự, không chứa : \ / ? * [ ])
  ma_lop          TEXT,                -- 'CT.10T1'
  lop_van_hoa     TEXT,                -- '11A6'
  hoc_phan        TEXT NOT NULL,       -- 'Vẽ kỹ thuật và Autocad'
  so_buoi_ke_hoach INTEGER,            -- 15 (đơn vị: buổi = 1 ô sáng hoặc chiều)
  don_gia         INTEGER NOT NULL,    -- nghìn đồng / buổi: 350, 400, 450
  lich_phan_cong  TEXT,                -- 'Chiều T4 và ngày T7. Bắt đầu từ chiều thứ 4 28/10/2026'
  ngay_bat_dau    TEXT,
  ngay_ket_thuc   TEXT,
  trang_thai      TEXT NOT NULL DEFAULT 'dang_day',  -- 'dang_day' | 'hoan_thanh' | 'tam_dung'
  thu_tu          INTEGER NOT NULL DEFAULT 0,        -- thứ tự sheet khi xuất
  tao_luc         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE buoi (                  -- một dòng = một NGÀY của một lớp
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lop_id      INTEGER NOT NULL REFERENCES lop(id) ON DELETE CASCADE,
  ngay        TEXT NOT NULL,           -- 'YYYY-MM-DD'
  sang        INTEGER NOT NULL DEFAULT 0,  -- 1 = đã dạy buổi sáng
  chieu       INTEGER NOT NULL DEFAULT 0,
  co_tien_dc  INTEGER NOT NULL DEFAULT 1,  -- cho phép tắt tiền DC ngày đó
  ghi_chu     TEXT,                    -- ghi chú thêm (nghỉ, dạy bù...)
  UNIQUE (lop_id, ngay)
);
CREATE INDEX idx_buoi_ngay ON buoi(ngay);
```

Một dòng `buoi` mà `sang = 0` và `chieu = 0` là **ngày đã lên lịch nhưng chưa dạy hoặc nghỉ**. Dòng này vẫn hiển thị và vẫn được xuất ra Excel, giống file cũ có những ngày để trống.

## 5. Quy tắc nghiệp vụ (đặt hết trong `services/tinhTien.ts` và viết unit test)

Các quy tắc dưới đây được suy ra trực tiếp từ công thức trong file Excel hiện tại:

| Đại lượng | Công thức cũ trong Excel | Quy tắc trong phần mềm |
|---|---|---|
| **Số buổi** | `COUNTA(C5:D…)` | Tổng số ô Sáng và Chiều có đánh dấu. Một ngày dạy cả sáng lẫn chiều tính **2 buổi**. |
| **Tiền dạy** | `COUNTA(...)*400` | `số buổi × lop.don_gia` |
| **Tiền DC** (di chuyển) | `SWITCH(E5,"Thạch Thất",66,"Chương Mỹ",75,0)` cho **mỗi dòng ngày** | Với mỗi ngày có **ít nhất 1 buổi đã dạy** (`sang OR chieu`) và `co_tien_dc = 1`: cộng `dia_diem.tien_dc` của lớp. Tính **theo ngày, không theo buổi**. Ngày dạy cả sáng và chiều chỉ tính 1 lần. |
| **Tổng** | `SUM(F5:F…, G5)` | `Tiền dạy + Σ Tiền DC` |
| **Tiến độ** | – | `số buổi đã dạy / so_buoi_ke_hoach` |

**Khác biệt cần lưu ý:** file cũ tính tiền DC cho mọi dòng có ghi "Thạch Thất", kể cả ngày chưa dạy. Phần mềm chỉ tính cho ngày đã dạy. Khi xuất Excel, cột Tiền DC ghi giá trị số đã tính (xem mục 8), và **chỉ điền chữ địa điểm vào cột Ghi chú với những ngày đã dạy**, để file Excel khớp với phần mềm.

**Thứ trong tuần** (`utils/thu.ts`): Thứ Hai → `"Thứ 2"`, …, Thứ Bảy → `"Thứ 7"`, Chủ nhật → `"CN"`. Không dùng `WEEKDAY()` thô, vì Chủ nhật sẽ ra "Thứ 1".

**Định dạng hiển thị trên giao diện:** tiền hiển thị theo đồng đầy đủ, ví dụ `6.000.000 đ` (lấy giá trị nghìn đồng nhân 1000). Ngày hiển thị dạng `dd/mm/yyyy`.

**Kiểm tra dữ liệu bằng ví dụ thật** (sheet `AutoCad_TT(done)`, đơn giá 400, địa điểm Thạch Thất):
10 ngày, 15 ô `x` → Tiền dạy = 15 × 400 = **6.000**; Tiền DC = 10 × 66 = **660**; Tổng = **6.660** (nghìn đồng).

## 6. Giao diện (các trang)

Bố cục chung: thanh menu bên trái gồm Tổng quan, Chấm buổi, Lớp học, Trường, Địa điểm, Xuất/Nhập Excel, Cài đặt. Giao diện tối giản, chữ rõ, dùng được trên laptop màn 13".

### 6.1 Tổng quan (`/`)
- Bộ lọc: **tháng** (mặc định tháng hiện tại) hoặc **khoảng ngày**, kèm lọc theo trường.
- Các ô số liệu: tổng buổi, tiền dạy, tiền DC và tổng tiền trong kỳ.
- Bảng theo trường, có thể mở rộng xuống từng lớp: số buổi, tiền dạy, tiền DC, tổng.
- Danh sách **"Lịch tuần này / tuần tới"**: các ngày đã lên lịch kèm lớp, trường, sáng/chiều dự kiến.
- Danh sách lớp **sắp hoàn thành** (còn ≤ 3 buổi) và lớp **vượt số buổi kế hoạch** (để cảnh báo).

### 6.2 Chấm buổi (`/cham-buoi`), trang dùng nhiều nhất
- Chọn lớp (dropdown nhóm theo trường), hoặc chế độ **"Theo ngày"** để hiện tất cả lớp có lịch trong một ngày.
- Bảng giống hệt Excel: `Ngày | Thứ | Sáng ☐ | Chiều ☐ | Ghi chú | Tiền DC | ` và dòng tổng ở dưới.
- Bấm vào ô để tick hoặc bỏ tick, **lưu ngay** (optimistic update) mà không cần nút Lưu.
- Thêm ngày lẻ, xóa ngày, sửa ghi chú, bật/tắt tiền DC cho từng ngày.
- Phía trên bảng: thanh tiến độ `9/15 buổi`, tiền dạy, tiền DC và tổng của lớp.

### 6.3 Lớp học (`/lop`, `/lop/:id`)
- Danh sách lớp, lọc theo trường và trạng thái.
- Form tạo/sửa lớp gồm mọi trường trong bảng `lop`.
- **Trình sinh lịch** (đặt trong form lớp và có nút riêng "Sinh thêm ngày"):
  - Nhập: ngày bắt đầu, ngày kết thúc **hoặc** "đủ N buổi", các thứ trong tuần (checkbox T2…CN) và với mỗi thứ chọn dự kiến Sáng/Chiều/Cả ngày. Ví dụ: "Chiều T4, cả ngày T7".
  - Có **danh sách ngày nghỉ** (Tết, lễ) để bỏ qua. Lưu ở `cai_dat` dạng JSON và sửa được trong Cài đặt.
  - Bước xem trước: hiện danh sách ngày sẽ tạo, cho bỏ chọn từng ngày, sau đó bấm Xác nhận. Không tạo trùng ngày đã có (nhờ ràng buộc `UNIQUE`).
  - Ngày được sinh có `sang = chieu = 0`. Phần dự kiến sáng/chiều chỉ để hiển thị gợi ý: lưu thêm cột `du_kien` (`'S'|'C'|'SC'`) trong bảng `buoi` qua migration 002.
- Nút **"Nhân bản lớp"** để tạo học phần mới cho cùng lớp mà không phải nhập lại thông tin.

### 6.4 Trường, Địa điểm, Cài đặt
- CRUD đơn giản. Trang Địa điểm sửa được `tien_dc`. Trang Cài đặt gồm thông tin GV, giờ vào lớp, ngày nghỉ lễ, thư mục sao lưu và nút **Sao lưu ngay**.

### 6.5 Xuất / Nhập Excel (`/excel`)
- **Xuất:** chọn trường, chọn các lớp (mặc định tất cả lớp chưa ẩn), chọn khoảng ngày (tùy chọn), rồi tải file. Xem mục 8.
- **Xuất tổng hợp:** một file gồm sheet tổng theo trường và tháng (mục 8.4).
- **Nhập:** kéo thả file `.xlsx` cũ. Xem mục 9.

## 7. API (REST, tiền tố `/api`, JSON)

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET/POST | `/truong` | danh sách / tạo |
| PUT/DELETE | `/truong/:id` | sửa / xóa (chặn xóa nếu còn lớp, gợi ý ẩn) |
| GET/POST, PUT/DELETE | `/dia-diem`, `/dia-diem/:id` | như trên |
| GET | `/lop?truongId=&trangThai=` | danh sách lớp **kèm số liệu tổng** (số buổi, tiền) |
| POST | `/lop` | tạo |
| GET/PUT/DELETE | `/lop/:id` | chi tiết (kèm danh sách buổi) / sửa / xóa |
| POST | `/lop/:id/nhan-ban` | nhân bản |
| POST | `/lop/:id/sinh-lich/xem-truoc` | body: tham số sinh lịch → trả danh sách ngày |
| POST | `/lop/:id/sinh-lich` | body: danh sách ngày đã chọn → tạo `buoi` |
| GET | `/buoi?tu=&den=&truongId=&lopId=` | danh sách buổi theo bộ lọc |
| POST | `/buoi` | thêm ngày lẻ |
| PATCH | `/buoi/:id` | sửa `sang`, `chieu`, `ghi_chu`, `co_tien_dc` |
| DELETE | `/buoi/:id` | xóa |
| GET | `/thong-ke?tu=&den=&truongId=` | tổng hợp theo trường và lớp |
| GET | `/thong-ke/thang?namHoc=` | tổng theo từng tháng × trường |
| GET | `/xuat/truong/:id?lopIds=1,2&tu=&den=` | trả file `.xlsx` |
| GET | `/xuat/tong-hop?tu=&den=` | trả file `.xlsx` tổng hợp |
| POST | `/nhap/xem-truoc` (multipart) | phân tích file và trả về dữ liệu đọc được |
| POST | `/nhap/xac-nhan` | ghi dữ liệu đã xem trước vào DB |
| GET/PUT | `/cai-dat` | đọc / ghi cấu hình |
| POST | `/sao-luu` | copy `giangday.db` sang `data/backups/giangday_YYYYMMDD_HHmmss.db` |

Mọi body đều validate bằng `zod`. Lỗi trả về `{ loi: "thông báo tiếng Việt" }` kèm mã HTTP phù hợp.

## 8. Xuất Excel (`services/xuatExcel.ts`, dùng `exceljs`), yêu cầu quan trọng nhất

### 8.1 Tên file
`THỐNG KÊ GIẢNG DẠY TRƯỜNG <MÃ TRƯỜNG>_<năm học>.xlsx`, ví dụ `THỐNG KÊ GIẢNG DẠY TRƯỜNG GTCT_2026-2027.xlsx` (giống tên file hiện tại). Đặt header `Content-Disposition` có encode UTF-8 (`filename*=UTF-8''...`).

### 8.2 Một lớp = một sheet, theo đúng bố cục sau
Tên sheet lấy từ `lop.ten_sheet`, theo thứ tự `thu_tu`. Bố cục chuẩn hóa theo mẫu "có dòng tiêu đề 1" (giống sheet `TinHọcVPNC`, `Quản trị mạng_AK`, `AutoCad_TT(done)`):

```
      A            B        C       D        E           F          G          H        I  J   K
1   [A1:E1 gộp — để trống, viền mảnh, cao 16.5]
2   NGÀY(A2:A4) THỨ(B2:B4) Buổi (C2:D2)     Ghi chú     Tiền DC
3                          Sáng   Chiều    (E2:E4)     (F2:F4)
    (C3:C4)  (D3:D4)
4                                                                Tiền Dạy   Tổng      Địa điểm: …
5   29/09/2026  Thứ 3     x       x        Thạch Thất  =SWITCH…   =COUNTA…  =SUM(…)   Lớp: …
6   06/10/2026  Thứ 3                                  =SWITCH…                       Học phần: … (N buổi)
7   …                                                                                 Lịch phân công: …
8                                                                                     Thời gian vào lớp: …
9                                                                                     Giáo viên: :<mã GV> <họ tên GV>: <SĐT>
```

**Chi tiết từng ô:**

| Ô / vùng | Nội dung | Định dạng |
|---|---|---|
| A1:E1 | gộp, trống | viền mảnh |
| A2:A4 gộp | `NGÀY` | đậm, căn trái, giữa dọc |
| B2:B4 gộp | `THỨ` | đậm, căn giữa |
| C2:D2 gộp | `Buổi` | đậm, căn giữa |
| C3:C4 gộp / D3:D4 gộp | `Sáng` / `Chiều` | đậm, căn giữa |
| E2:E4 gộp | `Ghi chú` | đậm, căn trái |
| F2:F4 gộp | `Tiền DC` | thường, căn giữa |
| G4 / H4 | `Tiền Dạy` / `Tổng` | thường, căn trái, **không viền** |
| A5↓ | ngày (kiểu Date thật) | `dd/mm/yyyy`, căn trái |
| B5↓ | **chuỗi giá trị** `Thứ 3` / `CN` (không dùng công thức WEEKDAY) | căn trái |
| C5↓, D5↓ | `x` nếu đã dạy, trống nếu không | căn giữa |
| E5↓ | `dia_diem.ten_ngan` nếu ngày đó đã dạy và lớp có địa điểm, nối thêm `buoi.ghi_chu` nếu có (`Thạch Thất - dạy bù`) | căn trái |
| F5↓ | **giá trị số** tiền DC đã tính cho ngày đó (ví dụ `66`); để trống nếu bằng 0. Không dùng công thức `SWITCH` như file cũ, vì hàm này cần Excel 2019 trở lên và hay lỗi trên bản cũ hoặc LibreOffice. | căn giữa |
| G5 | công thức `=COUNTA(C5:D{last})*{don_gia}` kèm `result` đã tính sẵn | `#,##0`, căn giữa |
| H5 | công thức `=SUM(F5:F{last},G5)` kèm `result` | `#,##0`, căn trái |
| K4…K9 | khối thông tin, mỗi dòng 1 ô (xem dưới) | Times New Roman 13, căn trái, không viền |

`{last}` là dòng dữ liệu cuối cùng thực tế. **Không dùng vùng cứng** như `D110`.

**Khối thông tin (cột K, bắt đầu K4):**
```
Địa điểm: {dia_diem.ten_day_du}
Lớp: {ma_lop} (Lớp văn hóa: {lop_van_hoa})
Học phần: {hoc_phan} ({so_buoi_ke_hoach} buổi)
Lịch phân công: {lich_phan_cong}            ← bỏ dòng nếu trống
Thời gian vào lớp: Sáng: {gio_sang} - Chiều: {gio_chieu}
Giáo viên: :{ma_gv} {ten_gv}: {sdt}
```

**Định dạng chung:** font **Times New Roman 13** cho toàn bộ sheet. Viền mảnh (`thin`) cho vùng A1:F{last}. Độ rộng cột: A 12.8, B 12.8, C 9.1, D 9.1, E 12.9, F 11.5, G 10.1, H 10.3, I 14.4, J 9.1, K 60. Dọc khổ A4 (portrait), fit chiều ngang 1 trang.

**Lưu ý:** các giá trị tiền **giữ đơn vị nghìn đồng** như file cũ (400, 66).

### 8.3 Kiểm thử xuất
Viết test: xuất một lớp mẫu, dùng `exceljs` đọc lại, rồi kiểm tra các ô gộp, tiêu đề, giá trị ngày, `x`, công thức G5/H5, và giá trị `result` khớp với `tinhTien.ts`. Mở thử bằng LibreOffice headless (nếu có) để chắc chắn file không lỗi.

### 8.4 File tổng hợp
- Sheet `Tổng hợp`: các cột Trường | Lớp | Học phần | Số buổi KH | Đã dạy | Đơn giá | Tiền dạy | Tiền DC | Tổng, cuối bảng có dòng tổng.
- Sheet `Theo tháng`: hàng là tháng (09/2026…), cột là trường, giá trị là tổng tiền.
- Định dạng tiền `#,##0`, ghi chú rõ ở dòng đầu: *"Đơn vị: nghìn đồng"*.

## 9. Nhập Excel cũ (`services/nhapExcel.ts`)

Mục đích: đưa dữ liệu từ các file hiện có vào hệ thống **một lần**.

Thuật toán cho mỗi sheet:
1. Tìm ô có giá trị `NGÀY` ở cột A (có thể ở dòng 1 hoặc dòng 2, vì file cũ có 2 kiểu). Dòng dữ liệu đầu tiên = dòng đó + 3.
2. Đọc từ dòng đầu tiên trở xuống cho đến khi cột A không còn là ngày. Mỗi dòng gồm: ngày (A), sáng (C có chữ khác rỗng), chiều (D), ghi chú (E).
3. Đọc đơn giá từ công thức ô G đầu tiên bằng regex `\*(\d+)\s*$` trên chuỗi công thức `=COUNTA(...)*400`.
4. Quét các cột I…M tìm các dòng có tiền tố `Địa điểm:`, `Lớp:`, `Học phần:`, `Lịch phân công:` và tách ra:
   - `Lớp: CT.10T1 (Lớp văn hóa: 11A6)` → `ma_lop = CT.10T1`, `lop_van_hoa = 11A6`
   - `Học phần: Tin học (9 buổi)` → `hoc_phan = Tin học`, `so_buoi_ke_hoach = 9`
5. Địa điểm: lấy giá trị cột E phổ biến nhất (ví dụ "Thạch Thất") rồi khớp với `dia_diem.ten_ngan`.
6. Tên sheet chứa `(done)` → `trang_thai = 'hoan_thanh'`, đồng thời bỏ `(done)` khỏi `ten_sheet`.
7. Trường: người dùng chọn ở bước xem trước. Gợi ý từ tên file bằng regex `TRƯỜNG\s+(.+?)[-_ ]*_?\d{4}`.

**Bước xem trước** hiển thị bảng các lớp và số ngày/buổi đọc được, cho sửa tên, đơn giá và trường, rồi mới bấm **Xác nhận**. Nếu trùng (cùng trường + `ten_sheet`) thì hỏi: *Bỏ qua / Ghi đè / Tạo mới*.

**Phát hiện file trùng:** tính SHA-256 của file. Nếu đã nhập file có cùng hash thì cảnh báo.

**Dữ liệu mong đợi khi nhập các file hiện có:** xem bảng đã cập nhật ở mục 14.

## 10. Yêu cầu phi chức năng

- **Sao lưu tự động:** mỗi lần khởi động server, nếu bản sao lưu gần nhất đã cũ hơn 24 giờ thì copy DB vào `data/backups/` và giữ 30 bản mới nhất.
- **Di chuyển dữ liệu:** toàn bộ dữ liệu nằm trong thư mục `data/`. Copy thư mục này sang máy khác là chạy được.
- **Khởi động nhanh:** thêm file `start.bat` (Windows) và `start.sh` để chạy `npm start` và tự mở trình duyệt.
- **Không đăng nhập**, server chỉ lắng nghe `127.0.0.1`.
- **Test:** `vitest` cho `tinhTien`, `sinhLich`, `thu`, `xuatExcel` và `nhapExcel`. Lệnh `npm test` phải chạy xanh trước khi kết thúc mỗi giai đoạn.
- **Mã nguồn:** đặt tên biến theo tiếng Việt không dấu (`tienDay`, `soBuoi`) cho thống nhất với nghiệp vụ. Comment ngắn bằng tiếng Việt.

## 11. Kế hoạch làm theo giai đoạn

| GĐ | Nội dung | Tiêu chí hoàn thành |
|---|---|---|
| **1** | Khởi tạo monorepo, DB + migration + seed, `tinhTien`, `thu`, `sinhLich` kèm test | `npm test` xanh; ví dụ AutoCad ra đúng 6.000 / 660 / 6.660 |
| **2** | API CRUD trường, địa điểm, lớp, buổi + thống kê | Gọi được bằng curl; validate lỗi tiếng Việt |
| **3** | Giao diện: Trường, Địa điểm, Lớp (có trình sinh lịch), Chấm buổi | Tạo lớp "Mạng Máy tính_Thanh Trì", sinh lịch T5+T6 từ 29/10 đến 04/12/2026 ra đúng 12 ngày |
| **4** | Xuất Excel theo trường | File xuất ra mở bằng Excel, nhìn giống mẫu cũ; test đọc lại xanh |
| **5** | Nhập Excel cũ (xem trước, xác nhận, phát hiện trùng) | Nhập được 4 file hiện có, số liệu khớp bảng ở mục 14 |
| **6** | Trang Tổng quan, xuất tổng hợp, sao lưu, script khởi động | Chạy `start.bat` là dùng được |

## 12. Ngoài phạm vi (không làm ở phiên bản này)
- Nhiều giáo viên, đăng nhập, phân quyền.
- Đồng bộ đám mây, ứng dụng điện thoại.
- In hợp đồng, thanh toán, hóa đơn.

## 13. Câu hỏi còn mở (hỏi lại người dùng nếu gặp)
1. Tiền DC của các trường không ở Thạch Thất/Chương Mỹ (GTCT, GTVT…) có không? Hiện đang để 0.
2. Có cần xuất file theo **tháng** (chỉ các ngày trong tháng) để nộp thanh toán hằng tháng không? Đã hỗ trợ qua tham số `tu`/`den`, cần xác nhận mẫu.
3. ~~Trường thứ 5 là trường nào?~~ → Chỉ seed 4 trường; thầy tự thêm sau.

## 14. Điều chỉnh sau khi đối chiếu file thật (22/10/2026)

1. **File GTCT và TC Đa Ngành không còn giống nhau từng byte.** Nội dung thực tế:
   - GTCT: sheet `Quản trị mạng`, đơn giá **380**, Ghi chú "Xuân Mai".
   - TC Đa Ngành: `Quản trị mạng_AK` và `Mạng Máy tính_Thanh Trì` (đơn giá 450).
   Test phát hiện trùng hash dùng cùng một file nhập 2 lần.
2. **Địa điểm "Xuân Mai"** được seed với `tien_dc = 0` (thầy xác nhận).
3. Khối thông tin trong file cũ nằm ở cột **J, K hoặc L**, bắt đầu từ dòng 4–6 → khi nhập quét cột I…M ở mọi dòng.
4. Cột B file cũ là công thức `="Thứ "&WEEKDAY(A5)`, cột F là công thức mảng SWITCH → bỏ qua khi nhập.
5. Tên file thật là `THỐNG KÊ GỜ GIẢNG TRƯỜNG …` (gõ nhầm "GỜ"). Regex gợi ý trường vẫn dùng được; ánh xạ gợi ý → mã: `GTCT`→GTCT, `TCGTVT`→GTVT, `TC Đa Ngành`→DANGANH, `TCHN`→HN. Tên file **xuất** vẫn theo mục 8.1.
6. Chỉ seed 4 trường: GTCT, GTVT, DANGANH, HN.
7. **Cổng:** dev = Vite 5173 + API 3000 (Vite proxy `/api`); `npm start` = Express phục vụ cả giao diện và API tại **http://localhost:3000** (lắng nghe 127.0.0.1).
8. Ngày nghỉ lễ trong `cai_dat.ngay_nghi` là mảng JSON, mỗi phần tử `{ "tu": "YYYY-MM-DD", "den": "YYYY-MM-DD" | null, "ten": "…" }` (cho phép khoảng ngày, ví dụ Tết).

9. **Nhập:** khối thông tin có thể nằm trong một ô nhiều dòng, hoặc một dòng dài nối các nhãn ("Học phần: … Lớp: … Lịch phân công: …"). Bộ đọc tách theo các nhãn. Ngày bị lặp trong một sheet được gộp lại. Địa điểm là giá trị cột E xuất hiện ở ít nhất một nửa số dòng. Lịch sử nhập lưu ở bảng `nhap_file` (migration 003), có endpoint `GET /nhap/lich-su`.
10. **Sinh lịch:** API xem trước trả thêm `boQua` (ngày nghỉ, ngày đã có). Trình sinh lịch tự điền thứ và ngày bắt đầu bằng cách đọc chuỗi "Lịch phân công" (`utils/lichPhanCong.ts`). Sau khi tạo, phần mềm có thể ghi lại "Lịch phân công" theo mẫu cũ.
11. **Dùng chung code nghiệp vụ:** client import trực tiếp `tinhTien.ts`, `thu.ts`, `lichPhanCong.ts` từ server để cập nhật số liệu ngay khi tick (optimistic), không chép lại công thức.
12. **Sao lưu:** dùng `VACUUM INTO`, an toàn cả khi DB đang ghi ở chế độ WAL. Có thêm `GET /sao-luu` để liệt kê các bản. Thời điểm của bản sao lưu đọc từ tên file.
13. **In ấn:** đúng như mục 8.2 (A4 dọc, vừa 1 trang ngang). Vì cột K rộng 60 nên bảng in ra nhỏ khoảng 50%. Nếu muốn in bảng cỡ chữ thường thì có thể giới hạn vùng in A:H. Điểm này cần thầy xác nhận.

**Dữ liệu mong đợi khi nhập các file hiện có** (test tích hợp):

| File | Sheet | Số ngày | Ô `x` | Đơn giá | Địa điểm |
|---|---|---|---|---|---|
| TCGTVT | TinHọcVPNC | 5 | 2 | 350 | – |
| GTCT | Quản trị mạng | 10 | 9 | 380 | Xuân Mai |
| TC Đa Ngành | Quản trị mạng_AK | 9 | 7 | 450 | – |
| TC Đa Ngành | Mạng Máy tính_Thanh Trì | 12 | 0 | 450 | – |
| TCHN | AutoCad_TT(done) | 10 | 15 | 400 | Thạch Thất |
| TCHN | Thiết kế Web_TT | 12 | 0 | 400 | Thạch Thất |
| TCHN | Tin Học_TT | 9 | 0 | 400 | Thạch Thất |

## 15. Bổ sung: Sinh đề thi lý thuyết (24/10/2026)

Yêu cầu của thầy: sinh đề thi tự động theo môn và theo trường, đúng mẫu Word của từng trường. Trường nào chưa có mẫu thì tải file Word lên sau. Đề là đề lý thuyết. Thầy đã chọn: **ngân hàng câu hỏi kết hợp AI soạn**, dạng **tự luận**.

- **Dữ liệu** (migration `004_de_thi.sql`):
  - `mon`: môn và ngân hàng câu hỏi, khớp với `lop.hoc_phan` theo tên, không phân biệt dấu cách hay hoa thường.
  - `cau_hoi`: chủ đề, mức độ dễ/trung bình/khó, điểm gợi ý, nội dung, đáp án, số lần đã dùng.
  - `mau_de`: file Word theo trường, cấu trúc điểm mặc định, thời gian làm bài.
  - `de_thi`: lịch sử đề đã sinh, lưu bản chụp nội dung câu hỏi.
- **Mẫu Word** dùng docxtemplater với các ô `{…}`. Ba mẫu có sẵn trong `server/mau-de/`, tạo từ hai file thầy gửi bằng `server/scripts/taoMauDe.ts`. Mỗi đề và mỗi trang đáp án bắt đầu trang mới (ngắt trang), không dùng dòng trống như file gốc.
  - **Hà Nội:** từ file `CT.10T1 - CT14 Thiết kế Web (Đề thi & Đáp án).docx`.
  - **Đa Ngành:** từ file `15.13. Mẫu đề thi, đáp án.doc`, chuyển sang `.docx` bằng Word.
  - **Mẫu chung:** lấy bố cục mẫu Hà Nội, thay tên trường bằng ô `{truong_in_hoa}`.
- **Bốc câu** (`services/bocDe.ts`):
  - Trong một đề không lặp câu.
  - Giữa các đề không dùng chung câu nếu ngân hàng đủ câu.
  - Ưu tiên đúng mức độ, đúng điểm, khác chủ đề và câu ít được dùng.
  - Thiếu câu thì cảnh báo, không âm thầm bỏ qua.
- **AI** (`services/aiSoanCau.ts`): hỗ trợ hai nhà cung cấp, chọn trong Cài đặt. **Mặc định Gemini `gemini-3.8-flash`** (có gói miễn phí, gọi bằng SDK `@google/genai` với `responseJsonSchema`). Claude là lựa chọn trả phí. Mỗi nhà cung cấp có key riêng (`bi_mat_gemini_api_key`, `bi_mat_anthropic_api_key`). Chi tiết phần Claude:
  - Dùng Claude `claude-opus-5-5` với structured output, effort `medium`, và `fallbacks: "default"` (máy chủ tự chạy lại bằng mô hình dự phòng nếu bộ lọc an toàn từ chối nhầm).
  - Gửi kèm đề cương môn và các câu đã có để tránh trùng.
  - Kết quả chỉ là bản nháp; thầy duyệt rồi mới lưu.
  - API key lưu trong `cai_dat` (khóa `bi_mat_…`), không trả ra qua `/api/cai-dat`. Key chỉ được lưu sau khi gọi thử thành công.
- **Tên file:** `{lớp} - {mã HP} {học phần} (Đề thi & Đáp án).docx`, giống tên file mẫu của thầy.

