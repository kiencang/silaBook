# silaBook
Công cụ dịch sách từ tiếng Anh sang tiếng Việt bằng Gemini. Tận dụng được ngưỡng API miễn phí khi dùng app qua AI Studio (dịch không tốn tiền).

Một số tính năng quan trọng khác:
- Nhận nhiều định dạng sách: 5 định dạng đầu vào là EPUB, HTML, PDF, TXT, và Markdown;
- Bảo toàn được ảnh trong bản dịch với một số định dạng nhất định (EPUB, HTML, Markdown);
- Đối với định dạng PDF, nên chuyển đổi sang Markdwon bằng các công cụ ngoài nếu muốn giữ được ảnh (công cụ có hướng dẫn đầy đủ);
- Có các phase phân tích đại từ, thuật ngữ (từ khó) và tóm tắt chương trước để việc dịch được chuẩn xác hơn;
- Có khả năng xử lý được các cuốn sách lớn có độ dày lên đến 500 - 700 trang;
  
Chương trình sử dụng SI & Prompt từ dự án này: https://github.com/kiencang/SI-Prompt-Book-EV-Translate (**v1.0.35**).

Xem hướng dẫn đầy đủ và cập nhật: https://silabook-intro.wpsila.com/

Remix trên AI Studio (để tận dụng API Key miễn phí) và chỉnh sửa thêm nếu muốn: https://aistudio.google.com/apps/d25924ff-35f1-42f7-9543-f142ecfe037a?showPreview=true&showAssistant=true

## Hướng dẫn sử dụng nhanh

<p align="center">
  <img src="images/h1-tao-du-an.png" alt="Bước 1">
   <br><em>Bước 1: Tạo dự án: Ở đây các bạn cần nhập chính xác tên sách & tác giả. Thông tin này quan trọng, vì sách (nhất là kinh điển) thường có thông tin rất đầy đủ trên mạng, cung cấp chính xác thông tin giúp công cụ dịch tốt hơn.</em>
</p>

Lưu ý: Khi bạn tạo dự án, toàn bộ dữ liệu dịch của bạn sẽ được lưu cục bộ tại trình duyệt của bạn. Việc xóa dữ liệu trình duyệt có thể làm mất dữ liệu này. Luôn sử dụng tính năng xuất dự án nếu bạn muốn bảo vệ dữ liệu lâu dài.

<p align="center">
  <img src="images/h2-tai-sach-len.png" alt="Bước 2">
   <br><em>Bước 2: Tải sách lên: Bạn tải sách gốc tiếng Anh lên. Hiện công cụ hỗ trợ 5 định dạng là EPUB, HTML, PDF, TXT & Markdown.</em>
</p>

Định dạng khuyến khích là EPUB hoặc HTML. PDF cũng ổn nhưng sẽ mất thêm chút thời gian để phân tích chuyển đổi định dạng. Và các sách đang còn bản quyền thường bị AI từ chối phân tích. Các định dạng khác thì không bị như vậy.

<p align="center">
  <img src="images/h3-AI-phan-tich.png" alt="Bước 3">
   <br><em>Bước 3: Chia chương/khối dịch: Ứng dụng cần chia cuốn sách ra thành các chương/khối để dịch lần lượt. Ở đây bạn sẽ có các tùy chọn chia cuốn sách theo cách thức nào.</em>
</p>

Có 2 cách:
- Nhờ AI chia: sử dụng tín năng này nếu bạn không rõ cấu trúc của cuốn sách, không biết chia thế nào cho hợp lý.
- Chia thủ công bằng các lựa chọn: bạn biết cấu trúc cuốn sách cơ bản thế nào, và chọn phương pháp phù hợp. Có 3 cách chia cơ bản:
    + Chia theo chương: công cụ sẽ tự động quét các từ khóa như `chapter` để tách sách thành các chương.
    + Chia theo các tiêu đề lớn: nếu sách không phân thành các chương mà dùng các tiêu đề lớn thì nên chọn cách này để chia
    + Chia đều tự động: nếu 2 cách trên đều bó tay, thì bạn áp dụng cách này, nó sẽ phân sách ra làm các phần nhỏ hơn dựa theo các dấu xuống dòng. Đây là cách tệ nhất để chia sách, chỉ dùng nếu 2 cách trên không áp dụng được.
   + Chia thủ công có tùy chọn `Số từ tối thiểu` & `Số từ tối đa`: cái này dùng để áp ngưỡng phân chia. Mỗi chương/khối sẽ bắt buộc phải nằm trong ngưỡng này. Bạn cũng nên điều chỉnh để xem sách chia thế nào. Ý tưởng cơ bản là: nếu chia sách quá vụn hoặc quá lớn thì đều khó dịch hơn.

