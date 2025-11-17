# 🔨 Hardhat Development Guide

## 🚀 Quick Start

### 1️⃣ Khởi động Hardhat Node (Terminal 1)

```powershell
.\start-hardhat.ps1
```

**Hoặc trực tiếp:**
```powershell
cd blockchain
npx hardhat node
```

**Thông tin Node:**
- 🔗 **RPC URL:** http://127.0.0.1:8545
- ⛓️ **Chain ID:** 31337
- 💰 **Accounts:** 20 accounts, mỗi account có 10,000 ETH

**Account #0 (Default deployer):**
- **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key:** `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

⚠️ **Lưu ý:** Để terminal này chạy, không tắt!

---

### 2️⃣ Deploy Contract (Terminal 2)

**🚀 Cách nhanh (Tự động cập nhật .env):**
```powershell
.\deploy-and-update.ps1
```

Script sẽ tự động:
- ✅ Kiểm tra node có chạy không
- ✅ Deploy contract
- ✅ Extract contract address
- ✅ Cập nhật `Server/.env` tự động

**Hoặc deploy thủ công:**
```powershell
.\deploy-contract.ps1
```

**Hoặc trực tiếp:**
```powershell
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

**Output sẽ hiển thị:**
```
Deploying with: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
P2PMarketplace deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

⚠️ Nếu deploy thủ công, phải tự cập nhật `Server/.env`:
```env
MARKETPLACE_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"
```

---

### 3️⃣ Configure MetaMask

#### Add Hardhat Network:
1. Mở MetaMask → Click network dropdown
2. "Add network" → "Add a network manually"
3. Điền thông tin:
   - **Network Name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** ETH

#### Import Account:
1. MetaMask → Account icon → "Import account"
2. Paste Private Key:
   ```
   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
3. Account name: "Hardhat #0"

---

### 4️⃣ Start Backend (Terminal 3)

```powershell
cd Server
node server.js
```

---

### 5️⃣ Start Frontend (Terminal 4)

```powershell
cd Client
npm run dev
```

---

## 🔄 Transaction Flow

### Đăng bán (Create Listing):
1. User click "Sell" trên Portfolio
2. Nhập số lượng & giá
3. Frontend gọi `contract.createListing()` qua MetaMask
4. User xác nhận trên MetaMask (trả gas fee)
5. Transaction được gửi lên blockchain
6. Sau khi confirmed:
   - Lưu transaction vào database (MongoDB)
   - Trừ số lượng coin trong portfolio
   - Cập nhật listing trong contract

### Mua coin (Buy):
1. User click "Buy" trên Marketplace
2. Frontend gọi `contract.buy()` qua MetaMask
3. User xác nhận & trả tiền (coin price + gas)
4. Transaction confirmed:
   - Lưu transaction vào database
   - Cộng coin vào portfolio của buyer
   - Cập nhật listing status

---

## 📊 Database Schema

### Transaction Model:
```javascript
{
  txHash: String,           // Unique transaction hash
  type: String,             // "createListing" | "buy" | "cancel"
  user: ObjectId,           // User ID
  walletAddress: String,    // User's wallet address
  listingId: Number,        // Listing ID (if applicable)
  coinId: String,           // Coin ID (bitcoin, ethereum...)
  coinName: String,         // "Bitcoin"
  coinSymbol: String,       // "BTC"
  amount: String,           // Amount in Wei
  pricePerUnit: String,     // Price per unit in Wei
  totalValue: String,       // Total value in Wei
  status: String,           // "pending" | "confirmed" | "failed"
  blockNumber: Number,      // Block number
  gasUsed: String,          // Gas used
  timestamps: true          // createdAt, updatedAt
}
```

---

## 🛠️ API Endpoints

