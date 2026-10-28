const crypto = require('crypto');

// Protección CSRF simple basada en un token por sesión
function token(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  return req.session.csrfToken;
}

function valid(req) {
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token') || '';
  const expected = req.session.csrfToken || '';
  return sent.length === expected.length && expected.length > 0
    && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

function reject(req, res) {
  if (req.xhr || req.accepts(['html', 'json']) === 'json') {
    return res.status(403).json({ error: 'La sesión expiró, recarga la página' });
  }
  req.flash('error', 'La sesión expiró, intenta de nuevo');
  return res.redirect('back');
}

// Global: valida todos los POST excepto multipart (esos se validan después de multer con `verify`)
function protect(req, res, next) {
  res.locals.csrfToken = token(req);
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.is('multipart/form-data')) return next();
  return valid(req) ? next() : reject(req, res);
}

function verify(req, res, next) {
  return valid(req) ? next() : reject(req, res);
}

module.exports = { protect, verify };
