const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Product = require('./models/product.model');
const products = [
  { name: 'Studio Wireless Headphones', description: 'Over-ear wireless headphones with soft cushions, active noise cancellation and up to 30 hours of listening. A little more focus for your everyday.', price: 4999, category: 'Electronics', image: '/images/headphones.svg', stock: 12 },
  { name: 'Everyday Canvas Tote', description: 'A roomy, reusable cotton canvas tote with reinforced handles and an inside pocket. Made for the market, the office and everything in between.', price: 899, category: 'Fashion', image: '/images/tote.svg', stock: 24 },
  { name: 'The Art of Slow Living', description: 'An illustrated guide to finding a calmer rhythm, building thoughtful habits and appreciating small moments. Hardcover, 240 pages.', price: 649, category: 'Books', image: '/images/book.svg', stock: 15 },
  { name: 'Handcrafted Ceramic Mug', description: 'A warm ivory ceramic mug with an understated glazed finish. Holds 350 ml. Dishwasher safe and ready for your morning ritual.', price: 599, category: 'Home', image: '/images/mug.svg', stock: 8 },
  { name: 'Mechanical Keyboard', description: 'Compact mechanical keyboard with tactile switches, adjustable backlighting and a detachable USB cable. Designed for comfortable daily typing.', price: 2999, category: 'Electronics', image: '/images/keyboard.svg', stock: 10 },
  { name: 'Linen Blend Overshirt', description: 'A relaxed fit overshirt in a breathable linen blend. Natural buttons, two chest pockets and a versatile sage finish.', price: 1899, category: 'Fashion', image: '/images/shirt.svg', stock: 6 },
  { name: 'Minimal Desk Lamp', description: 'An adjustable desk lamp with warm LED lighting and a weighted base. A quiet companion for reading and focused work.', price: 1499, category: 'Home', image: '/images/lamp.svg', stock: 0 },
  { name: 'Pocket Notes Journal', description: 'A cloth-bound journal with 160 dotted pages and a ribbon bookmark. Your ideas deserve a little space.', price: 349, category: 'Books', image: '/images/journal.svg', stock: 30 }
];
async function seed() {
  let inserted = 0;
  for (const product of products) { if (!await Product.exists({ name: product.name })) { await Product.create(product); inserted++; } }
  return inserted;
}
if (require.main === module) (async () => {
  try { await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shopkart_db'); console.log('Inserted ' + await seed() + ' sample products; existing records preserved.'); }
  finally { await mongoose.disconnect(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { seed, products };
