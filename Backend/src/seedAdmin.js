require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('./config/db');
const User = require('./models/user');
const BillProvider = require('./models/billProvider');

async function seed() {
  await connectDB();

  const adminEmail = process.env.ADMIN_EMAIL || '123@admin.com';
  const adminPassword = process.env.ADMIN_PASSWORD || '123456';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const hashed = await bcrypt.hash(adminPassword, 6);
    admin = new User({ name: 'Admin', email: adminEmail, password: hashed, role: 'admin', balance: 0 });
    await admin.save();
    console.log('Admin created:', adminEmail);
  } else {
    console.log('Admin already exists');
  }

  // seed providers
  const providers = [
    { name: 'City Electricity', code: 'ELEC_CITY', description: 'Electricity provider' },
    { name: 'Water Board', code: 'WATER_BOARD', description: 'Municipal water' },
    { name: 'Gas Provider', code: 'GAS_CORP', description: 'Gas bills' }
  ];
  for (const p of providers) {
    const exists = await BillProvider.findOne({ code: p.code });
    if (!exists) {
      await new BillProvider(p).save();
      console.log('Provider seeded:', p.code);
    }
  }

  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
