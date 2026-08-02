# 📋 PROMPT CẬP NHẬT GOOGLE SHEET BẢNG XẾP HẠNG — Ý Niệm Điện Ảnh

> File này là "giấy tờ định dạng" + prompt gốc. Khi cần **thêm thành viên**, **cộng điểm**, hay **sửa dữ liệu**, bạn copy toàn bộ phần **PROMPT GỐC** bên dưới, thêm yêu cầu của mình vào chỗ `[YÊU CẦU CỦA BẠN]`, gửi cho bất kỳ AI nào (GPT / Gemini / DeepSeek). Nó sẽ trả về **prompt dán được cho Gemini Sheets** — bạn dán vào Gemini đang mở sheet này là xong.

---

## 🎯 THÔNG TIN SHEET (LUÔN GIỮ NGUYÊN)

| Thông tin | Giá trị |
|---|---|
| URL sheet | `https://docs.google.com/spreadsheets/d/1rFuGWw4IZxmROnP7W4k1ntEykstZZu0JP3mKexihR6E/edit` |
| Spreadsheet ID | `1rFuGWw4IZxmROnP7W4k1ntEykstZZu0JP3mKexihR6E` |
| Tên dự án | Ý Niệm Điện Ảnh (YNĐA) |
| Bảng xếp hạng | https://yniemdienanh.vercel.app/bang-xep-hang |

Sheet có **đúng 2 tab**, dữ liệu bắt đầu từ dòng 2 (dòng 1 là header, đã đóng băng).

---

## 📊 TAB 1: `Thành viên` (DANH SÁCH THÀNH VIÊN)

Header dòng 1 (giữ nguyên chính xác, không đổi tên cột):

```
STT | Họ và tên | Ban | Vai trò | Chức danh | Email | SĐT | Ghi chú
```

**Quy tắc khi thêm/sửa:**
- `STT`: đánh số liên tiếp (1, 2, 3...).
- `Họ và tên`: viết đúng tên thật, **KHÔNG đổi cách viết** giữa các lần (vì điểm sẽ cộng dồn theo đúng tên).
- `Ban`: tên ban, vd: `Nội dung`, `Sản xuất`, `Truyền thông`, `Đối ngoại`, `Hậu kỳ`, `Nhân sự`, `Marketing`, `PR`.
- `Vai trò`: **chỉ nhận 2 giá trị** → `Core` (ban tổ chức) hoặc `Thành viên`.
- `Chức danh`: để trống nếu không có; nếu có thì dùng đúng các từ như `Trưởng ban`, `Phó ban`, `Trưởng nhóm`, `Phó trưởng nhóm`. ⚠️ Lưu ý: người có Chức danh chứa chữ "trưởng/phó/vice" sẽ tự được xếp vào nhóm **Core** trên bảng xếp hạng.
- `Email`, `SĐT`: thông tin liên hệ; `Ghi chú`: để trống hoặc ghi ngắn.

---

## 📊 TAB 2: `Điểm` (CỘNG ĐIỂM ĐÓNG GÓP)

Header dòng 1 (giữ nguyên chính xác):

```
STT | Họ và tên | Số điểm | Lý do | Ngày
```

**Quy tắc khi cộng điểm:**
- **Mỗi lần cộng điểm = 1 dòng riêng** (không gộp nhiều lần vào 1 dòng).
- `STT`: đánh số liên tiếp.
- `Họ và tên`: **phải trùng CHÍNH XÁC** tên đã có ở tab `Thành viên` (nếu tên có trong tab Thành viên). Người chưa có trong tab Thành viên vẫn cộng được — hệ thống sẽ tự thêm họ vào bảng xếp hạng.
- `Số điểm`: số dương (vd `5`, `10`, `15`). Không ghi số âm, không ghi kèm chữ (số âm/không hợp lệ sẽ bị bỏ qua).
- `Lý do`: mô tả ngắn hoạt động, vd `Tham gia tổ chức sự kiện`, `Đăng bài nội dung`, `Trực page`.
- `Ngày`: định dạng `ngày/tháng/năm`, vd `01/08/2026`.

**Cách hệ thống tính điểm:** gộp tất cả dòng theo tên → tổng điểm = cộng tất cả `Số điểm` của người đó → xếp hạng giảm dần. Người nào trùng tên nhiều dòng sẽ tự cộng dồn.

---

## 🤖 PROMPT GỐC (copy nguyên bản từ "BẮT ĐẦU" đến "KẾT THÚC")

### BẮT ĐẦU

Bạn là trợ lý chuyên tạo prompt để cập nhật Google Sheet **"Bảng xếp hạng Ý Niệm Điện Ảnh"** (project YNĐA) thông qua Gemini Sheets.

