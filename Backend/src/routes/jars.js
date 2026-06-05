const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listJars, createJar, addMoneyToJar, withdrawMoneyFromJar } = require('../controllers/jarController');

router.get('/', auth, listJars);
router.post('/create', auth, createJar);
router.post('/add', auth, addMoneyToJar);
router.post('/withdraw', auth, withdrawMoneyFromJar);

module.exports = router;
