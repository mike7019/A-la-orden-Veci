const cart = require('../services/cartService');
const { int } = require('../utils/validate');

const wantsJson = (req) => req.xhr || req.accepts(['html', 'json']) === 'json';

exports.show = async (req, res, next) => {
  try {
    const detail = await cart.detail(req.session);
    res.render('pages/cart/show', { title: 'Tu carrito', cart: detail });
  } catch (err) { next(err); }
};

// POST /carrito/agregar  { productId, quantity, replace }
exports.add = async (req, res, next) => {
  try {
    const productId = int(req.body.productId);
    const quantity = Math.max(1, int(req.body.quantity) || 1);
    const result = await cart.setItem(req.session, productId, quantity, { add: true, replace: req.body.replace === '1' });
    return respond(req, res, result, 'Producto agregado al carrito');
  } catch (err) { return next(err); }
};

// POST /carrito/actualizar  { productId, quantity }  (0 elimina)
exports.update = async (req, res, next) => {
  try {
    const productId = int(req.body.productId);
    const quantity = Math.max(0, int(req.body.quantity) || 0);
    const result = await cart.setItem(req.session, productId, quantity);
    if (wantsJson(req)) {
      const detail = await cart.detail(req.session);
      return res.json({ ...result, count: detail.count, subtotal: detail.subtotal, total: detail.total,
        deliveryFee: detail.deliveryFee, empty: !detail.lines.length });
    }
    return res.redirect('/carrito');
  } catch (err) { return next(err); }
};

exports.clear = (req, res) => {
  cart.clear(req.session);
  res.redirect('/carrito');
};

function respond(req, res, result, okMsg) {
  if (wantsJson(req)) {
    if (result.conflict) return res.status(409).json({ conflict: true, error: 'Tu carrito tiene productos de otra tienda' });
    if (result.error) return res.status(400).json(result);
    return res.json({ ...result, count: cart.count(req.session) });
  }
  if (result.conflict) req.flash('error', 'Tu carrito tiene productos de otra tienda. Vacíalo para pedir aquí.');
  else if (result.error) req.flash('error', result.error);
  else req.flash('success', result.limited ? `Solo hay ${result.quantity} unidades disponibles` : okMsg);
  return res.redirect('back');
}