**Cấu trúc sheet hiện tại:**
- Spreadsheet ID: `1rFuGWw4IZxmROnP7W4k1ntEykstZZu0JP3mKexihR6E`
- Tab 1 `Thành viên` — header dòng 1: `STT | Họ và tên | Ban | Vai trò | Chức danh | Email | SĐT | Ghi chú`
  - `Vai trò` chỉ nhận: `Core` hoặc `Thành viên`.
  - `Chức danh` (để trống được): `Trưởng ban`, `Phó ban`, `Trưởng nhóm`, `Phó trưởng nhóm`.
  - Người có Chức danh chứa "trưởng/phó/vice" sẽ thuộc nhóm Core.
- Tab 2 `Điểm` — header dòng 1: `STT | Họ và tên | Số điểm | Lý do | Ngày`
  - Mỗi lần cộng điểm = 1 dòng riêng, `Số điểm` là số dương, `Ngày` dạng `ngày/tháng/năm`.

**Nhiệm vụ của bạn:** Dựa vào yêu cầu bên dưới, tạo **một prompt tiếng Việt, rõ ràng, chỉ dán được vào Gemini đang mở sheet đó** để Gemini tự thực hiện. Prompt phải:
1. Nêu rõ tab cần sửa (`Thành viên` hoặc `Điểm`).
2. Với mỗi thay đổi, ghi rõ **toàn bộ thông tin từng cột** (STT, Họ và tên, Ban, Vai trò, Chức danh, Email, SĐT, Ghi chú — hoặc STT, Họ và tên, Số điểm, Lý do, Ngày).
3. Đánh số STT liên tiếp đúng vị trí cuối cùng của tab (kiểm tra theo dòng cuối có dữ liệu).
4. Tên người dùng phải giữ nguyên chính xác như đã có trong sheet; nếu là người mới, giữ đúng tên người yêu cầu cung cấp.
5. Yêu cầu Gemini "thêm dòng mới vào cuối tab, đừng ghi đè header, đừng sửa các dòng khác".
6. Kết thúc prompt bằng câu: "Chỉ thực hiện đúng yêu cầu trên, không thay đổi dữ liệu khác."

**YÊU CẦU CỦA NGƯỜI DÙNG:**
[YÊU CẦU CỦA BẠN — vd: thêm 2 thành viên mới / cộng điểm cho Nguyễn Văn A / sửa ban của Trần Thị B...]

### KẾT THÚC

---

## 💡 CÁCH DÙNG (3 BƯỚC)

1. **Copy toàn bộ PROMPT GỐC** (từ `### BẮT ĐẦU` đến `### KẾT THÚC`), thay chỗ `[YÊU CẦU CỦA BẠN]` bằng yêu cầu thực tế (có thể gửi kèm ảnh chụp / danh sách thành viên / file Excel).
2. Gửi cho AI bất kỳ (GPT, Gemini, DeepSeek). AI sẽ trả về **1 prompt tiếng Việt hoàn chỉnh**.
3. Copy prompt AI vừa tạo, mở sheet trên Google, mở **Gemini Sheets** (biểu tượng Gemini ở góc phải bên dưới) và dán prompt đó vào → Gemini tự cập nhật.

---

## ✍️ VÍ DỤ

**Yêu cầu bạn gửi:** "Thêm 2 thành viên: Nguyễn Văn F ban Truyền thông vai trò Thành viên chức danh để trống, email f@email.com sđt 901234572. Và Hoàng Thị G ban Hậu kỳ vai trò Core chức danh Phó ban, email g@email.com sđt 901234573. Sau đó cộng 10 điểm cho Nguyễn Văn F lý do 'Tham gia sự kiện' ngày 05/08/2026."

**Prompt AI sẽ trả về (ví dụ):**
> "Trong tab `Thành viên`, đọc dòng cuối cùng để biết STT hiện tại. Thêm 2 dòng mới vào cuối tab (không ghi đè header):
> - STT 6 | Nguyễn Văn F | Truyền thông | Thành viên | (trống) | f@email.com | 901234572 | (trống)
> - STT 7 | Hoàng Thị G | Hậu kỳ | Core | Phó ban | g@email.com | 901234573 | (trống)
> Tiếp theo, trong tab `Điểm`, thêm dòng mới: STT 7 | Nguyễn Văn F | 10 | Tham gia sự kiện | 05/08/2026.
> Chỉ thực hiện đúng yêu cầu trên, không thay đổi dữ liệu khác."

---

## 🔁 KHI BẢNG XẾP HẠNG CHƯA CẬP NHẬT

- Đợi **1-2 phút** rồi vào https://yniemdienanh.vercel.app/bang-xep-hang bấm **🔄 Làm mới** (trang tự làm mới mỗi 120 giây).
- Kiểm tra lại tên có **trùng chính xác** (kể cả hoa/thường, dấu) giữa tab `Điểm` và tab `Thành viên`.
- Nếu vẫn chưa hiện, kiểm tra tab `Điểm` có dòng `Số điểm` bị để trống hoặc bằng 0/âm không.
