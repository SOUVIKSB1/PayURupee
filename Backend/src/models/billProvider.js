const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true }, // e.g., "ELECTRIC_CORP"
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BillProvider', providerSchema);
