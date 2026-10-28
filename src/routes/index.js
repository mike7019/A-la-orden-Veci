const router = require('express').Router();
const home = require('../controllers/homeController');
const stores = require('../controllers/storeController');
const cartCtrl = require('../controllers/cartController');
const orders = require('../controllers/orderController');

router.get('/', home.index);
router.get('/tiendas', home.nearby);
router.post('/ubicacion', home.setLocation);
router.post('/ubicacion/borrar', home.clearLocation);

router.get('/tiendas/:id', stores.show);

router.get('/carrito', cartCtrl.show);
router.post('/carrito/agregar', cartCtrl.add);
router.post('/carrito/actualizar', cartCtrl.update);
router.post('/carrito/vaciar', cartCtrl.clear);

router.get('/checkout', orders.form);
router.post('/checkout', orders.create);
router.get('/pedidos', orders.mine);
router.get('/pedidos/:code', orders.show);

module.exports = router;
