#!/usr/bin/env node
// Seed some sample bill providers for the demo
require('dotenv').config();
const mongoose = require('mongoose');
const BillProvider = require('../src/models/billProvider');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ewallet';

const SAMPLE = [
  { name: 'City Electricity Board', code: 'ELECTRIC_CITY', description: 'Residential and commercial electricity' },
  { name: 'State Water Works', code: 'WATER_STATE', description: 'Water and sewerage services' },
  { name: 'Metro Gas Co', code: 'GAS_METRO', description: 'Domestic and industrial gas supply' },
  { name: 'FastCable TV', code: 'CABLE_FAST', description: 'Cable and DTH subscriptions' },
  { name: 'BroadNet ISP', code: 'ISP_BROADNET', description: 'Home and business internet' }
];

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGO_URI);

  for (const p of SAMPLE) {
    try {
      const existing = await BillProvider.findOne({ code: p.code });
      if (existing) {
        console.log('Skipping existing provider:', p.code);
        continue;
      }
      const np = new BillProvider(p);
      await np.save();
      console.log('Created provider:', p.code);
    } catch (e) {
      console.error('Failed to create', p.code, e.message || e);
    }
  }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
