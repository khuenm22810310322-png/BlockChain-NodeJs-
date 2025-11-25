const express = require('express');
const router = express.Router();
const passport = require('passport');
const PriceAlert = require('../models/PriceAlert');

// Middleware to require login
router.use(passport.authenticate('jwt', { session: false }));

// Get all active alerts for user
router.get('/', async (req, res) => {
  try {
    const alerts = await PriceAlert.find({ 
      user: req.user._id,
      status: 'active' 
    }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new alert
router.post('/', async (req, res) => {
  try {
    const { coinId, coinSymbol, targetPrice, condition } = req.body;
    
    if (!coinId || !targetPrice || !condition) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newAlert = new PriceAlert({
      user: req.user._id,
      coinId,
      coinSymbol: coinSymbol || coinId.toUpperCase(),
      targetPrice,
      condition
    });

    await newAlert.save();
    res.json(newAlert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete alert
router.delete('/:id', async (req, res) => {
  try {
    const alert = await PriceAlert.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
