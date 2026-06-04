const mongoose = require('mongoose');
const BillProvider = require('../models/billProvider');
const Transaction = require('../models/transaction');
const User = require('../models/user');
const { getRandomReward } = require('../config/settings');

const listProviders = async (req, res) => {
  try {
    const providers = await BillProvider.find().lean();
    return res.json({ providers, ok: true, color: 'neutral' });
  } catch (err) {
    return res.status(500).json({ ok: false, color: 'red', message: 'Failed to list providers' });
  }
};

const payBill = async (req, res) => {
  const user = req.user;
  const { providerCode, consumerNumber, amount } = req.body;

  if (!providerCode || !consumerNumber || amount == null) {
    return res.status(400).json({ ok: false, color: 'red', message: 'Missing fields' });
  }

  // Validate amount
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      ok: false,
      color: 'red',
      message: 'Bill amount must be a positive number',
      reason: Number.isNaN(numericAmount) ? 'invalidAmount' : 'nonPositiveAmount'
    });
  }

  try {
    const provider = await BillProvider.findOne({ code: providerCode });
    if (!provider) {
      return res.status(400).json({ ok: false, color: 'red', message: 'Invalid provider' });
    }

    let session = null;
    let usedSession = false;
    try {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        usedSession = true;
      } catch (sessionErr) {
        console.warn('MongoDB transactions not supported (likely standalone mode). Proceeding without session.');
        session = null;
        usedSession = false;
      }

      const u = session
        ? await User.findById(user._id).session(session)
        : await User.findById(user._id);
        
      if (!u) {
        throw new Error('User not found');
      }

      if (u.balance < numericAmount) {
        throw new Error('Insufficient balance');
      }

      u.balance -= numericAmount;
      u.rewards.push({
        message: `Cashback for ${provider.name || provider.code} Payment`,
        amount: getRandomReward(),
        scratched: false
      });
      
      if (session) {
        await u.save({ session });
      } else {
        await u.save();
      }

      const tx = new Transaction({
        type: 'bill',
        from: u._id,
        to: null,
        amount: numericAmount,
        meta: { provider: provider.code, consumerNumber }
      });

      if (session) {
        await tx.save({ session });
        await session.commitTransaction();
        session.endSession();
      } else {
        await tx.save();
      }

      return res.json({
        ok: true,
        color: 'green',
        message: 'Bill paid successfully',
        transaction: tx,
        showConfirmation: true,
        user: u
      });
    } catch (innerErr) {
      if (usedSession && session) {
        try { await session.abortTransaction(); } catch (_) {}
        try { session.endSession(); } catch (_) {}
      }
      return res.status(400).json({ ok: false, color: 'red', message: innerErr.message || 'Payment failed' });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, color: 'red', message: 'Server error' });
  }
};

module.exports = { listProviders, payBill };
