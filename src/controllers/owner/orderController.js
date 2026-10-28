const Order = require('../../models/Order');
const { waLink } = require('../../services/whatsappService');
const { int, str } = require('../../utils/validate');
const { normalizePhone, STATUS_LABELS } = require('../../utils/format');

const STATUSES = Object.keys(STATUS_LABELS);

exports.index = async (req, res, next) => {
  try {
    const status = STATUSES.includes(req.query.estado) ? req.query.estado : '';
    const orders = await Order.findByStore(req.store.id, status);
    res.render('pages/owner/orders/index', { title: 'Pedidos', orders, status, statuses: STATUSES });
  } catch (err) { next(err); }
};

exports.show = async (req, res, next) => {
  try {
    const order = await Order.findOwned(int(req.params.id), req.store.id);
    if (!order) return next();
    // Enlace para escribirle al cliente avisando el estado del pedido
    const customerLink = waLink(normalizePhone(order.phone),
      `Hola ${order.first_name}, te escribimos de ${req.store.name} por tu pedido #${order.code} de A la orden Veci.`);
    return res.render('pages/owner/orders/show', {
      title: `Pedido #${order.code}`, order, statuses: STATUSES, customerLink,
    });
  } catch (err) { return next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const status = str(req.body.status, 20);
    if (!STATUSES.includes(status)) return res.redirect('back');
    const order = await Order.updateStatus(int(req.params.id), req.store.id, status);
    if (!order) return next();
    req.flash('success', `Pedido #${order.code}: ${STATUS_LABELS[status]}`);
    return res.redirect(`/tendero/pedidos/${order.id}`);
  } catch (err) { return next(err); }
};

exports.updatePayment = async (req, res, next) => {
  try {
    const paymentStatus = req.body.payment_status === 'pagado' ? 'pagado' : 'pendiente';
    const order = await Order.setPaymentStatus(int(req.params.id), req.store.id, paymentStatus);
    if (!order) return next();
    return res.redirect(`/tendero/pedidos/${order.id}`);
  } catch (err) { return next(err); }
};

// GET /tendero/pedidos/nuevos.json — usado por el panel para avisar pedidos nuevos
exports.pendingCount = async (req, res, next) => {
  try {
    const stats = await Order.statsByStore(req.store.id);
    res.json({ pending: stats.pending });
  } catch (err) { next(err); }
};
