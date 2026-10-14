// Razorpay is doubled only in this isolated browser test; no real charge or test
// account credentials are used. API signatures are computed by this Node process.
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { chromium, expect } = require('@playwright/test');
process.env.JWT_SECRET = 'checkout-browser-fixture-secret-0123456789';
process.env.RAZORPAY_KEY_ID = 'rzp_test_browserfixture';
process.env.RAZORPAY_KEY_SECRET = 'browser-fixture-only-not-real-credentials';
process.env.ORDER_ADMIN_EMAILS = 'checkout@example.com';
process.env.NODE_ENV = 'test';
const app = require('../app');
const Customer = require('../models/customer.model');
const Order = require('../models/order.model');
const { seed } = require('../seed');
async function run() {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); let server, browser;
  try {
    await mongoose.connect(mongo.getUri()); await Promise.all([Customer.init(), Order.init()]); await seed();
    app.locals.paymentProvider = { orders: { create: async input => ({ id: 'order_test_' + input.receipt, amount: input.amount, currency: 'INR' }) } };
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port; process.env.PUBLIC_ORIGIN = base;
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('fixturePayment', async id => {
      const paymentId = 'pay_test_' + id;
      return { razorpay_order_id: id, razorpay_payment_id: paymentId, razorpay_signature: crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(id + '|' + paymentId).digest('hex') };
    });
    await page.addInitScript(() => {
      window.fixtureOutcome = 'failure';
      window.Razorpay = class {
        constructor(options) { this.options = options; this.handlers = {}; }
        on(event, handler) { this.handlers[event] = handler; }
        async open() {
          window.fixtureCheckout = { amount: this.options.amount, currency: this.options.currency, key: this.options.key, order_id: this.options.order_id };
          if (window.fixtureOutcome === 'failure') return this.handlers['payment.failed']({ error: { description: 'Fixture payment declined.' } });
          if (window.fixtureOutcome === 'cancel') return this.options.modal.ondismiss();
          this.options.handler(await window.fixturePayment(this.options.order_id));
        }
      };
    });
    const account = { fullName: 'Checkout Customer', email: 'checkout@example.com', password: 'secret123', phone: '9876543210' };
    const reg = await context.request.post(base + '/api/customers/register', { data: account }); if (reg.status() !== 201) throw new Error('Registration failed');
    await context.request.post(base + '/api/customers/login', { data: account });
    await page.goto(base + '/orders'); await expect(page.getByRole('heading', { name: 'You have not placed any orders yet.' })).toBeVisible();
    await page.goto(base + '/checkout'); await expect(page.getByRole('heading', { name: 'Your cart is empty', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Browse Products' }).click(); await page.getByLabel('Search products', { exact: true }).fill('Keyboard'); await expect(page.locator('.product-card')).toHaveCount(1); await page.getByRole('button', { name: 'Add to Cart', exact: true }).click(); await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();
    await page.getByRole('link', { name: 'Cart (1)' }).click(); await page.getByRole('link', { name: 'Proceed to Checkout' }).click();
    let creationRequests = 0; page.on('request', req => { if (req.url().endsWith('/orders/create-payment-order')) creationRequests++; });
    await page.getByRole('button', { name: 'Place Order — Pay with Razorpay' }).click(); await expect(page.getByRole('alert')).toContainText('All shipping fields'); if (creationRequests !== 0) throw new Error('Invalid form called server');
    await page.getByLabel('Address Line').fill('22 MG Road'); await page.getByLabel('City', { exact: true }).fill('Bengaluru'); await page.getByLabel('State', { exact: true }).fill('Karnataka'); await page.getByLabel('Pincode', { exact: true }).fill('123');
    await page.getByRole('button', { name: 'Place Order — Pay with Razorpay' }).click(); await expect(page.getByRole('alert')).toContainText('Pincode must contain 6 digits'); if (creationRequests !== 0) throw new Error('Invalid pincode called server');
    await page.getByLabel('Pincode', { exact: true }).fill('560001');
    const resultDir = path.join(__dirname, '../../test-results'); fs.mkdirSync(resultDir, { recursive: true }); await page.screenshot({ path: path.join(resultDir, 'checkout-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Place Order — Pay with Razorpay' }).click(); await expect(page.getByRole('alert')).toContainText('Fixture payment declined'); await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();
    const options = await page.evaluate(() => window.fixtureCheckout); if (options.amount !== 299900 || options.currency !== 'INR' || !options.key.startsWith('rzp_test_')) throw new Error('Incorrect Checkout options');
    await page.evaluate(() => { window.fixtureOutcome = 'cancel'; }); await page.getByRole('button', { name: 'Retry Razorpay payment' }).click(); await expect(page.getByRole('alert')).toContainText('Payment cancelled'); await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();
    await page.route('**/api/orders/verify-payment', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture temporary verification outage' }) }));
    await page.evaluate(() => { window.fixtureOutcome = 'success'; }); await page.getByRole('button', { name: 'Retry Razorpay payment' }).click(); await expect(page.getByRole('alert')).toContainText('Retry verification'); await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();
    await page.unroute('**/api/orders/verify-payment'); await page.getByRole('button', { name: 'Retry payment verification' }).click(); await expect(page).toHaveURL(/\/order-success\//); await expect(page.getByRole('heading', { name: 'Order Placed Successfully' })).toBeVisible(); await expect(page.getByRole('link', { name: 'Cart (0)' })).toBeVisible(); if (creationRequests !== 1) throw new Error('Payment retry created extra orders');
    await page.getByRole('button', { name: 'Advance to CONFIRMED' }).click(); await expect(page.getByRole('button', { name: 'Advance to SHIPPED' })).toBeVisible();
    await page.screenshot({ path: path.join(resultDir, 'order-confirmation.png'), fullPage: true });
    await page.getByRole('link', { name: 'View My Orders' }).click(); await expect(page.locator('.order-card')).toHaveCount(1); await expect(page.locator('.order-card')).toContainText('CONFIRMED'); await page.reload(); await expect(page.locator('.order-card')).toHaveCount(1);
    await page.route('**/api/orders', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary order history failure' }) })); await page.goto(base + '/orders'); await expect(page.getByRole('heading', { name: 'Unable to load orders' })).toBeVisible(); await page.unroute('**/api/orders'); await page.getByRole('button', { name: 'Try Again' }).click(); await expect(page.locator('.order-card')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(resultDir, 'orders-mobile.png'), fullPage: true }); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile order history overflows');
    await page.getByRole('link', { name: 'View Details', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Order Details' })).toBeVisible(); await page.screenshot({ path: path.join(resultDir, 'order-details-mobile.png'), fullPage: true }); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile order details overflows');
    await page.goto(base + '/products'); await page.getByLabel('Search products', { exact: true }).fill('Mug'); await expect(page.locator('.product-card')).toHaveCount(1); await page.getByRole('button', { name: 'Add to Cart', exact: true }).click(); await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible(); await page.goto(base + '/checkout');
    await page.screenshot({ path: path.join(resultDir, 'checkout-mobile.png'), fullPage: true }); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile checkout overflows');
    await page.evaluate(() => { delete window.Razorpay; }); await page.route('https://checkout.razorpay.com/v1/checkout.js', route => route.abort());
    await page.getByLabel('Address Line').fill('22 MG Road'); await page.getByLabel('City', { exact: true }).fill('Bengaluru'); await page.getByLabel('State', { exact: true }).fill('Karnataka'); await page.getByLabel('Pincode', { exact: true }).fill('560001'); await page.getByRole('button', { name: 'Place Order — Pay with Razorpay' }).click(); await expect(page.getByRole('alert')).toContainText('Unable to load Razorpay Checkout'); await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();
    if (errors.length) throw new Error(errors.join('; '));
    console.log('PASS: checkout validation, server amount, test provider failure/cancellation, signature-backed retry/confirmation, cart reset, order persistence/status/history error retry, script failure and mobile layouts. Razorpay boundary uses isolated fixtures, not an actual provider payment.');
  } finally { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
