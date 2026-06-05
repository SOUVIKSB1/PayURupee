const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getProfile, updateProfile, uploadQr, claimReward, listContacts, setUpiPin, changeUpiPin, verifyUpiPin } = require('../controllers/userController');
const { upload } = require('../middleware/upload');

router.get('/me', auth, getProfile);
router.post('/update', auth, updateProfile);
router.get('/contacts', auth, listContacts);
router.post('/upload-qr', auth, upload.single('qr'), uploadQr);
router.post('/claim-reward', auth, claimReward);
router.post('/set-pin', auth, setUpiPin);
router.post('/change-pin', auth, changeUpiPin);
router.post('/verify-pin', auth, verifyUpiPin);

module.exports = router;
