// Lightweight script to promote an existing user to admin
// Usage: node scripts/makeAdmin.js user@example.com

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ewallet';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/makeAdmin.js user@example.com');
    process.exit(2);
  }

  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGO_URI);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error('User not found:', email);
    process.exit(3);
  }

  user.role = 'admin';
  await user.save();
  console.log('User promoted to admin:', user.email, 'id=', user._id.toString());
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