<p align="center">
  <img src="images/h4-chia-thu-cong.png" alt="Chia thủ công">
   <br><em>Chia sách theo cách thủ công</em>
</p>

<p align="center">
  <img src="images/h5-tao-dai-tu.png" alt="Giao diện của công cụ dịch...">
   <br><em>Bước 4: Tạo đại từ xưng hô: Đại từ xưng hô có thể nói là phần khác biệt nhất giữa tiếng Anh & tiếng Việt. Tiếng Việt có đại từ xưng hô rất phức tạp, phụ thuộc vào tuổi, giới tính, vai vế, chức vụ & cả tâm trạng!</em>
</p>

Phần này đặc biệt quan trọng cho thể loại truyện ngắn, tiểu thuyết. Các dạng sách phi hư cấu có thể không cần thiết (bấm button `Bỏ qua phần này` nếu không muốn tạo).
  
Bạn chỉ việc nhấn button, công cụ sẽ tự quét toàn bộ cuốn sách và tạo bảng đại từ đầy đủ. Vì đại từ rất quan trọng, bạn nên chọn model AI cao nhất để phân tích.

<p align="center">
  <img src="images/h6-tao-tu-kho.png" alt="Giao diện của công cụ dịch...">
   <br><em>Bước 5: Tạo danh sách từ khó/thuật ngữ: hầu hết các sách đều có những từ khó dịch, nên bước này bạn nên làm với bất kỳ thể loại sách nào.</em>
</p>

Model chọn để phân tích lý tưởng nhất vẫn là model cao nhất (Pro). Tuy nhiên sách rất tốn dữ liệu nên người dùng miễn phí để không bị gián đoạn phân tích nên dùng model tầm trung (Flash) để làm.  

<p align="center">
  <img src="images/h7-dich.png" alt="Bước 6">
   <br><em>Bước 6: Dịch: Tiến hành dịch chính thức.</em>
</p>

Sau khi có các nguyên liệu thô ở các bước trước, ứng dụng sẵn sàng dịch cả cuốn sách.
Các thiết lập mặc định đủ tốt trong phần lớn trường hợp. Bạn chỉ việc nhất button `Dịch tất cả` (để dịch cả cuốn sách) hoặc `Dịch riêng phần này` (để dịch một chương/khối cụ thể).
  
Nên chọn model cao nhất ở bước này. Tuy nhiên nếu muốn dịch nhanh hơn, không bị gián đoạn, có thể dùng model Flash.
  
Thường để dịch nguyên một cuốn sách ứng dụng cần 1 - 2 tiếng. Lý do là vì nó dịch theo kiểu tuần tự để đảm bảo bối cảnh tốt nhất cho các phần tiếp theo.

<p align="center">
  <img src="images/h8-doc-ban-dich.png" alt="Đọc bản dịch ngay trong ứng dụng">
   <br><em>Đọc bản dịch ngay trong ứng dụng</em>
</p>

<p align="center">
  <img src="images/h9-song-ngu.png" alt="Đọc song ngữ">
   <br><em>Đọc song ngữ với việc so sánh dễ dàng 2 khối dịch tương ứng nhau để tiện đối chiếu</em>
</p>

Bạn có thể vào dự án Gutenberg để tải các sách hết hạn bản quyền về dịch. Ví dụ 100 cuốn được tải về nhiều nhất trong tháng: https://www.gutenberg.org/browse/scores/top#books-last100

## Cách sử dụng PaddleOCR để chuyển đổi PDF sang dạng Markdown
Điều này giúp bản dịch giữ lại được ảnh trong bản gốc. Trước khi gửi lên silaBook, bạn chuyển định dạng PDF sang markdown bằng công cụ dưới đây của Baidu.
Link: https://aistudio.baidu.com/paddleocr

Sau đó tải định dạng markdown đã được chuyển đổi rồi up lên silaBook để dịch.

Hướng dẫn sử dụng:

<p align="center">
  <a href="https://www.youtube.com/watch?v=mWlgsCRZJS8">
    <img src="https://img.youtube.com/vi/mWlgsCRZJS8/0.jpg" alt="Tiêu đề video" width="600">
  </a>
</p>

