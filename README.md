# A la orden Veci 🏪

Aplicación web responsiva (pensada primero para celular) para pedir a domicilio a las **tiendas de barrio más cercanas**.
El cliente comparte su ubicación, ve las tiendas a menos de **5 km** ordenadas por cercanía y tiempo estimado de entrega,
arma su carrito, llena los datos de entrega y elige cómo pagar. La tienda recibe el pedido por **WhatsApp** y lo gestiona
desde su panel.

**Stack:** Node.js · ExpressJS · PostgreSQL · EJS · arquitectura MVC.

---

## Funcionalidades

### Cliente
- 📍 Ubicación con el GPS del celular y búsqueda de tiendas en un radio de 5 km (fórmula de Haversine en SQL, configurable).
- Tiempo estimado de entrega por tienda (alistamiento + recorrido en moto) y valor del domicilio.
- Buscador de tiendas por nombre, barrio o producto.
- Catálogo por tienda con **buscador** y **filtro por categoría**; solo se muestran productos con inventario.
- Carrito con +/− sin recargar la página (un carrito por tienda; avisa si cambias de tienda).
- Checkout: nombre, apellidos, celular, dirección, referencia (opcional), nota y método de pago
  (**tarjeta**, **transferencia** o **criptomonedas**, según lo que acepte cada tienda).
- Confirmación con seguimiento del pedido (Recibido → Preparando → En camino → Entregado) y "Mis pedidos".

### Tendero
- Registro de la tienda con ubicación en mapa (Leaflet + OpenStreetMap) y login.
- **CRUD de productos** con **foto** (cámara o galería, JPG/PNG/WEBP hasta 3 MB), categoría, precio, stock y visibilidad.
- Ajuste rápido de stock desde el listado; alertas de productos agotados o con poco inventario.
- Pedidos: lista por estado, detalle con checklist para despachar, botón "Cómo llegar", WhatsApp al cliente,
  cambio de estado y confirmación de pago. Al cancelar, las unidades vuelven al inventario.
- Aviso de pedidos nuevos en el panel (consulta cada 30 s) y botón para abrir/cerrar la tienda.
- Configuración de domicilio, pedido mínimo y datos de pago (Nequi/banco, billetera cripto, datáfono).

### Notificación por WhatsApp
Configurable con `WHATSAPP_PROVIDER`:

| Proveedor | Cómo funciona |
|-----------|---------------|
| `link` (por defecto) | No requiere cuentas. Al confirmar, el cliente toca **"Enviar pedido por WhatsApp"** y se abre WhatsApp con el pedido ya escrito para la tienda. |
| `cloud` | Envío automático con la **WhatsApp Cloud API** de Meta (`WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`). Para escribir a números que no te han escrito en 24 h Meta exige una plantilla aprobada (`WHATSAPP_CLOUD_TEMPLATE`). |
| `twilio` | Envío automático con **Twilio WhatsApp** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`). |

Si el envío automático falla, el pedido igual queda guardado y el cliente ve el botón de respaldo.
El mensaje incluye cliente, teléfono, dirección, referencia, enlace a Google Maps, productos, totales y método de pago.

### Pagos
Los tres métodos quedan **registrados** en el pedido. La tarjeta se cobra con datáfono al entregar; para transferencia y
cripto el cliente ve los datos de la tienda y envía el comprobante por WhatsApp. El tendero marca el pago como recibido.
Para cobrar en línea se puede integrar una pasarela (Wompi, Mercado Pago, ePayco, etc.) en `orderController.create`.

---

## Instalación

Requisitos: Node.js 18+ y PostgreSQL 13+.

```bash
npm install
cp .env.example .env          # ajusta DATABASE_URL y SESSION_SECRET
createdb alaordenveci         # o créala desde pgAdmin
npm run db:setup              # crea las tablas y carga 3 tiendas de prueba
npm run dev                   # http://localhost:3000
```

Con Docker: `cp .env.example .env && docker compose up --build` (luego `docker compose exec app node scripts/seed.js` para datos de prueba).

**Cuentas de prueba** (contraseña `veci1234`): `rosa@veci.co`, `carlos@veci.co`, `luz@veci.co`.
Las tiendas de prueba están en Chapinero, Bogotá; para verlas desde otra ciudad, registra una tienda nueva marcándola cerca de ti.

> La geolocalización del navegador solo funciona en `localhost` o en sitios con **HTTPS**.

---

## Estructura (MVC)

```
db/schema.sql                 Tablas: owners, stores, products, orders, order_items, user_sessions
scripts/                      migrate.js, seed.js
src/
  server.js / app.js          Arranque y configuración de Express (helmet, sesiones en PostgreSQL, CSRF)
  config/                     env.js, db.js (pool + transacciones)
  models/                     Owner, Store (búsqueda por cercanía), Product, Order (transacción con control de stock)
  controllers/                home, store, cart, order, auth
  controllers/owner/          dashboard, product (CRUD), order, store
  routes/                     index.js (cliente), owner.js (/tendero)
  middlewares/                auth, upload (multer), csrf, locals/flash, errores
  services/                   cartService (carrito en sesión), whatsappService
  utils/                      geo (Haversine, ETA), format, validate
  views/                      EJS: partials + pages (cliente y tendero)
  public/                     css, js, img, uploads (fotos subidas)
```

### Rutas principales
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` , `/tiendas?lat&lng&q` | Inicio y tiendas cercanas |
| GET | `/tiendas/:id?q&categoria` | Catálogo |
| GET/POST | `/carrito`, `/carrito/agregar`, `/carrito/actualizar`, `/carrito/vaciar` | Carrito |
| GET/POST | `/checkout` | Datos de entrega y creación del pedido |
| GET | `/pedidos`, `/pedidos/:codigo` | Mis pedidos y seguimiento |
| GET/POST | `/tendero/registro`, `/tendero/ingresar`, `/tendero/salir` | Autenticación |
| GET/POST/PUT/DELETE | `/tendero/productos[/:id]` | CRUD de productos |
| PATCH | `/tendero/productos/:id/stock` | Ajuste rápido de stock |
| GET/PATCH | `/tendero/pedidos/:id`, `/:id/estado`, `/:id/pago` | Gestión de pedidos |
| GET/PUT | `/tendero/tienda` | Datos de la tienda |

### Seguridad incluida
Contraseñas con bcrypt, sesiones en PostgreSQL con cookie `httpOnly`, protección CSRF, cabeceras con helmet (CSP),
límite de intentos de login, validación de archivos subidos, consultas parametrizadas y control de inventario con
bloqueo de filas (`FOR UPDATE`) para que dos clientes no compren la última unidad al mismo tiempo.

## Producción
- `NODE_ENV=production`, un `SESSION_SECRET` largo, `APP_URL` con tu dominio y HTTPS.
- Las fotos se guardan en `src/public/uploads`; en servidores sin disco persistente (Render, Railway, Heroku) conviene
  moverlas a S3 o Cloudinary cambiando `middlewares/upload.js`.
- Para muchas tiendas se puede pasar la búsqueda a PostGIS (`ST_DWithin`) sin cambiar los controladores.
