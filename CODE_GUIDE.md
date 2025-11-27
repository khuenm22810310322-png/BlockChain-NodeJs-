# Hướng Dẫn Đọc Hiểu Code - CryptoTrack

Tài liệu này giúp bạn nắm bắt kiến trúc, luồng dữ liệu và các thành phần cốt lõi của dự án CryptoTrack.

---

## 1. Tổng Quan Kiến Trúc (Architecture)

Hệ thống hoạt động theo mô hình **Client-Server** kết hợp với **Blockchain**:

1.  **Frontend (Client)**: 
    *   Xây dựng bằng **ReactJS (Vite)**.
    *   Nhiệm vụ: Hiển thị giao diện, gọi API tới Server, và tương tác với ví MetaMask (Web3).
2.  **Backend (Server)**: 
    *   Xây dựng bằng **Node.js (Express)**.
    *   Nhiệm vụ: Xử lý logic nghiệp vụ, xác thực (JWT), bảo mật, lưu trữ dữ liệu off-chain và cung cấp API cho Frontend.
3.  **Database**: 
    *   **MongoDB**.
    *   Nhiệm vụ: Lưu thông tin người dùng, lịch sử giao dịch, danh sách theo dõi (watchlist), và cache giá coin.
4.  **Blockchain**: 
    *   **Hardhat/Ganache**.
    *   Nhiệm vụ: Chạy Smart Contracts (`P2PMarketplace.sol`) để xử lý giao dịch mua bán phi tập trung an toàn.

---

## 2. Luồng Dữ Liệu (Data Flow)

### A. Luồng Xác Thực (Authentication)
1.  **Client**: Người dùng nhập form -> Gọi API `POST /login`.
2.  **Server (`server.js` -> `auth.js`)**:
    *   Kiểm tra username/password trong MongoDB (`models/Users.js`).
    *   Nếu đúng: Tạo **JWT Token**.
    *   Trả về Token cho Client.
3.  **Client**: 
    *   Lưu Token vào `localStorage`.
    *   File `Client/src/services/api.js` sẽ tự động đính kèm Token này vào Header (`Authorization: Bearer ...`) cho mọi request sau đó.

### B. Luồng Lấy Giá Coin & Portfolio
1.  **Server**:
    *   Chạy các tác vụ nền (Background Jobs) để lấy giá từ Chainlink/CoinGecko.
    *   Lưu giá vào biến toàn cục hoặc Cache (`utils/cacheManager.js`).
2.  **Client**:
    *   Gọi `GET /portfolio`.
    *   **Server (`server.js`)**:
        *   Xác thực Token.
        *   Lấy `userId` từ Token -> Tìm User trong DB.
        *   Tính toán tổng giá trị tài sản dựa trên giá hiện tại.
        *   Trả về JSON Portfolio.

### C. Luồng Mua Bán P2P (Marketplace)
1.  **Tạo Lệnh Bán (Listing)**:
    *   **Client**: Người dùng thao tác trên UI -> Gọi Smart Contract `createListing`.
    *   **Blockchain**: Ghi nhận Listing mới.
    *   **Server**: Cần đồng bộ thông tin này về DB (thường qua Event Listener hoặc Client gọi API báo cập nhật) để hiển thị lên chợ nhanh hơn.
2.  **Mua Coin**:
    *   **Client**: Người dùng bấm "Buy" -> Gọi Smart Contract `buy`.
    *   **Blockchain**: Chuyển quyền sở hữu Token.

---

## 3. Chi Tiết Backend (`Server/`)

### `server.js` - Trái tim của Backend
Đây là file khởi chạy chính.
*   **Middleware**:
    *   `cors`: Cho phép Frontend (Vercel/Localhost) gọi API.
    *   `helmet`, `xss`, `hpp`: Các lớp bảo mật chống tấn công.
    *   `rateLimit`: Giới hạn số lần gọi API để chống Spam.
*   **Routes**:
    *   `app.use("/api/marketplace", ...)`: Các API liên quan đến chợ P2P.
    *   `app.use("/api/admin", ...)`: API cho trang quản trị.

### Các Models Quan Trọng (`Server/models/`)
*   **`Users.js`**:
    *   Chứa `username`, `password` (đã mã hóa), `role`.
    *   `portfolio`: Map lưu trữ số dư coin (ví dụ: `{"bitcoin": 0.5}`).
*   **`Transaction.js`**: Lưu lịch sử nạp tiền, rút tiền, mua bán để hiển thị lịch sử.

---

## 4. Chi Tiết Frontend (`Client/`)

### Cấu Trúc Thư Mục
*   `src/pages/`: Chứa các màn hình chính.
    *   `Home.jsx`: Trang chủ, bảng giá coin.
    *   `Dashboard.jsx`: Trang quản lý tài sản cá nhân.
    *   `Admin*.jsx`: Các trang quản trị viên.
*   `src/components/`: Các thành phần nhỏ tái sử dụng.
    *   `CoinRow.jsx`: Một dòng trong bảng giá.
    *   `PortfolioCoinRow.jsx`: Một dòng trong bảng tài sản (có logic tính lời/lỗ).
*   `src/services/api.js`:
    *   Nơi cấu hình **Axios**.
    *   Quan trọng: Chứa header `ngrok-skip-browser-warning` để vượt qua màn hình cảnh báo của Ngrok.

### Context (Quản lý trạng thái)
*   **`AuthContext.jsx`**: Cung cấp biến `user`, `isAuthenticated` cho toàn bộ app. Giúp kiểm tra xem người dùng đã đăng nhập chưa để ẩn/hiện các nút.

---

## 5. Mẹo Đọc Code & Debug
1.  **Lỗi "Undefined"**: Thường do dữ liệu từ API chưa về kịp nhưng Frontend đã render.
    *   *Cách xem*: Kiểm tra các file `.jsx`, tìm chỗ dùng `?.` (optional chaining) hoặc `||` (default value).
2.  **Lỗi CORS**: Do Backend chặn domain của Frontend.
    *   *Cách xem*: Mở `server.js`, tìm biến `allowedOrigins`.
3.  **Theo dõi luồng**:
    *   Mở file `server.js` để xem danh sách các API URL.
    *   Đối chiếu với `Client/src/services/api.js` để xem Frontend gọi API nào.
