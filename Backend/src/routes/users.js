const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getProfile, uploadQr } = require('../controllers/userController');
const { upload } = require('../middleware/upload');

router.get('/me', auth, getProfile);
router.post('/upload-qr', auth, upload.single('qr'), uploadQr);

module.exports = router;
