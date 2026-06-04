// Create or replace an admin user (create user if not exists, set role=admin)
// Usage: node scripts/createAdmin.js email@example.com password

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/user');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ewallet';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Usage: node scripts/createAdmin.js email@example.com password');
    process.exit(2);
  }

  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGO_URI);

  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    user = new User({ name: 'Admin', email: email.toLowerCase(), password: hashed, role: 'admin', balance: 0 });
    await user.save();
    console.log('Admin user created:', user.email);
  } else {
    // update password and role
    user.password = await bcrypt.hash(password, 10);
    user.role = 'admin';
    await user.save();
    console.log('User updated to admin:', user.email);
  }

  console.log('User id:', user._id.toString());
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
