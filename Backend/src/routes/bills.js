const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listProviders, payBill } = require('../controllers/billController');

router.get('/providers', auth, listProviders);
router.post('/pay', auth, payBill);

module.exports = router;
