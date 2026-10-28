const env = require('../config/env');
const cart = require('../services/cartService');
const fmt = require('../utils/format');

// Mensajes flash mínimos (sin dependencias)
function flash(req, res, next) {
  req.flash = (type, msg) => {
    req.session.flash = req.session.flash || {};
    (req.session.flash[type] = req.session.flash[type] || []).push(msg);
  };
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;
  next();
}

function locals(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.isOwner = Boolean(req.session.ownerId);
  res.locals.cartCount = cart.count(req.session);
  res.locals.location = req.session.location || null;
  res.locals.radiusKm = env.searchRadiusKm;
  res.locals.fmt = fmt;
  next();
}

module.exports = { flash, locals };
