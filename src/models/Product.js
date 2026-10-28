const db = require('../config/db');

const Product = {
  // Catálogo público: solo activos y con inventario
  async findAvailableByStore(storeId, { q = '', category = '' } = {}) {
    const params = [storeId];
    let where = 'store_id = $1 AND is_active AND stock > 0';
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(description,'')) LIKE $${params.length})`;
    }
    if (category) {
      params.push(category);
      where += ` AND category = $${params.length}`;
    }
    const { rows } = await db.query(`SELECT * FROM products WHERE ${where} ORDER BY category, name`, params);
    return rows;
  },

  async categoriesByStore(storeId) {
    const { rows } = await db.query(
      'SELECT DISTINCT category FROM products WHERE store_id = $1 AND is_active AND stock > 0 ORDER BY category',
      [storeId],
    );
    return rows.map((r) => r.category);
  },

  // Inventario completo del tendero
  async findAllByStore(storeId, q = '') {
    const params = [storeId];
    let where = 'store_id = $1';
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where += ' AND LOWER(name) LIKE $2';
    }
    const { rows } = await db.query(`SELECT * FROM products WHERE ${where} ORDER BY updated_at DESC`, params);
    return rows;
  },

  async findByIds(storeId, ids) {
    if (!ids.length) return [];
    const { rows } = await db.query(
      'SELECT * FROM products WHERE store_id = $1 AND id = ANY($2::int[])',
      [storeId, ids],
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findOwned(id, storeId) {
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1 AND store_id = $2', [id, storeId]);
    return rows[0] || null;
  },

  async create(storeId, p) {
    const { rows } = await db.query(
      `INSERT INTO products (store_id, name, description, category, price, stock, image, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [storeId, p.name, p.description, p.category, p.price, p.stock, p.image, p.is_active],
    );
    return rows[0];
  },

  // Si p.image es null se conserva la foto actual, salvo que clearImage = true
  async update(id, storeId, p, { clearImage = false } = {}) {
    const { rows } = await db.query(
      `UPDATE products SET name=$3, description=$4, category=$5, price=$6, stock=$7,
         image=CASE WHEN $10 THEN NULL ELSE COALESCE($8, image) END, is_active=$9, updated_at=NOW()
       WHERE id=$1 AND store_id=$2 RETURNING *`,
      [id, storeId, p.name, p.description, p.category, p.price, p.stock, p.image, p.is_active, clearImage],
    );
    return rows[0] || null;
  },

  async updateStock(id, storeId, stock) {
    const { rows } = await db.query(
      'UPDATE products SET stock=$3, updated_at=NOW() WHERE id=$1 AND store_id=$2 RETURNING *',
      [id, storeId, stock],
    );
    return rows[0] || null;
  },

  async remove(id, storeId) {
    const { rows } = await db.query('DELETE FROM products WHERE id=$1 AND store_id=$2 RETURNING image', [id, storeId]);
    return rows[0] || null;
  },

  async countByStore(storeId) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE stock = 0)::int AS out_of_stock,
              COUNT(*) FILTER (WHERE stock BETWEEN 1 AND 5)::int AS low_stock
       FROM products WHERE store_id = $1`,
      [storeId],
    );
    return rows[0];
  },
};

module.exports = Product;
