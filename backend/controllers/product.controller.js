const Product = require('../models/product.model');
const { fail, validId } = require('../utils/http');
exports.create = async (req, res) => {
  const { name, description, price, category, image, stock } = req.body;
  if (![name, description, category, image].every(v => typeof v === 'string' && v.trim())) fail(400, 'Name, description, category and image are required');
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) fail(400, 'Price must be a number greater than zero');
  if (!Number.isInteger(stock) || stock < 0) fail(400, 'Stock must be a non-negative integer');
  const product = await Product.create({ name, description, price, category, image, stock });
  res.status(201).json({ success: true, product });
};
exports.list = async (req, res) => {
  const query = {};
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string') fail(400, 'Search must be text');
    query.name = { $regex: req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (req.query.category) {
    if (typeof req.query.category !== 'string') fail(400, 'Category must be text');
    query.category = req.query.category;
  }
  const sort = req.query.sort === 'price_asc' ? { price: 1, _id: 1 } : req.query.sort === 'price_desc' ? { price: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const products = await Product.find(query).select('name description price category image stock createdAt').sort(sort);
  res.json({ success: true, count: products.length, products });
};
exports.get = async (req, res) => {
  validId(req.params.id);
  const product = await Product.findById(req.params.id).select('-__v -updatedAt');
  if (!product) fail(404, 'Product not found');
  res.json({ success: true, product });
};
