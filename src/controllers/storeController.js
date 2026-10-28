const env = require('../config/env');
const Store = require('../models/Store');
const Product = require('../models/Product');
const cart = require('../services/cartService');
const { haversineKm, estimateMinutes } = require('../utils/geo');
const { str } = require('../utils/validate');

// GET /tiendas/:id — catálogo con buscador y filtro por categoría
exports.show = async (req, res, next) => {
  try {
    const store = await Store.findById(parseInt(req.params.id, 10) || 0);
    if (!store) return next();
    const q = str(req.query.q, 60);
    const category = str(req.query.categoria, 60);
    const [products, categories] = await Promise.all([
      Product.findAvailableByStore(store.id, { q, category }),
      Product.categoriesByStore(store.id),
    ]);
    const loc = req.session.location;
    const distance = loc ? haversineKm(loc.lat, loc.lng, store.latitude, store.longitude) : null;
    const cartState = cart.get(req.session);
    const inCart = cartState.storeId === store.id ? cartState.items : {};

    if (req.xhr || req.query.format === 'json') return res.json({ products });
    return res.render('pages/stores/show', {
      title: store.name,
      store,
      products,
      categories,
      q,
      category,
      inCart,
      distance,
      eta: distance !== null ? estimateMinutes(distance) : null,
      outOfRange: distance !== null && distance > env.searchRadiusKm,
      otherStoreInCart: cartState.storeId && cartState.storeId !== store.id,
    });
  } catch (err) { return next(err); }
};
