const jwt = require('jsonwebtoken');
module.exports = (id, res) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 7 * 86400000 });
};
