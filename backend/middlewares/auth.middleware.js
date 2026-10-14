const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');
const { wrap, fail } = require('../utils/http');
exports.protect = wrap(async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) fail(401, 'Please log in to continue');
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { fail(401, 'Invalid or expired session'); }
  if (!/^[a-f\d]{24}$/i.test(decoded.id || '')) fail(401, 'Invalid session');
  req.user = await Customer.findById(decoded.id);
  if (!req.user) fail(401, 'Customer no longer exists');
  next();
});
