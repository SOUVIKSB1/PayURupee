const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Jimp = require('jimp');
const QrCode = require('qrcode-reader');

const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  const userObj = user.toObject();
  userObj.hasUpiPin = !!user.upiPin;
  delete userObj.upiPin;
  res.json({ user: userObj });
};

const updateProfile = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name.trim();
    await user.save();

    const userObj = user.toObject();
    userObj.hasUpiPin = !!user.upiPin;
    delete userObj.upiPin;
    delete userObj.password;

    res.json({ message: 'Profile updated successfully', user: userObj });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

const uploadQr = async (req, res) => {
  const user = req.user;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const filePath = req.file.path;
  try {
    const img = await Jimp.read(filePath);
    const qr = new QrCode();

    const value = await new Promise((resolve, reject) => {
      qr.callback = (err, v) => {
        if (err) return reject(err);
        resolve(v);
      };
      qr.decode(img.bitmap);
    });

    if (!value || !value.result) {
      // not a QR
      try { fs.unlinkSync(filePath); } catch (_) {}
      return res.status(400).json({ message: 'Uploaded file does not contain a QR code' });
    }

    // store relative path and parsed data
    user.qrImagePath = `/uploads/qr/${req.file.filename}`;
    user.qrData = value.result;
    await user.save();

    res.json({ message: 'QR uploaded', path: user.qrImagePath, data: value.result });
  } catch (err) {
    // cleanup file on error
    try { fs.unlinkSync(filePath); } catch (_) {}
    console.error('QR decode error', err);
    return res.status(400).json({ message: 'Failed to decode QR code' });
  }
};

const Transaction = require('../models/transaction');

const claimReward = async (req, res) => {
  const { rewardId } = req.body;
  if (!rewardId) return res.status(400).json({ message: 'Missing rewardId' });

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find the reward
    const reward = user.rewards.id(rewardId);
    if (!reward) return res.status(404).json({ message: 'Reward not found' });

    if (reward.scratched) {
      return res.status(400).json({ message: 'Reward already claimed' });
    }

    reward.scratched = true;
    user.balance = (user.balance || 0) + reward.amount;
    await user.save();

    // Create a transaction record
    const tx = new Transaction({
      type: 'topup',
      from: null,
      to: user._id,
      amount: reward.amount,
      meta: { force: true, note: `Cashback Reward: ${reward.message || 'Scratch Card'}` }
    });
    await tx.save();

    res.json({ message: 'Reward claimed successfully', balance: user.balance, user });
  } catch (err) {
    console.error('Error claiming reward:', err);
    res.status(500).json({ message: 'Server error claiming reward' });
  }
};

const listContacts = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const contacts = await User.find({
      role: 'user',
      isBlocked: false,
      _id: { $ne: currentUserId }
    })
    .select('name email')
    .limit(10)
    .lean();
    
    res.json({ contacts });
  } catch (err) {
    console.error('Error listing contacts:', err);
    res.status(500).json({ message: 'Server error listing contacts' });
  }
};

const setUpiPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN must be exactly 6 digits' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.upiPin) {
      return res.status(400).json({ message: 'UPI PIN already set. Use change-pin to update.' });
    }

    user.upiPin = await bcrypt.hash(pin, 10);
    await user.save();
    res.json({ message: 'UPI PIN set successfully' });
  } catch (err) {
    console.error('Error setting UPI PIN:', err);
    res.status(500).json({ message: 'Server error setting UPI PIN' });
  }
};

const changeUpiPin = async (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!currentPin || !newPin) {
    return res.status(400).json({ message: 'Both currentPin and newPin are required' });
  }
  if (!/^\d{6}$/.test(newPin)) {
    return res.status(400).json({ message: 'New PIN must be exactly 6 digits' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.upiPin) {
      return res.status(400).json({ message: 'UPI PIN not set yet. Use set-pin first.' });
    }

    const isMatch = await bcrypt.compare(currentPin, user.upiPin);
    if (!isMatch) {
      return res.status(403).json({ message: 'Current UPI PIN is incorrect' });
    }

    user.upiPin = await bcrypt.hash(newPin, 10);
    await user.save();
    res.json({ message: 'UPI PIN changed successfully' });
  } catch (err) {
    console.error('Error changing UPI PIN:', err);
    res.status(500).json({ message: 'Server error changing UPI PIN' });
  }
};

const verifyUpiPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN must be exactly 6 digits' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.upiPin) {
      return res.status(400).json({ message: 'UPI PIN not set yet' });
    }

    const isMatch = await bcrypt.compare(pin, user.upiPin);
    if (!isMatch) {
      return res.status(403).json({ message: 'Current UPI PIN is incorrect' });
    }

    res.json({ message: 'UPI PIN verified successfully' });
  } catch (err) {
    console.error('Error verifying UPI PIN:', err);
    res.status(500).json({ message: 'Server error verifying UPI PIN' });
  }
};

module.exports = { getProfile, updateProfile, uploadQr, claimReward, listContacts, setUpiPin, changeUpiPin, verifyUpiPin };
