const Store = require('../../models/Store');
const { removeFile, publicUrl } = require('../../middlewares/upload');
const { parseCoords } = require('../../utils/geo');
const { str, int, isPhone } = require('../../utils/validate');
const { normalizePhone } = require('../../utils/format');

exports.editForm = (req, res) => res.render('pages/owner/store', { title: 'Datos de la tienda', values: req.store, errors: {} });

exports.update = async (req, res, next) => {
  try {
    const coords = parseCoords(req.body.latitude, req.body.longitude);
    const data = {
      name: str(req.body.name, 120),
      description: str(req.body.description, 500) || null,
      address: str(req.body.address, 200),
      neighborhood: str(req.body.neighborhood, 120) || null,
      whatsapp: normalizePhone(req.body.whatsapp),
      delivery_fee: Math.max(0, int(req.body.delivery_fee) || 0),
      min_order: Math.max(0, int(req.body.min_order) || 0),
      bank_info: str(req.body.bank_info, 500) || null,
      crypto_wallet: str(req.body.crypto_wallet, 300) || null,
      accepts_card: req.body.accepts_card === 'on',
      is_open: req.body.is_open === 'on',
    };
    const errors = {};
    if (data.name.length < 2) errors.name = 'Escribe el nombre de la tienda';
    if (data.address.length < 5) errors.address = 'Escribe la dirección';
    if (!isPhone(data.whatsapp)) errors.whatsapp = 'Número de WhatsApp inválido';
    if (!coords) errors.location = 'Marca la ubicación en el mapa';
    if (req.uploadError) errors.logo = req.uploadError;
    if (!data.accepts_card && !data.bank_info && !data.crypto_wallet) {
      errors.payments = 'Activa al menos un método de pago';
    }
    if (Object.keys(errors).length) {
      if (req.file && !process.env.VERCEL) removeFile(publicUrl(req.file));
      return res.status(422).render('pages/owner/store', {
        title: 'Datos de la tienda', values: { ...req.store, ...data }, errors,
      });
    }
    if (coords) Object.assign(data, { latitude: coords.lat, longitude: coords.lng });
    if (req.file) {
      data.logo = publicUrl(req.file);
      removeFile(req.store.logo);
    }
    await Store.update(req.store.id, data);
    req.flash('success', 'Datos de la tienda actualizados');
    return res.redirect('/tendero/tienda');
  } catch (err) { return next(err); }
};

// POST /tendero/tienda/abrir — abrir/cerrar la tienda con un toque
exports.toggleOpen = async (req, res, next) => {
  try {
    const store = await Store.update(req.store.id, { is_open: !req.store.is_open });
    req.flash('success', store.is_open ? 'Tu tienda está abierta y recibiendo pedidos' : 'Tu tienda quedó cerrada');
    res.redirect('back');
  } catch (err) { next(err); }
};
