const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await db.query(sql);
  console.log('Esquema aplicado correctamente');
  await db.pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
