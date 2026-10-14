const router = require('express').Router();
const c = require('../controllers/product.controller');
const { wrap } = require('../utils/http');
router.post('/', wrap(c.create));
router.get('/', wrap(c.list));
router.get('/:id', wrap(c.get));
module.exports = router;
