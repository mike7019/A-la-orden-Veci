-- A la orden Veci - esquema de base de datos (PostgreSQL)

CREATE TABLE IF NOT EXISTS owners (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
  id             SERIAL PRIMARY KEY,
  owner_id       INTEGER NOT NULL UNIQUE REFERENCES owners(id) ON DELETE CASCADE,
  name           VARCHAR(120) NOT NULL,
  description    TEXT,
  address        VARCHAR(200) NOT NULL,
  neighborhood   VARCHAR(120),
  whatsapp       VARCHAR(20) NOT NULL,          -- número con indicativo, ej. 573001234567
  latitude       DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude      DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  logo           VARCHAR(200),
  delivery_fee   INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  min_order      INTEGER NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  bank_info      TEXT,                          -- datos para transferencia (Nequi, Daviplata, banco)
  crypto_wallet  TEXT,                          -- dirección para pagos con cripto
  accepts_card   BOOLEAN NOT NULL DEFAULT TRUE, -- datáfono contra entrega / pasarela
  is_open        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stores_lat_lng ON stores (latitude, longitude);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  category    VARCHAR(60) NOT NULL DEFAULT 'General',
  price       INTEGER NOT NULL CHECK (price >= 0),   -- pesos, sin decimales
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image       VARCHAR(200),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE products ALTER COLUMN image TYPE TEXT;
ALTER TABLE stores ALTER COLUMN logo TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_products_store ON products (store_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (LOWER(name));

CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(12) NOT NULL UNIQUE,  -- código público para seguimiento
  store_id         INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  first_name       VARCHAR(80) NOT NULL,
  last_name        VARCHAR(80) NOT NULL,
  phone            VARCHAR(20) NOT NULL,
  address          VARCHAR(200) NOT NULL,
  reference        VARCHAR(200),
  customer_lat     DOUBLE PRECISION,
  customer_lng     DOUBLE PRECISION,
  distance_km      NUMERIC(6,2),
  payment_method   VARCHAR(20) NOT NULL,
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente','pagado')),
  subtotal         INTEGER NOT NULL,
  delivery_fee     INTEGER NOT NULL DEFAULT 0,
  total            INTEGER NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'recibido'
                   CHECK (status IN ('recibido','preparando','despachado','entregado','cancelado')),
  notes            TEXT,
  whatsapp_status  VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('efectivo','tarjeta','transferencia','cripto'));
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders (store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  unit_price   INTEGER NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  line_total   INTEGER NOT NULL
);

-- Sesiones (connect-pg-simple)
CREATE TABLE IF NOT EXISTS user_sessions (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions (expire);
