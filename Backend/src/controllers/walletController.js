const User = require('../models/user');
const Transaction = require('../models/transaction');
const { sendMoney } = require('../utils/transactions');
const { getRandomReward } = require('../config/settings');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || '');

const getBalance = async (req, res) => {
  const user = req.user;
  res.json({ balance: user.balance });
};

const send = async (req, res) => {
  const from = req.user;
  const { toEmail, amount, note, demoMode } = req.body;
  if (!toEmail || !amount) return res.status(400).json({ message: 'Missing fields' });

  // Demo mode: simplified payment processing
  const isDemoMode = demoMode === true || process.env.NODE_ENV !== 'production';
  
  if (isDemoMode) {
    // Demo mode - only check balance, auto-create recipients
    try {
      const amt = Number(amount);
      
      // Check if balance is sufficient - STOP if not enough
      if (from.balance < amt) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }
      
      // Find or create recipient
      const normalizedEmail = String(toEmail).toLowerCase().trim();
      let recipient = await User.findOne({ email: normalizedEmail });
      
      // If recipient doesn't exist, create a demo recipient
      if (!recipient) {
        recipient = new User({
          name: toEmail.split('@')[0] || 'Demo User',
          email: normalizedEmail,
          password: '$2b$10$demopasswordhash', // dummy hash
          role: 'user',
          balance: 0
        });
        await recipient.save();
      }
      
      // Process payment (balance is sufficient)
      from.balance = Number(from.balance || 0) - amt;
      from.rewards.push({
        message: note ? `Cashback for: ${note}` : 'Cashback for Send Money',
        amount: getRandomReward(),
        scratched: false
      });
      await from.save();
      
      recipient.balance = Number(recipient.balance || 0) + amt;
      recipient.rewards.push({
        message: `Received cashback from ${from.name || from.email}`,
        amount: getRandomReward(),
        scratched: false
      });
      await recipient.save();
      
      // Create transaction
      const tx = new Transaction({
        type: 'send',
        from: from._id,
        to: recipient._id,
        amount: amt,
        meta: { note, demo: true }
      });
      await tx.save();
      
      return res.json({ message: 'Sent (demo mode)', transaction: tx, balance: from.balance, user: from });
    } catch (err) {
      return res.status(500).json({ message: err.message || 'Demo payment failed' });
    }
  }

  // Production mode - strict validation
  const normalizedEmail = String(toEmail).toLowerCase().trim();
  
  let recipient = await User.findOne({ email: normalizedEmail });
  if (!recipient) {
    recipient = new User({
      name: toEmail.split('@')[0] || 'New User',
      email: normalizedEmail,
      password: '$2b$10$unregistereduserdummyhash',
      role: 'user',
      balance: 0
    });
    await recipient.save();
  }
  if (recipient._id.equals(from._id)) return res.status(400).json({ message: 'Cannot send to yourself' });

  try {
    const tx = await sendMoney(from._id, recipient._id, Number(amount), { note });
    
    // Auto reward for sender in production mode
    const u = await User.findById(from._id);
    if (u) {
      u.rewards.push({
        message: note ? `Cashback for: ${note}` : 'Cashback for Send Money',
        amount: getRandomReward(),
        scratched: false
      });
      await u.save();
    }

    // Auto reward for recipient in production mode
    const r = await User.findById(recipient._id);
    if (r) {
      r.rewards.push({
        message: `Received cashback from ${u ? (u.name || u.email) : 'Sender'}`,
        amount: getRandomReward(),
        scratched: false
      });
      await r.save();
    }

    res.json({ message: 'Sent', transaction: tx, user: u });
  } catch (err) {
    // Better error messages
    const errMsg = err.message || 'Transfer failed';
    if (/insufficient/i.test(errMsg)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    return res.status(500).json({ message: errMsg });
  }
};

const history = async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page || '1');
  const limit = Math.min(50, parseInt(req.query.limit || '20'));
  const skip = (page - 1) * limit;

  // fetch transactions where user is from or to
  const docs = await Transaction.find({ $or: [{ from: userId }, { to: userId }] })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('from', 'name email')
    .populate('to', 'name email')
    .lean();

  res.json({ page, limit, data: docs });
};

