const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const permit = require('../middleware/roles');
const { listUsers, listTransactions, createProvider } = require('../controllers/adminController');

router.use(auth);
router.use(permit('admin'));

router.get('/users', listUsers);
router.get('/transactions', listTransactions);
router.post('/provider', createProvider);

module.exports = router;
