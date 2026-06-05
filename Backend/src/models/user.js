const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  balance: { type: Number, default: 0 }, // in smallest currency unit or decimals as per need
  qrImagePath: { type: String }, // relative path to uploaded QR
  googleId: { type: String }, // Google OAuth user ID
  isBlocked: { type: Boolean, default: false },
  upiPin: { type: String, default: null },
  rewards: [{
    message: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    scratched: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', function(next) {
  if (this.isNew && this.role === 'user') {
    if (!this.rewards) {
      this.rewards = [];
    }
    const hasWelcome = this.rewards.some(r => r.amount === 1000 && r.message === 'Welcome Bonus');
    if (!hasWelcome) {
      this.rewards.push({
        message: 'Welcome Bonus',
        amount: 1000,
        scratched: false
      });
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
