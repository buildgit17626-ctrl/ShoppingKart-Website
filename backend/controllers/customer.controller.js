const bcrypt = require('bcrypt');
const Customer = require('../models/customer.model');
const generateToken = require('../utils/generateToken');
const { fail } = require('../utils/http');
const profile = c => ({ _id: c._id, fullName: c.fullName, email: c.email, phone: c.phone });
const passwordValid = p => typeof p === 'string' && p.length >= 6 && Buffer.byteLength(p) <= 72;
exports.registerCustomer = async (req, res) => {
  const { fullName, email, password, phone } = req.body;
  if (![fullName, email, password, phone].every(v => typeof v === 'string' && v.trim())) fail(400, 'All fields are mandatory');
  if (!passwordValid(password)) fail(400, 'Password must contain at least 6 characters and at most 72 bytes');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail(400, 'Enter a valid email address');
  const normalizedEmail = email.trim().toLowerCase();
  if (await Customer.exists({ email: normalizedEmail })) fail(409, 'Email already registered');
  const customer = await Customer.create({ fullName, email: normalizedEmail, phone, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ success: true, message: 'Customer registered successfully', customer: profile(customer) });
};
exports.loginCustomer = async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) fail(400, 'Email and password are required');
  if (Buffer.byteLength(password) > 72) fail(401, 'Invalid Credentials');
  const customer = await Customer.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!customer || !await bcrypt.compare(password, customer.password)) fail(401, 'Invalid Credentials');
  generateToken(customer._id, res);
  res.json({ success: true, message: 'Login successful', customer: profile(customer) });
};
exports.getProfile = async (req, res) => res.json(profile(req.user));
exports.logoutCustomer = async (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
};
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (typeof oldPassword !== 'string' || !passwordValid(newPassword)) fail(400, 'Provide the old password and a new password of 6 characters or more (maximum 72 bytes)');
  const customer = await Customer.findById(req.user._id).select('+password');
  if (!await bcrypt.compare(oldPassword, customer.password)) fail(400, 'Old password is incorrect');
  customer.password = await bcrypt.hash(newPassword, 10);
  await customer.save();
  res.json({ success: true, message: 'Password changed successfully' });
};
