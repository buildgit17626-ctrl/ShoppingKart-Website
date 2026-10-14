const crypto = require('crypto');
const mongoose = require('mongoose');
const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const payment = require('../config/razorpay');
const { fail } = require('../utils/http');
const orderId = id => { if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) fail(400, 'Invalid order ID'); };
const canManage = user => process.env.NODE_ENV !== 'production' && (process.env.ORDER_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).includes(user.email);
function address(input) {
  const result = {};
  for (const key of ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode']) {
    if (typeof input?.[key] !== 'string' || !input[key].trim() || input[key].length > 250) fail(400, 'All shipping fields are required and must contain valid text');
    result[key] = input[key].trim();
  }
  if (!/^[6-9]\d{9}$/.test(result.phone)) fail(400, 'Phone must be a valid 10-digit Indian mobile number');
  if (!/^[1-9]\d{5}$/.test(result.pincode)) fail(400, 'Pincode must contain 6 digits');
  return result;
}
const checkoutData = order => ({ success: true, shopKartOrderId: order._id, razorpayOrderId: order.razorpayOrderId, amount: order.amountInPaise, currency: 'INR', key: payment.credentials().key, order });
exports.create = async (req, res) => {
  const shippingAddress = address(req.body.shippingAddress);
  const customer = await Customer.findById(req.user._id);
  if (!customer.cart.length) fail(400, 'Your cart is empty');
  const products = await Product.find({ _id: { $in: customer.cart.map(i => i.product) } });
  const items = customer.cart.map(item => {
    const product = products.find(p => p._id.equals(item.product));
    if (!product) fail(400, 'A product in your cart is no longer available. Remove it before checkout.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) fail(400, 'Insufficient stock for ' + product.name);
    return { product: product._id, name: product.name, price: product.price, quantity: item.quantity, image: product.image };
  });
  const amountInPaise = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 100) fail(400, 'Order total must be at least ₹1');
  const requestId = req.get('Idempotency-Key') || crypto.randomUUID();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) fail(400, 'Invalid checkout request identifier');
  const provider = payment.client(req);
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') fail(503, 'Checkout requires a MongoDB replica set for atomic payment confirmation. Use npm run db or MongoDB Atlas.');
  const previous = await Order.findOne({ user: customer._id, requestId });
  if (previous) {
    if (previous.paymentStatus === 'PAID') fail(409, 'This order has already been paid');
    if (previous.razorpayOrderId) return res.json(checkoutData(previous));
    fail(409, 'This payment attempt could not be completed. Start a new checkout attempt.');
  }
  const order = await Order.create({ user: customer._id, requestId, items, shippingAddress, totalAmount: amountInPaise / 100, amountInPaise });
  try {
    const remote = await provider.orders.create({ amount: amountInPaise, currency: 'INR', receipt: order._id.toString() });
    if (!remote?.id || remote.amount !== amountInPaise || remote.currency !== 'INR') throw new Error('Invalid provider order');
    order.razorpayOrderId = remote.id;
    await order.save();
  } catch {
    await Order.updateOne({ _id: order._id }, { paymentStatus: 'FAILED', providerCreationFailed: true });
    fail(502, 'Unable to create Razorpay payment order. Your cart is unchanged. Please try again.');
  }
  res.status(201).json(checkoutData(order));
};
exports.verify = async (req, res) => {
  const { shopKartOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  orderId(shopKartOrderId);
  if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(v => typeof v === 'string' && v)) fail(400, 'Payment identifiers and signature are required');
  const order = await Order.findOne({ _id: shopKartOrderId, user: req.user._id });
  if (!order) fail(404, 'Order not found');
  if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id) fail(400, 'Payment order does not match');
  const expected = crypto.createHmac('sha256', payment.credentials().secret).update(order.razorpayOrderId + '|' + razorpay_payment_id).digest();
  if (!/^[a-f\d]{64}$/i.test(razorpay_signature) || !crypto.timingSafeEqual(expected, Buffer.from(razorpay_signature, 'hex'))) fail(400, 'Invalid payment signature');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await Order.findOne({ _id: order._id, user: req.user._id }).session(session);
      if (current.paymentStatus === 'PAID') {
        if (current.razorpayPaymentId !== razorpay_payment_id) fail(409, 'Order already has another verified payment');
        return; // Idempotent callbacks never clear a newly populated cart.
      }
      current.paymentStatus = 'PAID'; current.status = 'PLACED'; current.razorpayPaymentId = razorpay_payment_id;
      await current.save({ session });
      await Customer.updateOne({ _id: req.user._id }, { $set: { cart: [] }, $inc: { __v: 1 } }, { session });
    });
  } catch (error) {
    if (error.code === 20) fail(503, 'Payment confirmation requires a MongoDB replica set. Use npm run db or MongoDB Atlas. Your cart is unchanged.');
    throw error;
  } finally { await session.endSession(); }
  res.json({ success: true, message: 'Payment verified. Order placed successfully.', order: await Order.findById(order._id), cart: [] });
};
exports.list = async (req, res) => res.json({ success: true, orders: await Order.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 }), canManageStatus: canManage(req.user) });
exports.get = async (req, res) => {
  orderId(req.params.id);
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) fail(404, 'Order not found');
  res.json({ success: true, order, canManageStatus: canManage(req.user) });
};
exports.progress = async (req, res) => {
  if (!canManage(req.user)) fail(403, 'Development order management is not enabled for this account');
  orderId(req.params.id);
  const steps = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
  const index = steps.indexOf(req.body.status);
  if (index < 1) fail(400, 'Choose the next order status');
  const order = await Order.findOneAndUpdate({ _id: req.params.id, user: req.user._id, paymentStatus: 'PAID', status: steps[index - 1] }, { status: steps[index] }, { new: true });
  if (!order) fail(409, 'Only paid orders can advance, one step at a time');
  res.json({ success: true, order });
};
