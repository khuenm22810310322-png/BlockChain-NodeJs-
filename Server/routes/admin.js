const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const User = require('../models/Users');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const passport = require('passport');
const path = require('path');
const fs = require('fs');

// Load Contract
const artifactPath = path.join(__dirname, "..", "artifacts", "P2PMarketplace.json");
const artifact = require(artifactPath);
const abi = artifact.abi;
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// Load Deployed Tokens
const deployedTokensPath = path.join(__dirname, '..', '..', 'blockchain', 'deployed-tokens.json');
let deployedTokens = { tokens: {} };
try {
    if (fs.existsSync(deployedTokensPath)) {
        deployedTokens = JSON.parse(fs.readFileSync(deployedTokensPath, 'utf8'));
    }
} catch (e) {
    console.error("Failed to load deployed tokens:", e);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
const contract = MARKETPLACE_ADDRESS && signer ? new ethers.Contract(MARKETPLACE_ADDRESS, abi, signer) : null;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Admin only.' });
};

// Protect all routes with JWT and isAdmin
router.use(passport.authenticate('jwt', { session: false }), isAdmin);

const logAdminAction = async (adminId, action, details, targetId) => {
  try {
    await AuditLog.create({ adminId, action, details, targetId });
  } catch (err) {
    console.error('Failed to create audit log:', err);
  }
};

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ _id: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific user details
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const transactions = await Transaction.find({ user: user._id }).sort({ _id: -1 });
    
    res.json({ user, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analytics Routes
router.get('/stats/users', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0,0,0,0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));

    const objectIdFromDate = (date) => {
      return Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000";
    };

    const todayId = objectIdFromDate(todayStart);
    const weekId = objectIdFromDate(weekStart);

    const totalUsers = await User.countDocuments({});
    const newUsersToday = await User.countDocuments({ _id: { $gte: todayId } });
    const newUsersWeek = await User.countDocuments({ _id: { $gte: weekId } });

    res.json({ totalUsers, newUsersToday, newUsersWeek });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats/volume', async (req, res) => {
  try {
    const txs = await Transaction.find({ status: 'confirmed' }).select('_id totalValue type');
    const volumeByDate = {};
    
    txs.forEach(tx => {
      const date = tx._id.getTimestamp().toISOString().split('T')[0];
      if (!volumeByDate[date]) volumeByDate[date] = 0;
      if (tx.totalValue) {
         try {
             const val = parseFloat(ethers.formatEther(tx.totalValue));
             volumeByDate[date] += val;
         } catch (e) {
             // ignore invalid values
         }
      }
    });
    
    const chartData = Object.entries(volumeByDate)
        .map(([date, volume]) => ({ date, volume }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(chartData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats/top-coins', async (req, res) => {
  try {
    const txs = await Transaction.find({ type: 'buy', status: 'confirmed' }).select('coinSymbol');
    const coinCounts = {};
    
    txs.forEach(tx => {
      if (!coinCounts[tx.coinSymbol]) coinCounts[tx.coinSymbol] = 0;
      coinCounts[tx.coinSymbol] += 1;
    });
    
    const sorted = Object.entries(coinCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
        
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Transaction.deleteMany({ user: req.params.id });
    await logAdminAction(req.user._id, 'DELETE_USER', `Deleted user ${req.params.id}`, req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ban/Unban user
router.put('/users/:id/ban', async (req, res) => {
  try {
    const { isBanned } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { isBanned: isBanned },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    await logAdminAction(req.user._id, isBanned ? 'BAN_USER' : 'UNBAN_USER', `Changed ban status to ${isBanned}`, req.params.id);
    res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'} successfully`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().populate('adminId', 'username').sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
