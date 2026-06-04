const User = require('../models/user');
const Transaction = require('../models/transaction');
const BillProvider = require('../models/billProvider');

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
  res.json({ provider: p });
};

module.exports = { listUsers, listTransactions, createProvider };
