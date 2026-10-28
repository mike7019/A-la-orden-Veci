/* Datos de prueba: 3 tiendas en Bogotá (Chapinero) + 3 tiendas en la capital de cada uno de los
   otros 31 departamentos (96 tiendas en total), con productos. Contraseña de todas: veci1234 */
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const { PRODUCTS } = require('../src/data/catalog');
const { CITIES } = require('../src/data/cities');

const BOGOTA = [
  { owner: 'Rosa Pérez', email: 'rosa@veci.co', name: 'Tienda Doña Rosa', neighborhood: 'Chapinero Central',
    address: 'Cra 13 # 57-20', whatsapp: '573001112233', lat: 4.6413, lng: -74.0640, fee: 2000,
    bank: 'Nequi 300 111 2233 a nombre de Rosa Pérez', crypto: 'USDT (TRC20): TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' },
  { owner: 'Carlos Gómez', email: 'carlos@veci.co', name: 'Autoservicio El Vecino', neighborhood: 'Chapinero Alto',
    address: 'Calle 63 # 4-15', whatsapp: '573004445566', lat: 4.6489, lng: -74.0575, fee: 0,
    bank: 'Bancolombia ahorros 123-456789-00 · Daviplata 300 444 5566', crypto: null },
  { owner: 'Luz Marina Ruiz', email: 'luz@veci.co', name: 'Minimercado La Esquina', neighborhood: 'Teusaquillo',
    address: 'Calle 39 # 17-08', whatsapp: '573007778899', lat: 4.6290, lng: -74.0712, fee: 1500,
    bank: null, crypto: null },
];

// Tres tiendas por ciudad, a distintas distancias y rumbos del centro (determinista, sin azar)
const NAMES = ['Tienda Doña Marta', 'Autoservicio El Ahorro', 'Minimercado La Bendición'];
const OWNERS = ['Marta Londoño', 'Jorge Ramírez', 'Alba Cecilia Torres'];
const NEIGHBORHOODS = ['Centro', 'Barrio Santander', 'Barrio Bolívar'];
const OFFSETS = [{ km: 0.5, deg: 30 }, { km: 1.1, deg: 150 }, { km: 1.6, deg: 270 }]; // distancia y rumbo
const FEES = [0, 1500, 2000];

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function cityStores() {
  const stores = [];
  CITIES.forEach(([city, dept, lat, lng], c) => {
    OFFSETS.forEach((o, k) => {
      const rad = (o.deg * Math.PI) / 180;
      const n = c * 3 + k + 10; // número ficticio único
      stores.push({
        owner: OWNERS[k],
        email: `tienda${k + 1}.${slug(city)}@veci.co`,
        name: `${NAMES[k]} ${city}`,
        neighborhood: `${NEIGHBORHOODS[k]} · ${city}, ${dept}`,
        address: `Calle ${10 + k * 7} # ${3 + (c % 9)}-${10 + (n % 80)}`,
        whatsapp: `57300${String(n).padStart(7, '0')}`,
        lat: +(lat + (o.km * Math.cos(rad)) / 111.32).toFixed(6),
        lng: +(lng + (o.km * Math.sin(rad)) / (111.32 * Math.cos((lat * Math.PI) / 180))).toFixed(6),
        fee: FEES[k],
        bank: 'Nequi 300 000 0000 (cuenta de prueba)',
        crypto: 'USDT (TRC20): dirección de prueba',
      });
    });
  });
  return stores;
}

const STORES = [...BOGOTA, ...cityStores()];

(async () => {
  const hash = await bcrypt.hash('veci1234', 10);
  let created = 0;
  for (const [idx, s] of STORES.entries()) {
    const exists = await db.query('SELECT id FROM owners WHERE email = $1', [s.email]);
    if (exists.rows.length) { console.log(`Ya existe ${s.email}, se omite`); continue; }
    await db.transaction(async (c) => {
      const { rows: [o] } = await c.query(
        'INSERT INTO owners (full_name, email, password_hash, phone) VALUES ($1,$2,$3,$4) RETURNING id',
        [s.owner, s.email, hash, s.whatsapp],
      );
      const { rows: [st] } = await c.query(
        `INSERT INTO stores (owner_id, name, description, address, neighborhood, whatsapp, latitude, longitude,
           delivery_fee, bank_info, crypto_wallet) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [o.id, s.name, 'Abierto todos los días de 6 a.m. a 10 p.m.', s.address, s.neighborhood, s.whatsapp,
          s.lat, s.lng, s.fee, s.bank, s.crypto],
      );
      // Cada tienda tiene un surtido distinto y precios un poco diferentes
      const items = PRODUCTS.filter((_, i) => (i + idx) % 4 !== 0);
      for (const [name, category, price, stock] of items) {
        await c.query(
          'INSERT INTO products (store_id, name, category, price, stock) VALUES ($1,$2,$3,$4,$5)',
          [st.id, name, category, price + (idx % 5) * 100, stock],
        );
      }
    });
    created += 1;
    console.log(`Tienda creada: ${s.name} (${s.email} / veci1234)`);
  }
  console.log(`\nListo: ${created} tiendas nuevas, ${STORES.length} en total.`);
  await db.pool.end();
})().catch((err) => { console.error(err); process.exit(1); });
