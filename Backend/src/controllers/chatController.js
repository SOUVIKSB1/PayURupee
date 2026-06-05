const ChatMessage = require('../models/chatMessage');
const User = require('../models/user');

const sendChatMessage = async (req, res) => {
  const senderEmail = req.user.email;
  const { recipientEmail, text, isRequest, amount } = req.body;
  
  if (!recipientEmail || !text) {
    return res.status(400).json({ message: 'Recipient email and text are required' });
  }

  // Confirm recipient exists
  const recipient = await User.findOne({ email: recipientEmail.toLowerCase().trim() });
  if (!recipient) {
    return res.status(404).json({ message: 'Recipient user not found' });
  }

  const message = new ChatMessage({
    sender: senderEmail,
    recipient: recipient.email,
    text,
    isRequest: !!isRequest,
    amount: amount ? Number(amount) : 0,
    read: false
  });

  await message.save();
  res.status(201).json({ message: 'Message sent successfully', chatMessage: message });
};

const getChatHistory = async (req, res) => {
  const userEmail = req.user.email;
  const { contactEmail } = req.query;

  if (!contactEmail) {
    return res.status(400).json({ message: 'Contact email query parameter is required' });
  }

  // Get all messages between the current user and the contact
  const messages = await ChatMessage.find({
    $or: [
      { sender: userEmail, recipient: contactEmail },
      { sender: contactEmail, recipient: userEmail }
    ]
  }).sort({ timestamp: 1 });

  res.json({ data: messages });
};

/**
 * GET /chat/unread
 * Returns a summary of unread message counts per sender for the logged-in user.
 * Used by the dashboard poll loop to show notification dots on contact avatars.
 */
const getUnreadMessages = async (req, res) => {
  const userEmail = req.user.email;

  // Find all unread messages where this user is the recipient
  const unreadMessages = await ChatMessage.find({
    recipient: userEmail,
    read: false
  }).sort({ timestamp: -1 });

  // Group by sender and pick the latest message text per sender
  const bySender = {};
  unreadMessages.forEach(msg => {
    if (!bySender[msg.sender]) {
      bySender[msg.sender] = {
        senderEmail: msg.sender,
        count: 0,
        latestText: msg.text,
        isRequest: msg.isRequest,
        latestAmount: msg.amount,
        latestTimestamp: msg.timestamp
      };
    }
    bySender[msg.sender].count += 1;
  });

  const result = Object.values(bySender);
  res.json({ unread: result, totalUnread: unreadMessages.length });
};

/**
 * POST /chat/mark-read
 * Marks all messages from a specific sender as read.
 * Called when user opens the contact drawer.
 */
const markMessagesRead = async (req, res) => {
  const userEmail = req.user.email;
  const { senderEmail } = req.body;

  if (!senderEmail) {
    return res.status(400).json({ message: 'senderEmail is required' });
  }

  await ChatMessage.updateMany(
    { sender: senderEmail, recipient: userEmail, read: false },
    { $set: { read: true } }
  );

  res.json({ message: 'Messages marked as read' });
};

/**
 * POST /chat/send-bulk
 * Sends a money request to multiple recipients simultaneously (Split Bill feature).
 * Body: { recipients: [email], text, amount }
 */
const sendBulkChatMessages = async (req, res) => {
  const senderEmail = req.user.email;
  const { recipients, text, amount } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: 'recipients array is required' });
  }
  if (!text || !amount) {
    return res.status(400).json({ message: 'text and amount are required' });
  }

  const results = [];
  const errors = [];

  for (const recipientEmail of recipients) {
    try {
      const recipient = await User.findOne({ email: recipientEmail.toLowerCase().trim() });
      if (!recipient) {
        errors.push({ email: recipientEmail, error: 'User not found' });
        continue;
      }
      const msg = new ChatMessage({
        sender: senderEmail,
        recipient: recipient.email,
        text,
        isRequest: true,
        amount: Number(amount),
        read: false
      });
      await msg.save();
      results.push({ email: recipientEmail, messageId: msg._id });
    } catch (err) {
      errors.push({ email: recipientEmail, error: err.message });
    }
  }

  res.status(201).json({ sent: results, errors, total: results.length });
};

module.exports = { sendChatMessage, getChatHistory, getUnreadMessages, markMessagesRead, sendBulkChatMessages };
