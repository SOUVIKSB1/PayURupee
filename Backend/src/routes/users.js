const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getProfile, uploadQr, claimReward, listContacts, setUpiPin, changeUpiPin } = require('../controllers/userController');
const { upload } = require('../middleware/upload');

router.get('/me', auth, getProfile);
router.get('/contacts', auth, listContacts);
router.post('/upload-qr', auth, upload.single('qr'), uploadQr);
router.post('/claim-reward', auth, claimReward);
router.post('/set-pin', auth, setUpiPin);
router.post('/change-pin', auth, changeUpiPin);

module.exports = router;
