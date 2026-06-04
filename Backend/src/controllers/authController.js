const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const signToken = (user) => {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
};

const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already used' });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashed, role: 'user', balance: 0 });
  await user.save();

  const token = signToken(user);

  res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance } });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.isBlocked) return res.status(403).json({ message: 'Account is blocked. Please contact admin.' });

  const token = signToken(user);
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance } });
};

const resetPassword = async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(404).json({ message: 'User not found with this email' });
  }

  const hashed = await bcrypt.hash(password, 10);
  user.password = hashed;
  await user.save();

  res.json({ message: 'Password reset successful' });
};

module.exports = { register, login, resetPassword };
