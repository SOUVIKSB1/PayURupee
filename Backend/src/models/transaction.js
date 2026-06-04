const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['send', 'receive', 'bill', 'topup', 'admin_adjust'], required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // nullable for topup or bill provider
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // nullable for bill provider
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['success', 'failed', 'pending'], default: 'success' },
  meta: { type: Object }, // free form: bill details, provider, note, reference IDs
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

transactionSchema.index({ from: 1 });
transactionSchema.index({ to: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
