const mongoose = require('mongoose');
const address = new mongoose.Schema(Object.fromEntries(['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'].map(key => [key, { type: String, required: true, trim: true }])), { _id: false });
const item = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true }, price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger }, image: String
}, { _id: false });
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  items: { type: [item], required: true }, shippingAddress: { type: address, required: true },
  totalAmount: { type: Number, required: true }, amountInPaise: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
  status: { type: String, enum: ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'], default: 'PENDING_PAYMENT' },
  razorpayOrderId: { type: String, unique: true, sparse: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  requestId: { type: String, required: true }, providerCreationFailed: { type: Boolean, default: false }
}, { timestamps: true });
schema.index({ user: 1, requestId: 1 }, { unique: true });
module.exports = mongoose.model('Order', schema);
