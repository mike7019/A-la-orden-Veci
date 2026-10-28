const Order = require('../../models/Order');
const Product = require('../../models/Product');

exports.index = async (req, res, next) => {
  try {
    const [stats, inventory, recent] = await Promise.all([
      Order.statsByStore(req.store.id),
      Product.countByStore(req.store.id),
      Order.findByStore(req.store.id),
    ]);
    res.render('pages/owner/dashboard', {
      title: 'Mi tienda', stats, inventory, recent: recent.slice(0, 5),
    });
  } catch (err) { next(err); }
};
