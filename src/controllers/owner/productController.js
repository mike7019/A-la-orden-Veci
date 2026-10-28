const Product = require('../../models/Product');
const { removeFile, publicUrl } = require('../../middlewares/upload');
const { str, int } = require('../../utils/validate');

const CATEGORIES = ['Abarrotes', 'Lácteos y huevos', 'Panadería', 'Bebidas', 'Frutas y verduras', 'Carnes y embutidos',
  'Aseo del hogar', 'Cuidado personal', 'Snacks y dulces', 'Licores', 'Mascotas', 'General'];

function readForm(req) {
  const p = {
    name: str(req.body.name, 120),
    description: str(req.body.description, 500) || null,
    category: str(req.body.category, 60) || 'General',
    price: int(req.body.price),
    stock: int(req.body.stock),
    is_active: req.body.is_active === 'on' || req.body.is_active === '1',
    image: req.file ? publicUrl(req.file) : null,
  };
  const errors = {};
  if (p.name.length < 2) errors.name = 'Escribe el nombre del producto';
  if (!Number.isInteger(p.price) || p.price < 0) errors.price = 'Precio inválido';
  if (!Number.isInteger(p.stock) || p.stock < 0) errors.stock = 'Cantidad inválida';
  if (req.uploadError) errors.image = req.uploadError;
  return { p, errors };
}

// GET /tendero/productos
exports.index = async (req, res, next) => {
  try {
    const q = str(req.query.q, 60);
    const products = await Product.findAllByStore(req.store.id, q);
    res.render('pages/owner/products/index', { title: 'Inventario', products, q });
  } catch (err) { next(err); }
};

exports.newForm = (req, res) => res.render('pages/owner/products/form', {
  title: 'Nuevo producto', product: { is_active: true, category: 'Abarrotes' }, errors: {}, categories: CATEGORIES,
});

exports.create = async (req, res, next) => {
  try {
    const { p, errors } = readForm(req);
    if (Object.keys(errors).length) {
      removeFile(p.image);
      return res.status(422).render('pages/owner/products/form', {
        title: 'Nuevo producto', product: p, errors, categories: CATEGORIES,
      });
    }
    await Product.create(req.store.id, p);
    req.flash('success', `"${p.name}" se agregó al inventario`);
    return res.redirect(req.body.another ? '/tendero/productos/nuevo' : '/tendero/productos');
  } catch (err) { return next(err); }
};

exports.editForm = async (req, res, next) => {
  try {
    const product = await Product.findOwned(int(req.params.id), req.store.id);
    if (!product) return next();
    return res.render('pages/owner/products/form', {
      title: 'Editar producto', product, errors: {}, categories: CATEGORIES,
    });
  } catch (err) { return next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const current = await Product.findOwned(int(req.params.id), req.store.id);
    if (!current) return next();
    const { p, errors } = readForm(req);
    if (Object.keys(errors).length) {
      removeFile(p.image);
      return res.status(422).render('pages/owner/products/form', {
        title: 'Editar producto', product: { ...p, id: current.id, image: current.image }, errors, categories: CATEGORIES,
      });
    }
    const clearImage = req.body.removeImage === '1' && !p.image;
    await Product.update(current.id, req.store.id, p, { clearImage });
    if (p.image || clearImage) removeFile(current.image);
    req.flash('success', `"${p.name}" se actualizó`);
    return res.redirect('/tendero/productos');
  } catch (err) { return next(err); }
};

// PATCH /tendero/productos/:id/stock — ajuste rápido de inventario desde el listado
exports.updateStock = async (req, res, next) => {
  try {
    const stock = int(req.body.stock);
    if (!Number.isInteger(stock) || stock < 0) return res.status(400).json({ error: 'Cantidad inválida' });
    const product = await Product.updateStock(int(req.params.id), req.store.id, stock);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.json({ stock: product.stock });
  } catch (err) { return next(err); }
};

exports.destroy = async (req, res, next) => {
  try {
    const removed = await Product.remove(int(req.params.id), req.store.id);
    if (removed) {
      removeFile(removed.image);
      req.flash('success', 'Producto eliminado');
    }
    res.redirect('/tendero/productos');
  } catch (err) { next(err); }
};
