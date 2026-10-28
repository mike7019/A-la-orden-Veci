const env = require('../config/env');
const Store = require('../models/Store');
const { parseCoords, estimateMinutes } = require('../utils/geo');
const { str } = require('../utils/validate');

const withEta = (stores) => stores.map((s) => ({ ...s, eta: estimateMinutes(s.distance_km) }));

// Página de inicio: pide la ubicación o muestra las tiendas cercanas ya conocidas
exports.index = async (req, res, next) => {
  try {
    const loc = req.session.location;
    const stores = loc ? withEta(await Store.findNearby(loc.lat, loc.lng, env.searchRadiusKm)) : null;
    res.render('pages/home', { title: 'Tiendas cerca de ti', stores, q: '' });
  } catch (err) { next(err); }
};

// GET /tiendas?lat=&lng=&q=
exports.nearby = async (req, res, next) => {
  try {
    const coords = parseCoords(req.query.lat, req.query.lng);
    if (coords) req.session.location = coords;
    const loc = req.session.location;
    if (!loc) return res.redirect('/');
    const q = str(req.query.q, 60);
    const stores = withEta(await Store.findNearby(loc.lat, loc.lng, env.searchRadiusKm, q));
    if (req.xhr || req.query.format === 'json') return res.json({ stores });
    return res.render('pages/home', { title: 'Tiendas cerca de ti', stores, q });
  } catch (err) { return next(err); }
};

// POST /ubicacion (fetch) guarda la ubicación del cliente en la sesión
exports.setLocation = (req, res) => {
  const coords = parseCoords(req.body.lat, req.body.lng);
  if (!coords) return res.status(400).json({ error: 'Ubicación inválida' });
  req.session.location = coords;
  return res.json({ ok: true });
};

exports.clearLocation = (req, res) => {
  delete req.session.location;
  res.redirect('/');
};
