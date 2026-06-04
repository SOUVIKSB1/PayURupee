const mongoose = require('mongoose');
const User = require('../models/user');
const Transaction = require('../models/transaction');

async function sendMoney(fromUserId, toUserId, amount, meta = {}) {
  if (amount <= 0) throw new Error('Amount must be positive');
  
  let session = null;
  let usedSession = false;
  
  try {
    // Try to start a session (works only with replica sets)
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      usedSession = true;
    } catch (sessionErr) {
      console.warn('MongoDB transactions not supported (likely standalone mode). Proceeding without session.');
      session = null;
      usedSession = false;
    }

    // Fetch users with or without session
    const sender = session 
      ? await User.findById(fromUserId).session(session)
      : await User.findById(fromUserId);
    const receiver = session
      ? await User.findById(toUserId).session(session)
      : await User.findById(toUserId);

    if (!sender) throw new Error('Sender not found');
    if (!receiver) throw new Error('Receiver not found');
    if (sender.balance < amount) throw new Error('Insufficient balance');

    // Update balances
    sender.balance = Number(sender.balance) - Number(amount);
    receiver.balance = Number(receiver.balance) + Number(amount);
    
    if (session) {
      await sender.save({ session });
      await receiver.save({ session });
    } else {
      await sender.save();
      await receiver.save();
    }

    // Create transaction record
    const tx = new Transaction({
      type: 'send',
      from: sender._id,
      to: receiver._id,
      amount: Number(amount),
      meta
    });
    
    if (session) {
      await tx.save({ session });
      await session.commitTransaction();
      session.endSession();
    } else {
      await tx.save();
    }

    return tx;
  } catch (err) {
    if (usedSession && session) {
      try { await session.abortTransaction(); } catch (_) {}
      try { session.endSession(); } catch (_) {}
    }
    throw err;
  }
}

module.exports = { sendMoney };
