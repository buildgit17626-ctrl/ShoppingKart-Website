const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const { validId, fail } = require('../utils/http');
exports.list = async (req, res) => {
  const customer = await Customer.findById(req.user._id).populate({ path: 'wishlist', select: 'name price category image stock' });
  res.json({ success: true, count: customer.wishlist.length, wishlist: customer.wishlist });
};
exports.add = async (req, res) => {
  const id = req.params.productId;
  validId(id);
  if (!await Product.exists({ _id: id })) fail(404, 'Product not found');
  // Conditional atomic update prevents duplicates during simultaneous requests.
  const updated = await Customer.findOneAndUpdate({ _id: req.user._id, wishlist: { $ne: id } }, { $addToSet: { wishlist: id }, $inc: { __v: 1 } });
  if (!updated) fail(409, 'Product already in wishlist');
  res.status(201).json({ success: true, message: 'Product added to wishlist' });
};
exports.remove = async (req, res) => {
  const id = req.params.productId;
  validId(id);
  const updated = await Customer.findOneAndUpdate({ _id: req.user._id, wishlist: id }, { $pull: { wishlist: id }, $inc: { __v: 1 } });
  if (!updated) fail(404, 'Product not in wishlist');
  res.json({ success: true, message: 'Product removed from wishlist' });
};
