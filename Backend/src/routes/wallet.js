const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getBalance, send, history } = require('../controllers/walletController');
const { createDeposit, confirmDeposit, forceDeposit } = require('../controllers/walletController');

router.get('/balance', auth, getBalance);
router.post('/send', auth, send);
router.post('/deposit/create', auth, createDeposit);
router.post('/deposit/confirm', auth, confirmDeposit);
router.post('/deposit/force', auth, forceDeposit);
router.get('/history', auth, history);

module.exports = router;
