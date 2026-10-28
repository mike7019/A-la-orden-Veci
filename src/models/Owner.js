const db = require('../config/db');

const Owner = {
  async findByEmail(email) {
    const { rows } = await db.query('SELECT * FROM owners WHERE email = LOWER($1)', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await db.query('SELECT id, full_name, email, phone FROM owners WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create(client, { fullName, email, passwordHash, phone }) {
    const { rows } = await client.query(
      `INSERT INTO owners (full_name, email, password_hash, phone)
       VALUES ($1, LOWER($2), $3, $4) RETURNING id, full_name, email`,
      [fullName, email, passwordHash, phone],
    );
    return rows[0];
  },
};

module.exports = Owner;
