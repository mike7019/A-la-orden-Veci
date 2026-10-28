const db = require('../config/db');
const { EARTH_RADIUS_KM } = require('../utils/geo');

const EDITABLE = ['name', 'description', 'address', 'neighborhood', 'whatsapp', 'latitude', 'longitude',
  'delivery_fee', 'min_order', 'bank_info', 'crypto_wallet', 'accepts_card', 'is_open', 'logo'];

const Store = {
  /**
   * Tiendas dentro de un radio (km) ordenadas por distancia.
   * Primero filtra por un "cuadro" de lat/lng (usa el índice) y luego calcula Haversine.
   */
  async findNearby(lat, lng, radiusKm, search = '') {
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const params = [lat, lng, radiusKm, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta];
    let searchSql = '';
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      searchSql = `AND (LOWER(s.name) LIKE $8 OR LOWER(COALESCE(s.neighborhood,'')) LIKE $8
                   OR EXISTS (SELECT 1 FROM products p WHERE p.store_id = s.id AND p.is_active AND p.stock > 0 AND LOWER(p.name) LIKE $8))`;
    }
    const { rows } = await db.query(
      `SELECT * FROM (
         SELECT s.*,
           (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.is_active AND p.stock > 0)::int AS product_count,
           ${EARTH_RADIUS_KM} * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS(s.latitude - $1) / 2), 2) +
             COS(RADIANS($1)) * COS(RADIANS(s.latitude)) * POWER(SIN(RADIANS(s.longitude - $2) / 2), 2)
           )) AS distance_km
         FROM stores s
         WHERE s.latitude BETWEEN $4 AND $5 AND s.longitude BETWEEN $6 AND $7 ${searchSql}
       ) t
       WHERE distance_km <= $3
       ORDER BY is_open DESC, distance_km ASC
       LIMIT 50`,
      params,
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query('SELECT * FROM stores WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByOwner(ownerId) {
    const { rows } = await db.query('SELECT * FROM stores WHERE owner_id = $1', [ownerId]);
    return rows[0] || null;
  },

  async create(client, ownerId, data) {
    const { rows } = await client.query(
      `INSERT INTO stores (owner_id, name, description, address, neighborhood, whatsapp, latitude, longitude, delivery_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [ownerId, data.name, data.description, data.address, data.neighborhood, data.whatsapp,
        data.latitude, data.longitude, data.delivery_fee || 0],
    );
    return rows[0];
  },

  async update(id, data) {
    const fields = EDITABLE.filter((f) => data[f] !== undefined);
    if (!fields.length) return this.findById(id);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const { rows } = await db.query(
      `UPDATE stores SET ${sets} WHERE id = $1 RETURNING *`,
      [id, ...fields.map((f) => data[f])],
    );
    return rows[0];
  },
};

module.exports = Store;
