const router = require('express').Router();
const { protect } = require('../middlewares/auth.middleware');
const { wrap } = require('../utils/http');
const c = require('../controllers/order.controller');
router.use(protect);
router.post('/create-payment-order', wrap(c.create));
router.post('/', wrap(c.create)); // Compatibility with the lab's POST /orders test example.
router.post('/verify-payment', wrap(c.verify));
router.get('/', wrap(c.list));
router.get('/:id', wrap(c.get));
router.patch('/:id/status', wrap(c.progress));
module.exports = router;
