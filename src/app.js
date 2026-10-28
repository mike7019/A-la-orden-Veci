const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const methodOverride = require('method-override');

const env = require('./config/env');
const { pool } = require('./config/db');
const { flash, locals } = require('./middlewares/locals');
const csrf = require('./middlewares/csrf');
const { notFound, errorHandler } = require('./middlewares/errors');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (env.isProd) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'script-src': ["'self'", 'https://unpkg.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://unpkg.com'],
      'connect-src': ["'self'", 'https://nominatim.openstreetmap.org'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: env.isProd ? '7d' : 0 }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

// Permite PUT/PATCH/DELETE desde formularios HTML: ?_method=PUT (funciona también con multipart)
app.use(methodOverride((req) => {
  const m = req.query._method;
  if (req.method === 'POST' && ['PUT', 'PATCH', 'DELETE'].includes(m)) return m;
  return undefined;
}));

app.use(session({
  store: new PgSession({ pool, tableName: 'user_sessions' }),
  name: 'veci.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: 30 * 24 * 60 * 60 * 1000 },
}));

app.use(flash);
app.use(csrf.protect);
app.use(locals);

app.use('/', require('./routes/index'));
app.use('/tendero', require('./routes/owner'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
