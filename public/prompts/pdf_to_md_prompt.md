<task>
Hãy chuyển đổi toàn bộ nội dung từ tệp PDF đính kèm sang định dạng **Markdown** chuẩn mực, sạch sẽ và liền mạch để làm dữ liệu đầu vào cho hệ thống Dịch Máy. Tuân thủ nghiêm ngặt các quy tắc trong System Instructions.
</task>

<execution_checklist>
[DANH SÁCH KIỂM TRA KỸ THUẬT TRƯỚC KHI XUẤT BẢN]
1. **Luồng văn bản & Đa cột:** Đã nối liền các dòng bị ngắt cứng ở lề phải và nối mượt các câu bị cắt ngang qua ranh giới trang giấy chưa? Đã ghép các từ bị gạch nối cuối dòng (`trans-\nformation` -> `transformation`) và gom bố cục đa cột về **1 cột duy nhất** theo đúng thứ tự đọc (trái sang phải) chưa? (Chỉ giữ ngắt dòng cho Thơ ca, Lời hát, Khối code).
2. **Làm sạch nhiễu & Mục lục (TOC):** Đã xóa sạch Running Headers, Footers, Số trang, Watermarks chưa? Nếu có trang Mục lục đầu sách, đã chuyển thành danh sách `- Tên chương` (xóa dấu chấm `.....` và số trang, **TUYỆT ĐỐI KHÔNG** gắn thẻ `#`, `##`, `###` cho dòng mục lục) chưa?
3. **Chuẩn hóa cấp độ Tiêu đề (Headings):**
   - `#` (H1): Chỉ dùng cho Tên sách hoặc cấp Phần lớn (Part / Book / Phần).
   - `##` (H2): **BẮT BUỘC** dùng cho mọi cấp Chương (Chapter / Chương / Hồi) và các mục tương đương chương (*Lời nói đầu, Mở đầu, Phụ lục, Tài liệu tham khảo*), kể cả khi không có H1.
   - `###` / `####` (H3/H4): Dùng cho các mục con bên trong chương.
4. **Công thức Toán/Khoa học & Chỉ số trích dẫn:**
   - Mọi công thức, biến số, số mũ toán/hóa học (nếu có) phải dùng chuẩn LaTeX bất đối xứng: `\(...\)` cho nội dòng (inline) và `\[...\]` trên dòng riêng biệt cho công thức khối (block). **TUYỆT ĐỐI KHÔNG dùng dấu `$` hay `$$`**.
   - Các chỉ số trên dùng để trích dẫn nguồn tài liệu (không phải số mũ toán học) phải chuyển thành `<sup>12</sup>`.
5. **Chú thích chân trang (Footnotes):** Đã gom nội dung giải nghĩa `[^fn_1]: ...` đặt ở **ngay sau đoạn văn chứa chú thích** (hoặc ngay cuối chương hiện tại, trước thẻ `##` của chương kế tiếp) để không làm đứt câu giữa trang chưa?
</execution_checklist>

<mandatory_output_rules>
- **Toàn vẹn dữ liệu 100% (No Truncation):** Chuyển đổi đầy đủ mọi trang của tệp PDF đính kèm từ trang đầu đến trang cuối. Tuyệt đối không tóm tắt, không cắt bớt hoặc viết `[...tiếp tục...]`.
- **Chỉ trả về văn bản Markdown thuần túy:** Không thêm bất kỳ lời chào hay bình luận nào. **KHÔNG** bọc toàn bộ kết quả trong khối ```markdown ... ``` bên ngoài.
</mandatory_output_rules>