const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
process.env.JWT_SECRET = 'integration-test-secret-only-0123456789';
const app = require('../app');
const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
test('Lab 01–05 API contracts, security, persistence, stock and concurrency', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.join(__dirname, '../node_modules/.cache/mongodb-memory-server') } });
  await mongoose.connect(mongo.getUri()); await Customer.init();
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie = '', cookieB = '', id, secondId;
  const missing = new mongoose.Types.ObjectId().toString();
  const user = { fullName: 'Test Customer', email: 'Test@shopkart.example', password: 'secret123', phone: '9876543210' };
  async function request(method, url, body, session = cookie, headers = {}) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  async function status(method, url, body, expected, session) { const response = await request(method, url, body, session); assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(response.data)}`); return response; }
  try {
    await t.test('registration validation, hash and duplicate normalization', async () => {
      await status('POST', '/customers/register', {}, 400);
      for (const bad of [{ fullName: '  ' }, { password: 'short' }, { password: 123456 }, { email: 'bad-email' }]) await status('POST', '/customers/register', { ...user, ...bad }, 400);
      const result = await status('POST', '/customers/register', user, 201); assert.equal(result.data.customer.password, undefined);
      await status('POST', '/customers/register', { ...user, email: user.email.toLowerCase() }, 409);
      const stored = await Customer.findOne({ email: user.email.toLowerCase() }).select('+password');
      assert.notEqual(stored.password, user.password); assert.ok(await bcrypt.compare(user.password, stored.password));
      assert.deepEqual(stored.wishlist, []); assert.equal(stored.cart.length, 0); assert.ok(stored.createdAt);
    });
    await t.test('login, JWT cookie, profile and invalid/expired tokens', async () => {
      await status('GET', '/customers/me', undefined, 401, '');
      await status('POST', '/customers/login', { email: user.email, password: 'wrong' }, 401, '');
      await status('POST', '/customers/login', { email: 'missing@example.com', password: user.password }, 401, '');
      await status('POST', '/customers/login', {}, 400, '');
      const result = await status('POST', '/customers/login', { email: user.email, password: user.password }, 200, '');
      assert.match(result.cookie, /HttpOnly/); assert.match(result.cookie, /SameSite=Strict/); assert.equal(result.data.customer.password, undefined); cookie = result.cookie.split(';')[0];
      const me = await status('GET', '/customers/me', undefined, 200); assert.equal(me.data.fullName, user.fullName); assert.equal(me.data.password, undefined);
      await status('GET', '/customers/me', undefined, 401, 'token=bad');
      await status('GET', '/customers/me', undefined, 401, 'token=' + jwt.sign({ id: me.data._id }, process.env.JWT_SECRET, { expiresIn: -1 }));
      await status('GET', '/customers/me', undefined, 401, 'token=' + jwt.sign({ id: missing }, process.env.JWT_SECRET));
      assert.equal((await request('GET', '/customers/me', undefined, '', { Authorization: 'Bearer ' + cookie.slice(6) })).status, 200);
      assert.equal((await request('POST', '/customers/logout', {}, cookie, { Origin: 'https://untrusted.example' })).status, 403);
    });
    await t.test('product validation, APIs, literal search, combined filters and sorting', async () => {
      const input = { name: 'Mechanical Keyboard', description: 'Tactile keyboard', price: 2999, category: 'Electronics', image: '/images/keyboard.svg', stock: 10 };
      await status('POST', '/products', {}, 400);
      for (const bad of [{ price: 0 }, { price: -1 }, { price: '2999' }, { stock: -1 }, { stock: 1.5 }, { stock: '10' }, { name: '' }]) await status('POST', '/products', { ...input, ...bad }, 400);
      const result = await status('POST', '/products', input, 201); id = result.data.product._id; assert.ok(result.data.product.createdAt);
      secondId = (await status('POST', '/products', { ...input, name: 'Keyboard Guide', category: 'Books', price: 500, stock: 0 }, 201)).data.product._id;
      assert.equal((await status('GET', '/products', undefined, 200)).data.count, 2);
      assert.equal((await status('GET', '/products?search=KEYBOARD', undefined, 200)).data.count, 2);
      assert.equal((await status('GET', '/products?search=keyboard&category=Electronics', undefined, 200)).data.count, 1);
      assert.equal((await status('GET', '/products?search=none', undefined, 200)).data.count, 0);
      assert.equal((await status('GET', '/products?search=%2E%2A', undefined, 200)).data.count, 0);
      assert.equal((await status('GET', '/products?sort=price_asc', undefined, 200)).data.products[0]._id, secondId);
      assert.equal((await status('GET', '/products?sort=price_desc', undefined, 200)).data.products[0]._id, id);
      assert.equal((await status('GET', '/products/' + id, undefined, 200)).data.product.description, input.description);
      await status('GET', '/products/not-an-id', undefined, 400); await status('GET', '/products/' + missing, undefined, 404);
      assert.equal((await status('GET', '/api/products', undefined, 200)).data.count, 2);
    });
    await t.test('wishlist validation, duplicate conflict, population and user isolation', async () => {
      await status('GET', '/wishlist', undefined, 401, ''); await status('POST', '/wishlist/' + id, {}, 401, ''); await status('DELETE', '/wishlist/' + id, {}, 401, '');
      await status('POST', '/wishlist/bad', {}, 400); await status('POST', '/wishlist/' + missing, {}, 404);
      await status('POST', '/wishlist/' + id, { userId: missing }, 201); await status('POST', '/wishlist/' + id, {}, 409);
      const list = await status('GET', '/wishlist', undefined, 200); assert.equal(list.data.count, 1); assert.equal(list.data.wishlist[0].name, 'Mechanical Keyboard');
      await status('POST', '/customers/register', { ...user, email: 'second@example.com' }, 201, '');
      cookieB = (await status('POST', '/customers/login', { email: 'second@example.com', password: user.password }, 200, '')).cookie.split(';')[0];
      assert.equal((await status('GET', '/wishlist', undefined, 200, cookieB)).data.count, 0);
      await status('DELETE', '/wishlist/' + id, {}, 404, cookieB); await status('GET', '/wishlist/' + missing, undefined, 404);
      await status('DELETE', '/wishlist/bad', {}, 400); await status('DELETE', '/wishlist/' + missing, {}, 404);
    });
    await t.test('cart add/increment, stock, integer quantity, remove and user isolation', async () => {
      for (const method of ['POST', 'PATCH', 'DELETE']) await status(method, '/cart/' + id, { quantity: 1 }, 401, '');
      await status('GET', '/cart', undefined, 401, ''); await status('POST', '/cart/bad', {}, 400); await status('POST', '/cart/' + missing, {}, 404); await status('POST', '/cart/' + secondId, {}, 400);
      await status('PATCH', '/cart/' + id, { quantity: 2 }, 404);
      assert.equal((await status('POST', '/cart/' + id, {}, 200)).data.cart[0].quantity, 1);
      const second = await status('POST', '/cart/' + id, {}, 200); assert.equal(second.data.cart.length, 1); assert.equal(second.data.cart[0].quantity, 2); assert.equal(second.data.cart[0].product.price, 2999);
      for (const quantity of [0, -1, 1.5, '3', null, 11]) await status('PATCH', '/cart/' + id, { quantity }, 400);
      assert.equal((await status('PATCH', '/cart/' + id, { quantity: 3 }, 200)).data.cart[0].quantity, 3);
      assert.equal((await status('GET', '/cart', undefined, 200, cookieB)).data.cart.length, 0); await status('DELETE', '/cart/' + id, {}, 404, cookieB);
      const stored = await Customer.findOne({ email: user.email.toLowerCase() }); assert.ok(stored.cart[0].product instanceof mongoose.Types.ObjectId); assert.equal(stored.cart[0].price, undefined); assert.equal(stored.subtotal, undefined);
    });
    await t.test('latest price/stock and simultaneous cart/wishlist requests', async () => {
      await Product.findByIdAndUpdate(id, { price: 3500, stock: 3 });
      assert.equal((await status('GET', '/cart', undefined, 200)).data.cart[0].product.price, 3500); assert.equal((await status('GET', '/wishlist', undefined, 200)).data.wishlist[0].price, 3500);
      await status('POST', '/cart/' + id, {}, 400); await status('PATCH', '/cart/' + id, { quantity: 4 }, 400);
      await Product.findByIdAndUpdate(id, { stock: 10 }); await status('PATCH', '/cart/' + id, { quantity: 1 }, 200);
      const additions = await Promise.all([request('POST', '/cart/' + id, {}), request('POST', '/cart/' + id, {})]); assert.ok(additions.every(r => r.status === 200));
      const cart = (await status('GET', '/cart', undefined, 200)).data.cart; assert.equal(cart.length, 1); assert.equal(cart[0].quantity, 3);
      const saves = await Promise.all([request('POST', '/wishlist/' + secondId, {}), request('POST', '/wishlist/' + secondId, {})]); assert.deepEqual(saves.map(r => r.status).sort(), [201, 409]); await status('DELETE', '/wishlist/' + secondId, {}, 200);
    });
    await t.test('logout/re-login and database reconnect persistence; change-password bonus', async () => {
      assert.match((await status('POST', '/customers/logout', {}, 200)).cookie, /Expires=Thu, 01 Jan 1970/); await status('GET', '/customers/me', undefined, 401, '');
      cookie = (await status('POST', '/customers/login', { email: user.email, password: user.password }, 200, '')).cookie.split(';')[0];
      await mongoose.disconnect(); await mongoose.connect(mongo.getUri());
      assert.equal((await status('GET', '/cart', undefined, 200)).data.cart[0].quantity, 3); assert.equal((await status('GET', '/wishlist', undefined, 200)).data.count, 1);
      await status('PATCH', '/customers/change-password', { oldPassword: 'wrong', newPassword: 'changed123' }, 400); await status('PATCH', '/customers/change-password', { oldPassword: user.password, newPassword: 'a' }, 400);
      await status('PATCH', '/customers/change-password', { oldPassword: user.password, newPassword: 'changed123' }, 200);
      await status('POST', '/customers/login', { email: user.email, password: user.password }, 401, ''); await status('POST', '/customers/login', { email: user.email, password: 'changed123' }, 200, '');
      assert.equal((await status('DELETE', '/cart/' + id, {}, 200)).data.cart.length, 0); await status('DELETE', '/cart/' + id, {}, 404);
      await status('DELETE', '/wishlist/' + id, {}, 200); assert.equal((await status('GET', '/wishlist', undefined, 200)).data.count, 0);
    });
  } finally { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
});
