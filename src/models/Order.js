const crypto = require('crypto');
const db = require('../config/db');

class StockError extends Error {
  constructor(items) {
    super('Algunos productos ya no tienen inventario suficiente');
    this.items = items;
  }
}

const newCode = () => crypto.randomBytes(4).toString('hex').toUpperCase(); // ej. 9F3A21BC

const Order = {
  StockError,

  /**
   * Crea el pedido en una transacción: bloquea los productos, valida inventario,
   * descuenta stock y guarda los ítems con el precio del momento.
   */
  async create({ store, cart, customer, payment, coords, distanceKm }) {
    return db.transaction(async (client) => {
      const ids = Object.keys(cart).map(Number);
      const { rows: products } = await client.query(
        `SELECT * FROM products WHERE store_id = $1 AND id = ANY($2::int[]) AND is_active
         ORDER BY id FOR UPDATE`,
        [store.id, ids],
      );
      const byId = new Map(products.map((p) => [p.id, p]));
      const problems = [];
      const items = ids.map((id) => {
        const p = byId.get(id);
        const qty = cart[id];
        if (!p || p.stock < qty) problems.push({ id, name: p ? p.name : 'Producto', available: p ? p.stock : 0 });
        return p && { product: p, qty, lineTotal: p.price * qty };
      });
      if (problems.length) throw new StockError(problems);

      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const deliveryFee = store.delivery_fee;
      const { rows } = await client.query(
        `INSERT INTO orders (code, store_id, first_name, last_name, phone, address, reference,
            customer_lat, customer_lng, distance_km, payment_method, subtotal, delivery_fee, total, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [newCode(), store.id, customer.firstName, customer.lastName, customer.phone, customer.address,
          customer.reference || null, coords ? coords.lat : null, coords ? coords.lng : null,
          distanceKm, payment, subtotal, deliveryFee, subtotal + deliveryFee, customer.notes || null],
      );
      const order = rows[0];

      for (const i of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, i.product.id, i.product.name, i.product.price, i.qty, i.lineTotal],
        );
        await client.query('UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2', [i.qty, i.product.id]);
      }
      order.items = items.map((i) => ({
        product_name: i.product.name, unit_price: i.product.price, quantity: i.qty, line_total: i.lineTotal,
      }));
      return order;
    });
  },

  async findByCode(code) {
    const { rows } = await db.query(
      `SELECT o.*, s.name AS store_name, s.whatsapp AS store_whatsapp, s.bank_info, s.crypto_wallet
       FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.code = $1`,
      [String(code).toUpperCase()],
    );
    if (!rows[0]) return null;
    rows[0].items = await this.items(rows[0].id);
    return rows[0];
  },

  async items(orderId) {
    const { rows } = await db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]);
    return rows;
  },

  async findByStore(storeId, status = '') {
    const params = [storeId];
    let where = 'store_id = $1';
    if (status) {
      params.push(status);
      where += ' AND status = $2';
    }
    const { rows } = await db.query(
      `SELECT o.*, (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = o.id)::int AS item_count
       FROM orders o WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
      params,
    );
    return rows;
  },

  async findOwned(id, storeId) {
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 AND store_id = $2', [id, storeId]);
    if (!rows[0]) return null;
    rows[0].items = await this.items(id);
    return rows[0];
  },

  // Cambia el estado; si se cancela, devuelve las unidades al inventario
  async updateStatus(id, storeId, status) {
    return db.transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND store_id = $2 FOR UPDATE',
        [id, storeId],
      );
      const order = rows[0];
      if (!order) return null;
      if (status === 'cancelado' && order.status !== 'cancelado') {
        await client.query(
          `UPDATE products p SET stock = p.stock + oi.quantity, updated_at = NOW()
           FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
          [id],
        );
      }
      const { rows: updated } = await client.query(
        'UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id, status],
      );
      return updated[0];
    });
  },

  async setPaymentStatus(id, storeId, paymentStatus) {
    const { rows } = await db.query(
      'UPDATE orders SET payment_status = $3, updated_at = NOW() WHERE id = $1 AND store_id = $2 RETURNING *',
      [id, storeId, paymentStatus],
    );
    return rows[0] || null;
  },

  async setWhatsappStatus(id, status) {
    await db.query('UPDATE orders SET whatsapp_status = $2 WHERE id = $1', [id, status]);
  },

  async statsByStore(storeId) {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('recibido','preparando'))::int AS pending,
         COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date)::int AS today,
         COALESCE(SUM(total) FILTER (WHERE (created_at AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
                                    AND status <> 'cancelado'), 0)::int AS sales_today
       FROM orders WHERE store_id = $1`,
      [storeId],
    );
    return rows[0];
  },
};

module.exports = Order;
