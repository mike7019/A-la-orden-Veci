/**
 * Carrito guardado en la sesión: { storeId, items: { [productId]: cantidad } }.
 * Un carrito pertenece a una sola tienda (el domicilio sale de un solo lugar).
 */
const Product = require('../models/Product');
const Store = require('../models/Store');

const MAX_QTY = 99;

function get(session) {
  if (!session.cart) session.cart = { storeId: null, items: {} };
  return session.cart;
}

function count(session) {
  const cart = get(session);
  return Object.values(cart.items).reduce((s, q) => s + q, 0);
}

/**
 * Cambia la cantidad de un producto (0 = quitar).
 * Si el producto es de otra tienda devuelve { conflict: true } salvo que replace = true.
 */
async function setItem(session, productId, quantity, { add = false, replace = false } = {}) {
  const cart = get(session);
  const product = await Product.findById(productId);
  if (!product || !product.is_active) return { error: 'Producto no disponible' };

  if (cart.storeId && cart.storeId !== product.store_id && Object.keys(cart.items).length) {
    if (!replace) return { conflict: true };
    cart.items = {};
  }
  cart.storeId = product.store_id;

  const current = cart.items[productId] || 0;
  const requested = add ? current + quantity : quantity;
  const qty = Math.max(0, Math.min(requested, MAX_QTY, product.stock));
  if (qty === 0) delete cart.items[productId];
  else cart.items[productId] = qty;
  if (!Object.keys(cart.items).length) cart.storeId = null;

  return { quantity: qty, limited: requested > qty, name: product.name };
}

function clear(session) {
  session.cart = { storeId: null, items: {} };
}

// Carrito con datos actuales de la BD (precio, stock, imagen) y totales
async function detail(session) {
  const cart = get(session);
  if (!cart.storeId) return { store: null, lines: [], subtotal: 0, deliveryFee: 0, total: 0, count: 0 };
  const store = await Store.findById(cart.storeId);
  const ids = Object.keys(cart.items).map(Number);
  const products = await Product.findByIds(cart.storeId, ids);
  const lines = products
    .filter((p) => p.is_active)
    .map((p) => {
      const quantity = Math.min(cart.items[p.id], p.stock);
      return { product: p, quantity, lineTotal: p.price * quantity, adjusted: quantity < cart.items[p.id] };
    })
    .filter((l) => l.quantity > 0);
  // Sincroniza la sesión con lo que realmente hay en inventario
  cart.items = Object.fromEntries(lines.map((l) => [l.product.id, l.quantity]));
  if (!lines.length) cart.storeId = null;
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const deliveryFee = lines.length && store ? store.delivery_fee : 0;
  return {
    store: lines.length ? store : null, lines, subtotal, deliveryFee, total: subtotal + deliveryFee,
    count: lines.reduce((s, l) => s + l.quantity, 0), adjusted: lines.some((l) => l.adjusted),
  };
}

module.exports = { get, count, setItem, clear, detail };