### POST `/api/marketplace/transactions`
Lưu transaction vào database sau khi user thực hiện giao dịch.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Body:**
```json
{
  "txHash": "0x...",
  "type": "createListing",
  "walletAddress": "0x...",
  "coinId": "bitcoin",
  "coinName": "Bitcoin",
  "coinSymbol": "BTC",
  "amount": "1000000000000000000",
  "pricePerUnit": "50000000000000000000",
  "listingId": 1
}
```

### GET `/api/marketplace/transactions`
Lấy lịch sử giao dịch của user.

**Query params:**
- `limit`: Số lượng records (default: 50)
- `skip`: Bỏ qua bao nhiêu records (pagination)
- `type`: Lọc theo loại transaction
- `coinId`: Lọc theo coin

### GET `/api/marketplace/transactions/:txHash`
Lấy thông tin chi tiết 1 transaction.

---

## 🐛 Troubleshooting

### Lỗi "Cannot connect to network"
```powershell
# Kiểm tra Hardhat node có chạy không
Test-NetConnection -ComputerName 127.0.0.1 -Port 8545 -InformationLevel Quiet
```
→ Nếu `False`, chạy `.\start-hardhat.ps1`

### Lỗi "Contract not deployed"
1. Restart Hardhat node → Blockchain reset
2. Phải deploy lại contract: `.\deploy-contract.ps1`
3. Cập nhật contract address mới vào `Server/.env`

### MetaMask "Nonce too high"
1. MetaMask → Settings → Advanced
2. "Clear activity tab data"
3. Confirm

### Lỗi "Insufficient funds"
- User không có đủ ETH để trả gas
- Import account Hardhat #0 (có 10,000 ETH)

---

## 📝 Development Notes

### Hardhat vs Ganache:

| Feature | Hardhat | Ganache |
|---------|---------|---------|
| Restart | ❌ Mất data | ✅ Lưu với --database |
| Console logs | ✅ Chi tiết | 🟡 Ít hơn |
| Debugging | ✅ Tốt nhất | 🟡 Trung bình |
| Speed | ✅ Nhanh | ✅ Nhanh |
| Default accounts | 20 | 10 |

### Khi nào cần reset?
- Khi muốn test với blockchain sạch
- Khi gặp lỗi "nonce" hoặc "state" không đồng bộ
- Sau khi sửa smart contract

**Cách reset:**
1. Tắt Hardhat node (Ctrl+C)
2. Khởi động lại: `.\start-hardhat.ps1`
3. Deploy lại contract: `.\deploy-contract.ps1`
4. Cập nhật contract address mới
5. Clear MetaMask activity

---

## 📜 Helper Scripts

### `start-hardhat.ps1`
Khởi động Hardhat node với console output màu sắc.

### `start-ganache.ps1`
Khởi động Ganache với persistence (lưu blockchain khi tắt).

### `deploy-and-update.ps1` ⭐ **RECOMMENDED**
Deploy contract và **tự động cập nhật** `Server/.env` với contract address mới.

### `deploy-contract.ps1`
Deploy contract (thủ công, cần tự update `.env`).

---

## ✅ Checklist khi bắt đầu dev

- [ ] Hardhat node đang chạy (port 8545)
- [ ] Contract đã deploy: `.\deploy-and-update.ps1` ⭐
- [ ] `Server/.env` có `MARKETPLACE_ADDRESS` (tự động nếu dùng script trên)
- [ ] MetaMask connected to Hardhat Local (Chain ID: 31337)
- [ ] Đã import Hardhat account vào MetaMask
- [ ] Backend server đang chạy (port 3000)
- [ ] Frontend đang chạy (port 5173)

---

## 🎯 Next Steps

Sau khi setup xong, bạn có thể:
1. ✅ Test tính năng Sell từ Portfolio
2. 🔄 Implement tính năng Buy (đang làm)
3. 🔄 Real-time update listings (Socket.io/polling)
4. ⬜ Thêm tính năng Cancel listing
5. ⬜ Transaction history page
6. ⬜ Filter & search listings

---

**Happy Coding! 🚀**
