const Order = require('../models/Order');
const cart = require('../services/cartService');
const whatsapp = require('../services/whatsappService');
const { haversineKm } = require('../utils/geo');
const { str, isPhone } = require('../utils/validate');
const { normalizePhone } = require('../utils/format');

const PAYMENTS = ['efectivo', 'tarjeta', 'transferencia', 'cripto'];

function paymentOptions(store) {
  return PAYMENTS.filter((p) => (p === 'efectivo' ? true : p === 'tarjeta' ? store.accepts_card
    : p === 'transferencia' ? Boolean(store.bank_info) : Boolean(store.crypto_wallet)));
}

// GET /checkout
exports.form = async (req, res, next) => {
  try {
    const detail = await cart.detail(req.session);
    if (!detail.lines.length) return res.redirect('/carrito');
    return res.render('pages/orders/checkout', {
      title: 'Datos de entrega', cart: detail, payments: paymentOptions(detail.store),
      values: req.session.lastCustomer || {}, errors: {},
    });
  } catch (err) { return next(err); }
};

// POST /checkout
exports.create = async (req, res, next) => {
  try {
    const detail = await cart.detail(req.session);
    if (!detail.lines.length) return res.redirect('/carrito');
    const { store } = detail;
    const payments = paymentOptions(store);

    const values = {
      firstName: str(req.body.firstName, 80),
      lastName: str(req.body.lastName, 80),
      phone: str(req.body.phone, 20),
      address: str(req.body.address, 200),
      reference: str(req.body.reference, 200),
      notes: str(req.body.notes, 300),
      payment: str(req.body.payment, 20),
    };
    const errors = {};
    if (values.firstName.length < 2) errors.firstName = 'Escribe tu nombre';
    if (values.lastName.length < 2) errors.lastName = 'Escribe tus apellidos';
    if (!isPhone(values.phone)) errors.phone = 'Escribe un número de celular válido';
    if (values.address.length < 5) errors.address = 'Escribe la dirección de entrega';
    if (!payments.includes(values.payment)) errors.payment = 'Elige un método de pago';
    if (!store.is_open) errors.general = 'La tienda está cerrada en este momento';
    if (detail.subtotal < store.min_order) errors.general = 'No alcanzas el pedido mínimo de la tienda';

    if (Object.keys(errors).length) {
      return res.status(422).render('pages/orders/checkout', {
        title: 'Datos de entrega', cart: detail, payments, values, errors,
      });
    }

    const loc = req.session.location;
    const distanceKm = loc ? +haversineKm(loc.lat, loc.lng, store.latitude, store.longitude).toFixed(2) : null;
    let order;
    try {
      order = await Order.create({
        store,
        cart: cart.get(req.session).items,
        customer: values,
        payment: values.payment,
        coords: loc,
        distanceKm,
      });
    } catch (err) {
      if (!(err instanceof Order.StockError)) throw err;
      req.flash('error', `Se agotaron algunas unidades: ${err.items.map((i) => `${i.name} (quedan ${i.available})`).join(', ')}`);
      return res.redirect('/carrito');
    }

    const notification = await whatsapp.notifyStore(order, store);
    await Order.setWhatsappStatus(order.id, notification.status);

    cart.clear(req.session);
    const { payment, notes, ...customer } = values;
    req.session.lastCustomer = { ...customer, phone: normalizePhone(values.phone).replace(/^57/, '') };
    req.session.myOrders = [order.code, ...(req.session.myOrders || [])].slice(0, 20);
    req.session.waLink = { code: order.code, link: notification.link, status: notification.status };
    return res.redirect(`/pedidos/${order.code}`);
  } catch (err) { return next(err); }
};

// GET /pedidos/:code — confirmación y seguimiento
exports.show = async (req, res, next) => {
  try {
    const order = await Order.findByCode(req.params.code);
    if (!order) return next();
    const wa = req.session.waLink && req.session.waLink.code === order.code ? req.session.waLink : null;
    // Los datos personales solo se muestran en el dispositivo que hizo el pedido
    const isMine = (req.session.myOrders || []).includes(order.code);
    return res.render('pages/orders/show', { title: `Pedido #${order.code}`, order, wa, isMine });
  } catch (err) { return next(err); }
};

// GET /pedidos — pedidos hechos desde este dispositivo
exports.mine = async (req, res, next) => {
  try {
    const codes = req.session.myOrders || [];
    const orders = (await Promise.all(codes.map((c) => Order.findByCode(c)))).filter(Boolean);
    res.render('pages/orders/mine', { title: 'Mis pedidos', orders });
  } catch (err) { next(err); }
};