Với cách trên ảnh sẽ vẫn hiển thị bình thường khi bạn đọc trực tiếp trên ứng dụng hoặc tải về bản PDF hoặc HTML. Nhưng vì ảnh là dạng link nên không hiển thị được ở định dạng EPUB và DOCX.

Trường hợp bạn bắt buộc cần định dạng DOCX chứa ảnh, mà định dạng gốc lại là file PDF thì thay vì dùng PaddleOCR làm công cụ trung gian bạn nên sử dụng công cụ pdf-2-epub-docx này: https://aistudio.google.com/apps/9a11586a-e712-4c10-a1b6-751ab78fc10b?showAssistant=true&showCode=true

Nó sẽ chuyển thành dạng EPUB có chứa ảnh gốc, bạn tải định dạng EPUB này về và up lên công cụ dịch là được.

**Ghi chú thêm**: Một công cụ khác để OCR chuyển PDF thành markdown là GLM-OCR, các bạn có thể truy cập ở đường dẫn này: https://ocr.z.ai

## Thử nghiệm thêm để có thể kết nối với bất cứ AI nào

Nhìn chung tôi hài lòng với Gemini, nó có chất lượng tốt và có gói miễn phí hàng ngày tương đối rộng rãi.

Tuy nhiên vẫn có nhu cầu sử dụng các model AI khác để dịch. Và tôi đang triển khai một công cụ tương tự dựa trên công cụ này, nó sẽ kết hợp với OpenRouter- vốn là cổng trung gian có thể kết nối với hầu hết các AI quan trọng nhất. Điều đó giúp bạn có khả năng sử dụng bất cứ AI nào bạn muốn để dịch!

Bạn có thể tham khảo repo đó ở đây: https://github.com/kiencang/silaBook-openSky

## Tuyên bố từ chối trách nhiệm
Công cụ này có thể được sử dụng cho mục đích nghiên cứu và học tập cá nhân.

silaBook cũng như người phát triển nó không đưa ra bất kỳ bảo đảm rõ ràng hay ngụ ý nào, cũng như không tuyên bố rằng công cụ sẽ vận hành hoàn hảo, chính xác hoặc cập nhật. Người phát triển sẽ không chịu trách nhiệm cho bất kỳ tổn thất hay thiệt hại nào phát sinh trực tiếp hoặc gián tiếp liên quan đến hoặc phát sinh từ việc sử dụng công cụ này.

## Ghi công

Ứng dụng được phát triển tối ưu hoàn toàn ở phía Client-side (Trình duyệt). Một số thư viện quan trọng mà ứng dụng này dùng:

### 1. Khung Phát Triển Chính (Core Engine)
*   **[Angular](https://angular.dev/)**: Khung ứng dụng web đơn trang (SPA).

### 2. Giao Diện
*   **[Tailwind CSS](https://tailwindcss.com/)**: Framework utility-first CSS hỗ trợ xây dựng giao diện.
*   **[Angular Material Icons](https://material.angular.io/)**: Cung cấp hệ thống icon.
*   **[Motion (Vanilla JS)](https://motion.dev/)**: Thư viện xử lý hiệu ứng chuyển động.

### 3. Xử Lý & Xuất Bản Tài Liệu (Document Processing)
*   **[docx](https://docx.js.org/)**: Thư viện chuyên dụng tạo cấu trúc tài liệu Word (`.docx`), hoạt động hoàn toàn phía client.
*   **[pdf-lib](https://pdf-lib.js.org/)**: Dùng để chia tách PDF thành các chunk (đoạn) để dễ xử lý hơn.
*   **[JSZip](https://stuk.github.io/jszip/)**: Công cụ nén và đóng gói thư mục sách điện tử EPUB (`.epub`) ngay trên trình duyệt.
*   **[Marked & marked-footnote](https://marked.js.org/)**: Chuyển Markdown sang cấu trúc HTML, có hỗ trợ ghi chú chân trang (footnotes).
*   **[Turndown](https://github.com/mixmark-io/turndown)**: Chuyển đổi ngược các định dạng HTML thành cú pháp Markdown.

### 4. Lưu Trữ Nội Bộ (Local Database & Storage)
*   **[idb (IndexedDB Wrapper)](https://github.com/jakearchibald/idb)**: Thư viện wrap IndexedDB, hỗ trợ xử lý các tác vụ liên quan đến IndexedDB tốt hơn. Toàn bộ dữ liệu sách được lưu cục bộ tại trình duyệt là thông qua IndexedDB.

