const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',');
const publicOrigin = process.env.PUBLIC_ORIGIN || 'http://localhost:5000';
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !origins.includes(req.headers.origin) && req.headers.origin !== (process.env.PUBLIC_ORIGIN || publicOrigin)) return res.status(403).json({ success: false, message: 'Origin not allowed' });
  next();
});
app.get('/health', (req, res) => res.json({ success: true }));
const frontend = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontend));
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api') && req.headers.accept?.includes('text/html')) return res.sendFile(path.join(frontend, 'index.html'), error => { if (error) next(error); });
  next();
});
// Same-origin React requests use /api; original lab endpoint paths also work.
app.use('/api', apiRouter());
function apiRouter() {
  const router = express.Router();
  router.use('/customers', require('./routes/customer.routes'));
  router.use('/products', require('./routes/product.routes'));
  router.use('/wishlist', require('./routes/wishlist.routes'));
  router.use('/cart', require('./routes/cart.routes'));
  router.use('/orders', require('./routes/order.routes'));
  router.use((req, res) => res.status(404).json({ success: false, message: 'API route not found' }));
  return router;
}
app.use('/customers', require('./routes/customer.routes'));
app.use('/products', require('./routes/product.routes'));
app.use('/wishlist', require('./routes/wishlist.routes'));
app.use('/cart', require('./routes/cart.routes'));
app.use('/orders', require('./routes/order.routes'));
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((error, req, res, next) => {
  const status = error.code === 11000 ? 409 : ['ValidationError', 'CastError'].includes(error.name) ? 400 : error.status || 500;
  res.status(status).json({ success: false, message: error.code === 11000 ? (error.keyPattern?.email ? 'Email already registered' : 'This request conflicts with an existing record. Please retry.') : status >= 500 && !error.status ? 'Something went wrong. Please try again' : error.message });
});
module.exports = app;
