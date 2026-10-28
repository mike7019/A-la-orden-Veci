const bcrypt = require('bcryptjs');
const db = require('../config/db');
const Owner = require('../models/Owner');
const Store = require('../models/Store');
const { parseCoords } = require('../utils/geo');
const { str, int, isEmail, isPhone } = require('../utils/validate');
const { normalizePhone } = require('../utils/format');

exports.loginForm = (req, res) => res.render('pages/auth/login', { title: 'Ingresar', values: {}, error: null });

exports.login = async (req, res, next) => {
  try {
    const email = str(req.body.email, 160).toLowerCase();
    const owner = await Owner.findByEmail(email);
    const ok = owner && await bcrypt.compare(String(req.body.password || ''), owner.password_hash);
    if (!ok) {
      return res.status(401).render('pages/auth/login', {
        title: 'Ingresar', values: { email }, error: 'Correo o contraseña incorrectos',
      });
    }
    const returnTo = req.session.returnTo || '/tendero';
    return req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.ownerId = owner.id;
      return req.session.save(() => res.redirect(returnTo));
    });
  } catch (err) { return next(err); }
};

exports.registerForm = (req, res) => res.render('pages/auth/register', { title: 'Registra tu tienda', values: {}, errors: {} });

exports.register = async (req, res, next) => {
  try {
    const v = {
      fullName: str(req.body.fullName, 120),
      email: str(req.body.email, 160).toLowerCase(),
      phone: str(req.body.phone, 20),
      password: String(req.body.password || ''),
      storeName: str(req.body.storeName, 120),
      address: str(req.body.address, 200),
      neighborhood: str(req.body.neighborhood, 120),
      whatsapp: str(req.body.whatsapp, 20),
      deliveryFee: int(req.body.deliveryFee) || 0,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    };
    const errors = {};
    if (v.fullName.length < 3) errors.fullName = 'Escribe tu nombre completo';
    if (!isEmail(v.email)) errors.email = 'Correo inválido';
    if (v.password.length < 8) errors.password = 'Mínimo 8 caracteres';
    if (v.storeName.length < 2) errors.storeName = 'Escribe el nombre de la tienda';
    if (v.address.length < 5) errors.address = 'Escribe la dirección de la tienda';
    if (!isPhone(v.whatsapp)) errors.whatsapp = 'Número de WhatsApp inválido';
    const coords = parseCoords(v.latitude, v.longitude);
    if (!coords) errors.location = 'Marca la ubicación de la tienda en el mapa';
    if (!errors.email && await Owner.findByEmail(v.email)) errors.email = 'Ya existe una cuenta con este correo';

    if (Object.keys(errors).length) {
      return res.status(422).render('pages/auth/register', { title: 'Registra tu tienda', values: v, errors });
    }

    const passwordHash = await bcrypt.hash(v.password, 10);
    const owner = await db.transaction(async (client) => {
      const o = await Owner.create(client, {
        fullName: v.fullName, email: v.email, passwordHash, phone: normalizePhone(v.phone) || null,
      });
      await Store.create(client, o.id, {
        name: v.storeName, address: v.address, neighborhood: v.neighborhood,
        whatsapp: normalizePhone(v.whatsapp), latitude: coords.lat, longitude: coords.lng,
        delivery_fee: Math.max(0, v.deliveryFee),
      });
      return o;
    });
    return req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.ownerId = owner.id;
      req.flash('success', '¡Tu tienda quedó registrada! Empieza agregando tus productos.');
      return req.session.save(() => res.redirect('/tendero/productos/nuevo'));
    });
  } catch (err) { return next(err); }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};
