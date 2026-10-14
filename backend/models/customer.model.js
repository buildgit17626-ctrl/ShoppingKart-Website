const mongoose = require('mongoose');
const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true, trim: true },
  wishlist: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  cart: { type: [new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, default: 1, min: 1, validate: Number.isInteger }
  }, { _id: false })], default: [] }
}, { timestamps: true, optimisticConcurrency: true });
module.exports = mongoose.model('Customer', customerSchema);
