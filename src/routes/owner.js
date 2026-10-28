const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');
const dashboard = require('../controllers/owner/dashboardController');
const products = require('../controllers/owner/productController');
const orders = require('../controllers/owner/orderController');
const storeCtrl = require('../controllers/owner/storeController');
const { requireOwner, guestOnly } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const csrf = require('../middlewares/csrf');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Autenticación
router.get('/ingresar', guestOnly, auth.loginForm);
router.post('/ingresar', guestOnly, loginLimiter, auth.login);
router.get('/registro', guestOnly, auth.registerForm);
router.post('/registro', guestOnly, loginLimiter, auth.register);
router.post('/salir', auth.logout);

// Todo lo demás requiere sesión de tendero
router.use(requireOwner);

router.get('/', dashboard.index);

// CRUD de productos (multipart: csrf.verify va después de multer)
router.get('/productos', products.index);
router.get('/productos/nuevo', products.newForm);
router.post('/productos', upload.single('image'), csrf.verify, products.create);
router.get('/productos/:id/editar', products.editForm);
router.put('/productos/:id', upload.single('image'), csrf.verify, products.update);
router.patch('/productos/:id/stock', products.updateStock);
router.delete('/productos/:id', products.destroy);

// Pedidos
router.get('/pedidos', orders.index);
router.get('/pedidos/pendientes.json', orders.pendingCount);
router.get('/pedidos/:id', orders.show);
router.patch('/pedidos/:id/estado', orders.updateStatus);
router.patch('/pedidos/:id/pago', orders.updatePayment);

// Datos de la tienda
router.get('/tienda', storeCtrl.editForm);
router.put('/tienda', upload.single('logo'), csrf.verify, storeCtrl.update);
router.post('/tienda/abrir', storeCtrl.toggleOpen);

module.exports = router;
