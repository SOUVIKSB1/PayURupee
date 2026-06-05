const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sender: { type: String, required: true }, // sender email
  recipient: { type: String, required: true }, // recipient email
  text: { type: String, required: true },
  isRequest: { type: Boolean, default: false },
  amount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

chatMessageSchema.index({ sender: 1, recipient: 1 });
chatMessageSchema.index({ recipient: 1, sender: 1 });
chatMessageSchema.index({ timestamp: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
