const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.JWT_SECRET = 'orders-test-secret-only-012345678901234';
process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture';
process.env.RAZORPAY_KEY_SECRET = 'test-provider-secret-never-used-outside-tests';
process.env.NODE_ENV = 'test';
const app = require('../app');
const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
test('Lab 06: checkout, Razorpay boundary, signature, transaction, ownership and snapshots', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri()); await Promise.all([Customer.init(), Product.init(), Order.init()]);
  let providerFailure = false, providerCalls = 0, lastProviderRequest;
  app.locals.paymentProvider = { orders: { create: async input => {
    providerCalls++; lastProviderRequest = input;
    if (providerFailure) throw new Error('Deliberate provider outage');
    return { id: 'order_fixture_' + providerCalls, amount: input.amount, currency: 'INR' };
  } } };
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie = '', other = '', customerId, productId, paidId;
  const shippingAddress = { fullName: 'Test Customer', phone: '9876543210', addressLine1: '22 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' };
  const missing = new mongoose.Types.ObjectId().toString();
  const request = async (method, url, body, session = cookie, headers = {}) => {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  const expect = async (method, url, body, status, session, headers) => { const r = await request(method, url, body, session, headers); assert.equal(r.status, status, JSON.stringify(r.data)); return r; };
  const create = async (extra = {}, headers) => (await expect('POST', '/orders/create-payment-order', { shippingAddress, ...extra }, 201, cookie, headers)).data;
  const signed = data => {
    const paymentId = 'pay_fixture_' + data.shopKartOrderId;
    return { shopKartOrderId: data.shopKartOrderId, razorpay_order_id: data.razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(data.razorpayOrderId + '|' + paymentId).digest('hex') };
  };
  const cart = async quantity => Customer.updateOne({ _id: customerId }, { $set: { cart: [{ product: productId, quantity }] }, $inc: { __v: 1 } });
  try {
    for (const email of ['orders@example.com', 'other@example.com']) {
      const r = await expect('POST', '/customers/register', { fullName: 'Test Customer', email, password: 'secret123', phone: shippingAddress.phone }, 201, '');
      const login = await expect('POST', '/customers/login', { email, password: 'secret123' }, 200, '');
      if (email.startsWith('orders')) { customerId = r.data.customer._id; cookie = login.cookie.split(';')[0]; } else other = login.cookie.split(';')[0];
    }
    productId = (await Product.create({ name: 'Snapshot Product', description: 'Original description', price: 123.45, category: 'Home', image: '/images/mug.svg', stock: 5 }))._id.toString();
    await t.test('all order APIs protected; empty cart; shipping validation', async () => {
      for (const [method, url, body] of [['GET', '/orders'], ['GET', '/orders/' + missing], ['POST', '/orders/create-payment-order', { shippingAddress }], ['POST', '/orders/verify-payment', {}], ['PATCH', '/orders/' + missing + '/status', { status: 'CONFIRMED' }]]) await expect(method, url, body, 401, '');
      await expect('POST', '/orders', { shippingAddress }, 400);
      await cart(2);
      for (const bad of [{ fullName: ' ' }, { phone: 'abc' }, { phone: '123' }, { pincode: '12345' }, { pincode: '      ' }, { city: null }, { addressLine1: '' }]) await expect('POST', '/orders/create-payment-order', { shippingAddress: { ...shippingAddress, ...bad } }, 400);
      assert.equal(providerCalls, 0);
    });
    await t.test('latest stock and product existence rechecked; deleted cart row remains removable', async () => {
      await Product.findByIdAndUpdate(productId, { stock: 1 }); await expect('POST', '/orders/create-payment-order', { shippingAddress }, 400); assert.equal(providerCalls, 0);
      await Customer.updateOne({ _id: customerId }, { cart: [{ product: missing, quantity: 1 }] });
      await expect('POST', '/orders/create-payment-order', { shippingAddress }, 400);
      const unavailable = await expect('GET', '/cart', undefined, 200); assert.equal(unavailable.data.cart[0].product._id, missing); assert.equal(unavailable.data.cart[0].product.unavailable, true);
      await expect('DELETE', '/cart/' + missing, undefined, 200); await Product.findByIdAndUpdate(productId, { stock: 5 }); await cart(2);
    });
    await t.test('configuration refuses missing or live keys; no cart clearing', async () => {
      const key = process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_ID;
      await expect('POST', '/orders/create-payment-order', { shippingAddress }, 503);
      process.env.RAZORPAY_KEY_ID = 'rzp_live_rejected'; await expect('POST', '/orders/create-payment-order', { shippingAddress }, 503);
      process.env.RAZORPAY_KEY_ID = key; assert.equal((await Customer.findById(customerId)).cart.length, 1);
    });
    await t.test('pending snapshot, paise, fake total ignored, safe checkout data and request idempotency', async () => {
      const data = await create({ totalAmount: 1, items: [] }, { 'Idempotency-Key': 'same-checkout-request-01' }); paidId = data.shopKartOrderId;
      assert.equal(data.amount, 24690); assert.equal(lastProviderRequest.amount, 24690); assert.equal(lastProviderRequest.currency, 'INR'); assert.equal(lastProviderRequest.receipt, paidId);
      assert.equal(data.order.totalAmount, 246.9); assert.equal(data.order.paymentStatus, 'PENDING'); assert.equal(data.order.status, 'PENDING_PAYMENT'); assert.equal(data.order.items[0].name, 'Snapshot Product');
      assert.equal(JSON.stringify(data).includes(process.env.RAZORPAY_KEY_SECRET), false); assert.equal((await Customer.findById(customerId)).cart.length, 1);
      const calls = providerCalls; const retry = await expect('POST', '/orders/create-payment-order', { shippingAddress }, 200, cookie, { 'Idempotency-Key': 'same-checkout-request-01' }); assert.equal(retry.data.shopKartOrderId, paidId); assert.equal(providerCalls, calls);
    });
    await t.test('ownership, malformed IDs, fake signatures and mismatched provider IDs reject', async () => {
      await expect('GET', '/orders/bad', undefined, 400); await expect('GET', '/orders/' + missing, undefined, 404); await expect('GET', '/orders/' + paidId, undefined, 404, other);
      const data = (await expect('GET', '/orders/' + paidId, undefined, 200)).data.order; const payload = signed({ shopKartOrderId: paidId, razorpayOrderId: data.razorpayOrderId });
      await expect('POST', '/orders/verify-payment', payload, 404, other);
      await expect('POST', '/orders/verify-payment', { ...payload, razorpay_signature: '0'.repeat(64), paymentSuccess: true }, 400);
      await expect('POST', '/orders/verify-payment', { ...payload, razorpay_order_id: 'order_other' }, 400);
      await expect('POST', '/orders/verify-payment', { ...payload, razorpay_signature: 'fake' }, 400);
      assert.equal((await Order.findById(paidId)).paymentStatus, 'PENDING'); assert.equal((await Customer.findById(customerId)).cart.length, 1);
    });
    await t.test('transaction rollback preserves pending order and cart; signed retry atomically confirms', async () => {
      const order = await Order.findById(paidId); const payload = signed({ shopKartOrderId: paidId, razorpayOrderId: order.razorpayOrderId });
      const original = Customer.updateOne;
      Customer.updateOne = () => { throw new Error('Injected database failure'); };
      try { await expect('POST', '/orders/verify-payment', payload, 500); } finally { Customer.updateOne = original; }
      assert.equal((await Order.findById(paidId)).paymentStatus, 'PENDING'); assert.equal((await Customer.findById(customerId)).cart.length, 1);
      const verified = await expect('POST', '/orders/verify-payment', payload, 200); assert.equal(verified.data.order.paymentStatus, 'PAID'); assert.equal(verified.data.order.status, 'PLACED'); assert.equal(verified.data.order.razorpayPaymentId, payload.razorpay_payment_id); assert.deepEqual(verified.data.cart, []); assert.equal((await Customer.findById(customerId)).cart.length, 0);
      await cart(1); await expect('POST', '/orders/verify-payment', payload, 200); assert.equal((await Customer.findById(customerId)).cart.length, 1, 'Replay must not empty a new cart');
    });
    await t.test('provider failure persists failed attempt; original cart stays; history snapshots survive edits', async () => {
      providerFailure = true; await expect('POST', '/orders/create-payment-order', { shippingAddress }, 502); providerFailure = false;
      assert.equal((await Customer.findById(customerId)).cart.length, 1); assert.ok(await Order.exists({ user: customerId, paymentStatus: 'FAILED' }));
      await Product.findByIdAndUpdate(productId, { name: 'Changed Name', price: 999 });
      const result = await expect('GET', '/orders/' + paidId, undefined, 200); assert.equal(result.data.order.items[0].price, 123.45); assert.equal(result.data.order.items[0].name, 'Snapshot Product');
      await mongoose.disconnect(); await mongoose.connect(mongo.getUri());
      assert.equal((await expect('GET', '/orders', undefined, 200)).data.orders.length, 2); assert.equal((await expect('GET', '/orders', undefined, 200, other)).data.orders.length, 0);
    });
    await t.test('development-only status progression is gated and strictly sequential', async () => {
      await expect('PATCH', '/orders/' + paidId + '/status', { status: 'CONFIRMED' }, 403);
      process.env.ORDER_ADMIN_EMAILS = 'orders@example.com';
      await expect('PATCH', '/orders/' + paidId + '/status', { status: 'DELIVERED' }, 409);
      for (const status of ['CONFIRMED', 'SHIPPED', 'DELIVERED']) assert.equal((await expect('PATCH', '/orders/' + paidId + '/status', { status }, 200)).data.order.status, status);
      process.env.NODE_ENV = 'production'; await expect('PATCH', '/orders/' + paidId + '/status', { status: 'CONFIRMED' }, 403); process.env.NODE_ENV = 'test';
    });
  } finally { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
});
