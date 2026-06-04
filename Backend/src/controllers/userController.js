const fs = require('fs');
const path = require('path');
const User = require('../models/user');
const Jimp = require('jimp');
const QrCode = require('qrcode-reader');

const getProfile = async (req, res) => {
  const user = req.user;
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

module.exports = { getProfile, uploadQr };
