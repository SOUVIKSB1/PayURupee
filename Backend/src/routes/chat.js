const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendChatMessage, getChatHistory, getUnreadMessages, markMessagesRead } = require('../controllers/chatController');

router.post('/send', auth, sendChatMessage);
router.get('/history', auth, getChatHistory);
router.get('/unread', auth, getUnreadMessages);
router.post('/mark-read', auth, markMessagesRead);

module.exports = router;
