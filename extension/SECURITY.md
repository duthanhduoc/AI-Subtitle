# Bảo mật

Manifest cho phép content script chạy trên `<all_urls>` và trong mọi frame để phát hiện video; service worker dùng `webRequest` để nhận URL `.m3u8` theo tab. Các hành động mở PiP, mở player và sao chép URL vẫn bắt đầu từ popup hoặc thao tác của người dùng. Rule khai báo cho `surrit.com` chỉ đặt `Referer: https://missav.ws/` trên request media phù hợp.

DOM trang web, URL media và file phụ đề đều là dữ liệu không đáng tin cậy. Nội dung phụ đề được đưa vào DOM bằng `textContent` hoặc native text track; extension không dùng script từ xa hay `eval`. Báo cáo lỗ hổng qua issue tracker của dự án; hiện chưa công bố địa chỉ liên hệ bảo mật riêng.
