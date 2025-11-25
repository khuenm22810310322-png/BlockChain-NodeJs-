const mongoose = require("mongoose");

const PaymentRecordSchema = new mongoose.Schema({
    transactionId: { type: String, unique: true, required: true }, // Mã giao dịch ngân hàng (FT...)
    amount: { type: Number, required: true },
    content: { type: String, required: true }, // Nội dung chuyển khoản
    bankAccount: String,
    date: { type: Date, default: Date.now },
    processed: { type: Boolean, default: false }, // Đã chuyển token chưa
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    coinId: String
});

module.exports = mongoose.model("PaymentRecord", PaymentRecordSchema);
