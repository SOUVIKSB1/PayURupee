const User = require('../models/user');
const Transaction = require('../models/transaction');
const BillProvider = require('../models/billProvider');
const AuditLog = require('../models/auditLog');
const { readSettings, writeSettings } = require('../config/settings');

const logAudit = async (adminEmail, action, details) => {
  try {
    const log = new AuditLog({ adminEmail, action, details });
    await log.save();
  } catch (err) {
    console.error('Failed to save audit log:', err);
  }
};

const listUsers = async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
  res.json({ users });
};

const listTransactions = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = Math.min(100, parseInt(req.query.limit || '50'));
  const skip = (page - 1) * limit;
  const docs = await Transaction.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  res.json({ page, limit, data: docs });
};

const createProvider = async (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) return res.status(400).json({ message: 'Missing fields' });
  const existing = await BillProvider.findOne({ code });
  if (existing) return res.status(400).json({ message: 'Provider code exists' });
  const p = new BillProvider({ name, code, description });
  await p.save();

  await logAudit(req.user.email, 'CREATE_PROVIDER', `Created utility provider ${code} (${name})`);

  res.json({ provider: p });
};

const awardReward = async (req, res) => {
  const { userId, amount, message } = req.body;
  if (!userId || amount === undefined || amount === null) {
    return res.status(400).json({ message: 'Missing userId or amount' });
  }
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ message: 'Amount must be a positive number' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.rewards.push({
    message: message || '',
    amount: amt,
    scratched: false
  });

  await user.save();
  
  await logAudit(req.user.email, 'AWARD_REWARD', `Awarded scratch card reward of ₹${amt} to ${user.email} with note: "${message}"`);

  res.json({ message: 'Reward awarded successfully' });
};

const adjustBalance = async (req, res) => {
  const { userId, amount, type } = req.body; // type: 'credit' or 'debit'
  if (!userId || amount === undefined || amount === null || !type) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ message: 'Amount must be positive' });
  }

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (type === 'credit') {
    user.balance = (user.balance || 0) + amt;
  } else if (type === 'debit') {
    if (user.balance < amt) {
      return res.status(400).json({ message: 'Insufficient user balance for debit adjustment' });
    }
    user.balance -= amt;
  } else {
    return res.status(400).json({ message: 'Invalid adjustment type' });
  }

  await user.save();

  // Log transaction
  const tx = new Transaction({
    type: 'admin_adjust',
    from: null,
    to: user._id,
    amount: amt,
    meta: { force: true, note: `Admin Adjustment: ${type.toUpperCase()}` }
  });
  await tx.save();

  await logAudit(req.user.email, 'ADJUST_BALANCE', `Adjusted balance of ${user.email} (type: ${type.toUpperCase()}, amount: ₹${amt})`);

  res.json({ message: 'Balance adjusted successfully' });
};

const deleteProvider = async (req, res) => {
  const { id } = req.params;
  try {
    const provider = await BillProvider.findByIdAndDelete(id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    await logAudit(req.user.email, 'DELETE_PROVIDER', `Deleted utility provider ${provider.code} (${provider.name})`);

    res.json({ message: 'Provider deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Error deleting provider' });
  }
};

const getSettings = async (req, res) => {
  try {
    const settings = readSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Error getting settings' });
  }
};

const updateSettings = async (req, res) => {
  const { minReward, maxReward, maintenanceMode } = req.body;
  try {
    const updated = writeSettings({ minReward, maxReward, maintenanceMode });

    await logAudit(req.user.email, 'UPDATE_SETTINGS', `Updated settings to minReward: ₹${updated.minReward}, maxReward: ₹${updated.maxReward}, maintenanceMode: ${updated.maintenanceMode}`);

    res.json({ message: 'Settings updated successfully', settings: updated });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Error updating settings' });
  }
};

const toggleBlockUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot block admin accounts' });
    }
    user.isBlocked = !user.isBlocked;
    await user.save();
    
    await logAudit(req.user.email, user.isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER', `Toggled block for user ${user.email} (Blocked: ${user.isBlocked})`);

    res.json({ message: `User block status set to ${user.isBlocked}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Error toggling user block' });
  }
};

const listAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Error listing audit logs' });
  }
};

module.exports = {
  listUsers,
  listTransactions,
  createProvider,
  deleteProvider,
  awardReward,
  adjustBalance,
  getSettings,
  updateSettings,
  toggleBlockUser,
  listAuditLogs
};
