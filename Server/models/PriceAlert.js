const mongoose = require('mongoose');

const priceAlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coinId: {
    type: String,
    required: true
  },
  coinSymbol: {
    type: String,
    required: true
  },
  targetPrice: {
    type: Number,
    required: true
  },
  condition: {
    type: String,
    enum: ['above', 'below'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'triggered'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for fast lookup during price checks
priceAlertSchema.index({ status: 1, coinId: 1 });

module.exports = mongoose.model('PriceAlert', priceAlertSchema);
