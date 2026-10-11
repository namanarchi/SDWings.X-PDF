# SDWINGSX® · ARCHITECTURAL & BIM DOCUMENT WORKBENCH

> **Phần mềm đọc, ghép nối, tách trang và chỉnh sửa PDF chuyên nghiệp, siêu nhẹ.**  
> Giao diện chuẩn kiến trúc & OpenBIM lấy cảm hứng từ ngôn ngữ thiết kế **BD01 · Conference** và cấu trúc workbench của **storytold/pdfcraft**.

---

## 💎 Nhận Diện Thương Hiệu (Brand Identity: SDWingsX®)
Hệ thống nhận diện thương hiệu chính thức được tích hợp xuyên suốt:
- **Logo Text:** `SDWings` viết hoa chữ S, D, W bằng tone đen than đậm `#111827` (font-weight: 800) thể hiện sự vững chãi, kỹ thuật.
- **Biểu tượng chữ X đặc trưng:** Chữ `X` màu xanh dương hoàng gia (Royal Blue `#2563eb`), font-weight 900 tạo điểm nhấn công nghệ, tốc độ và tính hiện đại.
- **Ký hiệu bảo hộ ®:** Biểu tượng Registered Trademark `®` ở dạng superscript cùng gam màu xanh Royal Blue `#2563eb`.
- **Favicon & Biểu tượng:** Tệp vector SVG chuẩn hiển thị chữ `SD` đen và `X®` xanh trên tab trình duyệt.
- **Ứng dụng thương hiệu:** Xuất hiện đồng bộ tại Header chính, Khung thả file kéo thả, Thẻ thông số góc dưới, Tiêu đề cửa sổ và Khung tên bản vẽ (Title Block) của tài liệu PDF.

---

## 🎨 Ngôn Ngữ Thiết Kế & Bảng Màu (Architectural Design System)
Toàn bộ giao diện phần mềm được xây dựng tỉ mỉ theo phong cách kiến trúc tối giản:
- **Nền giấy vellum ấm (Chalk Warm Paper):** `#f2f1ec` & `#eceae4` mang lại cảm giác bản vẽ thật, dịu mắt khi làm việc lâu.
- **Thanh công cụ dạng Pill (Pill Tabs):** Bo góc nhẹ 4px, nút tối `#121212` tương phản cao kết hợp các nút sáng viền mảnh `1px solid #dcd9d2`.
- **Trạng thái hiển thị chấm tròn:** Dấu chấm tròn đặc `●` cho công cụ đang kích hoạt và vòng tròn rỗng `○` cho công cụ phụ trợ (chuẩn xác 100% theo giao diện BD01).
- **Thẻ thông tin nổi (Floating Badges):** 
  - Góc dưới trái: Thẻ định danh bản vẽ `SDWingsX® · ARCHITECTURAL SPEC` / `LV00 - Internal 3D Environment`.
  - Góc dưới phải: Phím tắt điều hướng `ALT + SCROLL TO ZOOM · DRAG TO PAN · DROP FILES ANYWHERE`.

---

## ⚡ Các Tính Năng Cốt Lõi

### 1. Trình Đọc PDF Chuyên Nghiệp & Siêu Nhẹ (Professional Reader)
- **Tốc độ phản hồi tức thì (< 1s):** Chạy 100% client-side trên trình duyệt/WebView với Web Workers, không gửi file lên bất kỳ máy chủ nào.
- **Đa chế độ xem:**
  - `CONTINUOUS`: Cuộn dọc liên tục đa trang mượt mà.
  - `SINGLE PAGE`: Trình chiếu từng trang bản vẽ.
  - `TWO-UP BOOK`: Trải rộng hai trang đối diện (Facing pages).
- **Phóng to thu nhỏ thông minh (CAD Zoom):**
  - Khớp chiều rộng (`FIT WIDTH`), Khớp toàn trang (`FIT PAGE`), Phóng to 100% tỷ lệ gốc.
  - Phóng to đến 500% hiển thị sắc nét ở độ phân giải Retina / 4K.
- **Tìm kiếm văn bản:** Quét toàn bộ nội dung PDF với số lượng kết quả và tự động chuyển trang.
- **Xoay hướng xem:** Xoay bản vẽ 90° tức thời.

### 2. Ghép Nối File (Combine PDF) Bằng Cách Kéo Thả Từ Bên Ngoài
- **Kéo thả tự do từ Windows Explorer / Desktop:** Kéo 1 hoặc nhiều file PDF từ thư mục bất kỳ thả trực tiếp vào cửa sổ phần mềm.
- **Hàng đợi ghép nối trực quan (Combine Queue):**
  - Hiển thị ảnh thu nhỏ (thumbnail trang 1), tên file, dung lượng, tổng số trang.
  - Nút di chuyển lên/xuống (▲ / ▼) để đổi thứ tự ưu tiên các tệp trong file gộp.
  - Tùy chọn khoảng trang cho từng file (ví dụ: `All` hoặc `1-3`, `5, 7-10`).
