const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const permit = require('../middleware/roles');
const {
  listUsers,
  listTransactions,
  createProvider,
  deleteProvider,
  awardReward,
  adjustBalance,
  getSettings,
  updateSettings,
  toggleBlockUser,
  deleteUser,
  listAuditLogs
} = require('../controllers/adminController');

router.use(auth);
router.use(permit('admin'));

router.get('/users', listUsers);
router.get('/transactions', listTransactions);
router.post('/provider', createProvider);
router.delete('/provider/:id', deleteProvider);
router.post('/award-reward', awardReward);
router.post('/adjust-balance', adjustBalance);
router.get('/settings', getSettings);
router.post('/settings', updateSettings);
router.post('/users/:id/block', toggleBlockUser);
router.delete('/users/:id', deleteUser);
router.get('/audit-logs', listAuditLogs);

module.exports = router;
