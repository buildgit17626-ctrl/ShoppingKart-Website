const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const validId = id => { if (!/^[a-f\d]{24}$/i.test(id)) fail(400, 'Invalid product ID'); };
module.exports = { wrap, fail, validId };
