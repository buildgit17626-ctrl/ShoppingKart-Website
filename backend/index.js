const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const app = require('./app');
async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in backend/.env');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shopkart_db');
  const server = app.listen(process.env.PORT || 5000, () => console.log('ShopKart API ready on port ' + (process.env.PORT || 5000)));
  const close = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
if (require.main === module) startServer().catch(error => { console.error('Startup failed:', error.message); process.exitCode = 1; });
module.exports = { startServer };
