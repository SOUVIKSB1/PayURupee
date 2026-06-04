const fs = require('fs');
const path = require('path');
const User = require('../models/user');
const Jimp = require('jimp');
const QrCode = require('qrcode-reader');

const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ user });
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

module.exports = { getProfile, uploadQr, claimReward };
