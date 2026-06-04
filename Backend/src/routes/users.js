const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getProfile, uploadQr, claimReward } = require('../controllers/userController');
const { upload } = require('../middleware/upload');

router.get('/me', auth, getProfile);
router.post('/upload-qr', auth, upload.single('qr'), uploadQr);
router.post('/claim-reward', auth, claimReward);

module.exports = router;
