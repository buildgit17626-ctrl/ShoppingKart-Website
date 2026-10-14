const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const { fail, validId } = require('../utils/http');
const sendCart = async (id, res) => {
  const customer = await Customer.findById(id);
  const ids = customer.cart.map(item => item.product.toString());
  await customer.populate({ path: 'cart.product', select: 'name price category image stock' });
  res.json({ success: true, message: 'Cart updated', cart: customer.cart.map((item, index) => ({ quantity: item.quantity, product: item.product || { _id: ids[index], name: 'Unavailable product', price: 0, stock: 0, category: 'Unavailable', image: '/product-placeholder.svg', unavailable: true } })) });
};
exports.list = async (req, res) => sendCart(req.user._id, res);
exports.mutate = async (req, res) => {
  const id = req.params.productId;
  validId(id);
  if (req.method === 'PATCH' && (!Number.isInteger(req.body.quantity) || req.body.quantity < 1)) fail(400, 'Quantity must be an integer of at least 1');
  // Optimistic concurrency retries avoid lost increments and duplicate rows.
  for (let attempt = 0; attempt < 5; attempt++) {
    const customer = await Customer.findById(req.user._id);
    const item = customer.cart.find(item => item.product.toString() === id);
    if (req.method === 'DELETE') {
      if (!item) fail(404, 'Product not in cart');
      customer.cart = customer.cart.filter(item => item.product.toString() !== id);
    } else {
      const product = await Product.findById(id);
      if (!product) fail(404, 'Product not found');
      if (req.method === 'PATCH' && !item) fail(404, 'Product not in cart');
      const quantity = req.method === 'PATCH' ? req.body.quantity : (item?.quantity || 0) + 1;
      if (quantity > product.stock) fail(400, 'Quantity exceeds available stock');
      if (item) item.quantity = quantity;
      else customer.cart.push({ product: id, quantity });
    }
    try { await customer.save(); return await sendCart(customer._id, res); }
    catch (error) { if (error.name !== 'VersionError') throw error; }
  }
  fail(409, 'Cart changed during this request. Please try again');
};
