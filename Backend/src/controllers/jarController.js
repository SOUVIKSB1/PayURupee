const Jar = require('../models/jar');
const User = require('../models/user');
const Transaction = require('../models/transaction');
const bcrypt = require('bcrypt');

const listJars = async (req, res) => {
  try {
    const jars = await Jar.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ jars });
  } catch (err) {
    console.error('Error listing jars:', err);
    res.status(500).json({ message: 'Server error listing jars' });
  }
};

const createJar = async (req, res) => {
  const { title, targetAmount, category } = req.body;
  if (!title || !targetAmount) {
    return res.status(400).json({ message: 'Title and target amount are required' });
  }

  try {
    const jar = new Jar({
      user: req.user._id,
      title,
      targetAmount,
      category: category || 'other'
    });
    await jar.save();
    res.status(201).json({ message: 'Savings goal created successfully', jar });
  } catch (err) {
    console.error('Error creating jar:', err);
    res.status(500).json({ message: 'Server error creating savings goal' });
  }
};

const addMoneyToJar = async (req, res) => {
  const { jarId, amount, upiPin } = req.body;
  if (!jarId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Valid Jar ID and amount are required' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify UPI PIN
    if (!user.upiPin) {
      return res.status(400).json({ message: 'UPI PIN not set. Please set your PIN first.' });
    }
    if (!upiPin) {
      return res.status(400).json({ message: 'UPI PIN is required to authorize jar deposit' });
    }
    const pinOk = await bcrypt.compare(upiPin, user.upiPin);
    if (!pinOk) {
      return res.status(403).json({ message: 'Invalid UPI PIN' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    const jar = await Jar.findOne({ _id: jarId, user: user._id });
    if (!jar) return res.status(404).json({ message: 'Jar not found' });

    // Update balance and jar
    user.balance -= amount;
    jar.currentAmount += amount;

    await user.save();
    await jar.save();

    // Create a transaction record
    const tx = new Transaction({
      type: 'jar_deposit',
      from: user._id,
      to: null,
      amount,
      status: 'success',
      meta: {
        jarId: jar._id,
        jarTitle: jar.title,
        note: `Saved to Jar: ${jar.title}`
      }
    });
    await tx.save();

    res.json({
      message: `Successfully added ${amount} to ${jar.title}`,
      balance: user.balance,
      jar,
      user
    });
  } catch (err) {
    console.error('Error adding money to jar:', err);
    res.status(500).json({ message: 'Server error adding money to savings goal' });
  }
};

const withdrawMoneyFromJar = async (req, res) => {
  const { jarId, amount } = req.body;
  if (!jarId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Valid Jar ID and amount are required' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const jar = await Jar.findOne({ _id: jarId, user: user._id });
    if (!jar) return res.status(404).json({ message: 'Jar not found' });

    if (jar.currentAmount < amount) {
      return res.status(400).json({ message: 'Insufficient funds inside jar' });
    }

    // Update balance and jar
    jar.currentAmount -= amount;
    user.balance += amount;

    await user.save();
    await jar.save();

    // Create a transaction record
    const tx = new Transaction({
      type: 'jar_withdraw',
      from: null,
      to: user._id,
      amount,
      status: 'success',
      meta: {
        jarId: jar._id,
        jarTitle: jar.title,
        note: `Withdrawn from Jar: ${jar.title}`
      }
    });
    await tx.save();

    res.json({
      message: `Successfully withdrew ${amount} from ${jar.title}`,
      balance: user.balance,
      jar,
      user
    });
  } catch (err) {
    console.error('Error withdrawing from jar:', err);
    res.status(500).json({ message: 'Server error withdrawing from savings goal' });
  }
};

module.exports = {
  listJars,
  createJar,
  addMoneyToJar,
  withdrawMoneyFromJar
};
