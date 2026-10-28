const { Pool } = require('pg');
require('./env');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: process.env.VERCEL ? 3 : 10, // en serverless cada instancia usa pocas conexiones (Neon pooler)
});

pool.on('error', (err) => console.error('Error inesperado en PostgreSQL', err));

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  // Ejecuta fn dentro de una transacción y hace rollback si falla
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
