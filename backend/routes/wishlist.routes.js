const router = require('express').Router();
const c = require('../controllers/wishlist.controller');
const { protect } = require('../middlewares/auth.middleware');
const { wrap } = require('../utils/http');
router.use(protect);
router.get('/', wrap(c.list));
router.post('/:productId', wrap(c.add));
router.delete('/:productId', wrap(c.remove));
module.exports = router;
