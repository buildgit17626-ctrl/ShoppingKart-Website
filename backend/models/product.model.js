const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, validate: v => Number.isFinite(v) && v > 0 },
  category: { type: String, required: true, trim: true },
  image: { type: String, required: true, trim: true },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger }
}, { timestamps: true });
module.exports = mongoose.model('Product', schema);
