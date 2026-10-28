const Store = require('../models/Store');

// Exige sesión de tendero y carga su tienda en req.store / res.locals.store
async function requireOwner(req, res, next) {
  if (!req.session.ownerId) {
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'Inicia sesión para administrar tu tienda');
    return res.redirect('/tendero/ingresar');
  }
  try {
    const store = await Store.findByOwner(req.session.ownerId);
    if (!store) {
      req.session.destroy(() => res.redirect('/tendero/ingresar'));
      return undefined;
    }
    req.store = store;
    res.locals.myStore = store;
    return next();
  } catch (err) {
    return next(err);
  }
}

function guestOnly(req, res, next) {
  if (req.session.ownerId) return res.redirect('/tendero');
  return next();
}

module.exports = { requireOwner, guestOnly };
