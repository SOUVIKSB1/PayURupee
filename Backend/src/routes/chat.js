const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendChatMessage, getChatHistory } = require('../controllers/chatController');

router.post('/send', auth, sendChatMessage);
router.get('/history', auth, getChatHistory);

module.exports = router;