// Create a Stripe PaymentIntent for depositing (top-up)
const createDeposit = async (req, res) => {
  const user = req.user;
  const { amount } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Invalid amount' });

  // Stripe expects amount in smallest currency unit (paise)
  const amountInt = Math.round(Number(amount) * 100);

  const pi = await stripe.paymentIntents.create({
    amount: amountInt,
    currency: 'inr',
    metadata: { userId: user._id.toString(), purpose: 'wallet_deposit' }
  });

  res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
};

// Confirm deposit: verify PaymentIntent and credit user's balance (idempotent)
const confirmDeposit = async (req, res) => {
  const user = req.user;
  const { paymentIntentId } = req.body;
  if (!paymentIntentId) return res.status(400).json({ message: 'Missing paymentIntentId' });

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!pi) return res.status(404).json({ message: 'PaymentIntent not found' });
  if (pi.status !== 'succeeded') return res.status(400).json({ message: 'Payment not completed' });

  // avoid double-crediting: check if a transaction already exists for this paymentIntent
  const exists = await Transaction.findOne({ 'meta.paymentIntentId': paymentIntentId });
  if (exists) return res.json({ message: 'Already processed', transaction: exists });

  // credit user
  const amountDecimal = (pi.amount || 0) / 100;
  const u = await User.findById(user._id);
  u.balance = (u.balance || 0) + amountDecimal;
  u.rewards.push({
    message: 'Cashback for Top-up',
    amount: getRandomReward(),
    scratched: false
  });
  await u.save();

  const tx = new Transaction({
    type: 'topup',
    from: null,
    to: u._id,
    amount: amountDecimal,
    meta: { paymentIntentId }
  });
  await tx.save();

  res.json({ message: 'Deposit credited', transaction: tx, user: u });
};

// Force deposit endpoint for demo/demo-mode: credits user's balance without Stripe verification.
// Allowed when NODE_ENV !== 'production' or when ENABLE_FORCE_DEPOSIT=1 is set in env.
const forceDeposit = async (req, res) => {
  // safety guard: enable demo deposits by default unless explicitly disabled with ENABLE_FORCE_DEPOSIT=0
  const allowed = process.env.ENABLE_FORCE_DEPOSIT !== '0';
  if (!allowed) return res.status(403).json({ message: 'Demo deposits are disabled on this server' });

  const user = req.user;
  const { amount, note } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Invalid amount' });

  const amt = Number(amount);
  // config: per-deposit max and daily total limit (both in same currency units as amount)
  const MAX_FORCE_DEPOSIT = Number(process.env.FORCE_DEPOSIT_MAX_AMOUNT || '10000');
  const DAILY_FORCE_LIMIT = Number(process.env.FORCE_DEPOSIT_DAILY_LIMIT || '10000');
  // Admins may bypass per-deposit and daily limits for demo/testing
  if (amt > MAX_FORCE_DEPOSIT && req.user.role !== 'admin') return res.status(400).json({ message: `Amount exceeds maximum allowed per deposit (${MAX_FORCE_DEPOSIT})` });

  // compute today's total forced deposits for this user
  const dayStart = new Date(); dayStart.setHours(0,0,0,0);
  const agg = await Transaction.aggregate([
    { $match: { to: user._id, 'meta.force': true, createdAt: { $gte: dayStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const todayTotal = (agg && agg[0] && agg[0].total) ? agg[0].total : 0;
  // Allow admins to bypass daily limit for testing purposes
  if (req.user.role !== 'admin' && (todayTotal + amt) > DAILY_FORCE_LIMIT) return res.status(429).json({ message: `Daily demo deposit limit exceeded (${DAILY_FORCE_LIMIT})` });

  const u = await User.findById(user._id);
  u.balance = (u.balance || 0) + amt;
  u.rewards.push({
    message: 'Cashback for Top-up',
    amount: getRandomReward(),
    scratched: false
  });
  await u.save();

  const tx = new Transaction({
    type: 'topup',
    from: null,
    to: u._id,
    amount: amt,
    meta: { force: true, note: note || 'demo force deposit' }
  });
  await tx.save();

  return res.json({ message: 'Force deposit applied', transaction: tx, balance: u.balance, user: u });
};

module.exports = { getBalance, send, history, createDeposit, confirmDeposit, forceDeposit };
