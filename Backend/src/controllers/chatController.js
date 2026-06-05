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
    amount: amount ? Number(amount) : 0
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

module.exports = { sendChatMessage, getChatHistory };
