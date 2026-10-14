const Razorpay = require('razorpay');
const { fail } = require('../utils/http');
exports.credentials = () => {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!/^rzp_test_/.test(key || '') || !secret) fail(503, 'Razorpay Test Mode is not configured. Add test keys to backend/.env and restart the API.');
  return { key, secret };
};
exports.client = req => {
  const { key, secret } = exports.credentials();
  // Only tests inject a provider double on their isolated Express instance.
  return req.app.locals.paymentProvider || new Razorpay({ key_id: key, key_secret: secret });
};
