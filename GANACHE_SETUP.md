# 🎮 Ganache Setup Guide

## 🚀 Quick Start

### 1️⃣ Khởi động Ganache (Terminal 1)
```powershell
.\start-ganache.ps1
```

**Hoặc chạy trực tiếp:**
```powershell
ganache --port 8545 --deterministic --accounts 20 --defaultBalanceEther 10000 --chain.chainId 1337 --database.dbPath .\ganache-db
```

> ⚠️ **Để terminal này chạy mãi, không tắt!**

### 2️⃣ Deploy Contract (Terminal 2)
```powershell
.\deploy-contract.ps1
```

**Hoặc chạy trực tiếp:**
```powershell
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

### 3️⃣ Cập nhật Contract Address
Copy địa chỉ contract từ output và paste vào `Server\.env`:
```env
MARKETPLACE_ADDRESS="0x..."
```

### 4️⃣ Khởi động Backend Server (Terminal 3)
```powershell
cd Server
node server.js
```

### 5️⃣ Khởi động Frontend (Terminal 4)
```powershell
cd Client
npm run dev
```

---

## 📋 Ganache Account Info

### Account #0 (Deployer)
- **Address:** `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1`
- **Private Key:** `0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d`
- **Balance:** 10,000 ETH

### Mnemonic
```
myth like bonus scare over problem client lizard pioneer submit female collect
```

---

## 🔧 MetaMask Configuration

### Add Network
- **Network Name:** Ganache Local
- **RPC URL:** `http://127.0.0.1:8545`
- **Chain ID:** `1337`
- **Currency Symbol:** ETH

### Import Account
1. Open MetaMask
2. Click account icon → Import Account
3. Paste Private Key:
   ```
   0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d
   ```
4. Tên gợi ý: "Ganache Account #0"

---

## 💾 Persistence (Lưu trữ blockchain)

### Với `--database.dbPath`
- ✅ Blockchain data được lưu trong folder `ganache-db`
- ✅ Smart contracts vẫn còn sau khi restart
- ✅ Transactions history được giữ lại
- ✅ Account balances được duy trì

### Lưu ý
- ⚠️ Nếu **XÓA folder `ganache-db`**, blockchain sẽ reset về trạng thái ban đầu
- ⚠️ Nếu **không dùng `--deterministic`**, địa chỉ accounts sẽ khác mỗi lần khởi động

---

## 🔄 Reset Blockchain

Nếu muốn reset về trạng thái ban đầu:

```powershell
# Tắt Ganache (Ctrl+C)
# Xóa database
Remove-Item -Recurse -Force .\ganache-db
# Khởi động lại
.\start-ganache.ps1
# Deploy contract lại
.\deploy-contract.ps1
```

---

## 🐛 Troubleshooting

### Lỗi "Cannot connect to network"
```powershell
# Kiểm tra Ganache có chạy không
Test-NetConnection -ComputerName 127.0.0.1 -Port 8545 -InformationLevel Quiet
```

### Lỗi "Calling an account which is not a contract"
- Contract chưa deploy hoặc địa chỉ sai
- Chạy lại `.\deploy-contract.ps1`
- Cập nhật `MARKETPLACE_ADDRESS` trong `.env`

### MetaMask không kết nối được
1. Kiểm tra Chain ID = `1337`
2. Kiểm tra RPC URL = `http://127.0.0.1:8545`
3. Reset MetaMask account: Settings → Advanced → Clear activity tab data

---

## 📊 So sánh Ganache vs Hardhat

| Feature | Ganache | Hardhat Node |
|---------|---------|--------------|
| Stability | ✅ Ổn định | ⚠️ Dễ crash |
| Persistence | ✅ Có (với --database) | ❌ Không |
| GUI | ✅ Có (Ganache UI) | ❌ Không |
| Speed | 🟡 Trung bình | ✅ Nhanh |
| Deterministic | ✅ Có | ✅ Có |

---

## 📝 Commands Cheat Sheet

```powershell
# Start Ganache
.\start-ganache.ps1

# Deploy contract
.\deploy-contract.ps1

# Check if Ganache running
Test-NetConnection 127.0.0.1 -Port 8545

# Reset blockchain
Remove-Item -Recurse -Force .\ganache-db

# View Ganache logs
# (logs hiển thị trực tiếp trong terminal)
```

---

## 🎯 Next Steps

1. ✅ Start Ganache
2. ✅ Deploy contract
3. ✅ Update `.env` with contract address
4. ✅ Configure MetaMask
5. ✅ Start backend & frontend
6. 🎉 Test marketplace features!
