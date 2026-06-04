require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/user');
const Transaction = require('./models/transaction');
const BillProvider = require('./models/billProvider');

async function clear() {
  await connectDB();
  
  console.log('Clearing database collections...');
  
  const resTx = await Transaction.deleteMany({});
  console.log(`Deleted ${resTx.deletedCount} transactions.`);
  
  const resUser = await User.deleteMany({});
  console.log(`Deleted ${resUser.deletedCount} users.`);
  
  const resProv = await BillProvider.deleteMany({});
  console.log(`Deleted ${resProv.deletedCount} bill providers.`);
  
  console.log('Database cleared successfully.');
  process.exit(0);
}

clear().catch(err => {
  console.error('Failed to clear database:', err);
  process.exit(1);
});