- **Thực thi 1 chạm:**
  - `GHÉP NỐI & XEM NGAY`: Mở tài liệu đã gộp trực tiếp vào bàn làm việc.
  - `TẢI FILE ĐÃ GHÉP`: Xuất tệp PDF gộp về máy.

### 3. Tách Trang & Trích Xuất (Split & Extract)
- **Tách từng trang độc lập:** Chia toàn bộ tài liệu thành các file 1 trang và tự động đóng gói vào tệp nén `.ZIP`.
- **Tách theo nhóm N trang:** Chia tài liệu thành các tập đoàn nhỏ, mỗi tập N trang.
- **Tách theo dải trang tùy biến:** Nhập các dải trang linh hoạt như `1-2; 3-5; 6-10`.
- **Trích xuất (Extract):** Chọn các trang cụ thể để gom thành 1 tài liệu mới duy nhất.

### 4. Quản Lý & Sắp Xếp Trang (Organize Pages Grid)
- **Giao diện thẻ bài (Cards on a Table):** Lấy cảm hứng từ *pdfcraft*, hiển thị toàn bộ trang dưới dạng thẻ lưới trực quan.
- **Kéo thả đổi vị trí trang:** Nhấp giữ và kéo thẻ trang đến vị trí mới.
- **Thao tác hàng loạt (Multi-select):**
  - Xoay 90° chiều kim đồng hồ / ngược chiều kim đồng hồ.
  - Nhân đôi trang (Duplicate).
  - Thêm trang trắng (Insert blank page).
  - Xóa trang đã chọn.
  - Áp dụng & lưu thay đổi trực tiếp vào tài liệu đang mở.

### 5. Ghi Chú & Hiệu Chỉnh Bản Vẽ Kỹ Thuật (CAD Annotation Studio)
- **Thước đo kích thước CAD (CAD Ruler Dimension):**
  - Đo khoảng cách điểm-đến-điểm trên bản vẽ với đường gióng và vạch chéo kiến trúc 45°.
  - Hỗ trợ đổi tỷ lệ bản vẽ CAD: `1:50`, `1:100`, `1:200`, `1:500` và đơn vị đo `mm`, `m`, `cm`.
- **Đám mây ghi chú kiến trúc (Revision Cloud):** Viền dạng vỏ sò chuẩn hồ sơ sửa đổi bản vẽ.
- **Bút vẽ tự do & Dạ quang (Ink & Highlighter):** Đánh dấu vùng cần chú ý.
- **Khung văn bản (Text Box):** Đặt ghi chú văn bản tại bất kỳ tọa độ nào.
- **Con dấu phê duyệt kiến trúc (Architectural Stamps):**
  - `APPROVED` (Xanh lục)
  - `DRAFT` (Xám)
  - `REVISED` (Xanh dương)
  - Tùy chọn con dấu văn bản tùy biến.
- **Bảng chữ ký điện tử (Digital Signature Pad):** Ký tay bằng chuột/bút stylus hoặc tải ảnh chữ ký trong suốt (PNG) để đóng dấu lên bản vẽ.
- **Lưu & Xuất vĩnh viễn:** Nhúng toàn bộ ghi chú và chữ ký vào dòng đối tượng PDF chuẩn để mở được trên Adobe Acrobat và các phần mềm khác.

### 6. Bản Vẽ Kiến Trúc Tích Hợp Sẵn (BD01 · Conference Hall)
Khi khởi động lần đầu, phần mềm tự sinh bộ hồ sơ thiết kế kiến trúc chuẩn của dự án **BD01 · Conference** (Mặt bằng tổng thể, sơ đồ phân tầng, mặt cắt âm học và bảng chỉ dẫn kỹ thuật) để bạn trải nghiệm toàn bộ tính năng ngay lập tức.

---

## 🚀 Hướng Dẫn Khởi Động

### Cách 1: Chạy 1 chạm trên Windows (Khuyến nghị)
Nhấp đúp chuột vào file:
```
start-app.bat
```
Phần mềm sẽ tự khởi động và mở trình duyệt tại địa chỉ `http://localhost:5173/`.

### Cách 2: Chạy bằng dòng lệnh (Terminal)
```bash
# Cài đặt dependencies (nếu chưa cài)
npm install

# Khởi động máy chủ phát triển
npm run dev

# Hoặc đóng gói bản phát hành độc lập
npm run build
```

---

## ⌨️ Phím Tắt Thao Tác Nhanh
- `Ctrl + O`: Mở file PDF từ máy tính
- `Ctrl + S`: Lưu & xuất tài liệu PDF
- `Ctrl + Z`: Hoàn tác ghi chú (Undo)
- `Ctrl + Y`: Làm lại ghi chú (Redo)
- `+` / `-`: Phóng to / Thu nhỏ
- `Alt + Lăn chuột`: Phóng to / Thu nhỏ mượt mà tại vị trí con trỏ
