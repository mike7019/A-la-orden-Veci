/* A la orden Veci — interacciones del cliente (sin dependencias) */
(function () {
  'use strict';

  var csrf = document.querySelector('meta[name="csrf-token"]').content;
  var toastEl = document.getElementById('toast');
  var toastTimer;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }
  window.veciToast = toast;

  function post(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin'
    }).then(function (r) {
      return r.json().then(function (body) { body.httpStatus = r.status; return body; });
    });
  }
  window.veciPost = post;

  var money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  function setCartCount(n) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = n || '';
      el.dataset.count = n;
    });
    document.querySelectorAll('[data-cart-count-text]').forEach(function (el) { el.textContent = n; });
    var bar = document.querySelector('[data-cart-bar]');
    if (bar) bar.classList.toggle('hidden', !n);
  }

  /* ---------- Geolocalización del cliente ---------- */
  function locate(btn) {
    var status = document.querySelector('[data-locate-status]');
    function say(msg) { if (status) { status.textContent = msg; status.classList.remove('hidden'); } else { toast(msg); } }
    if (!('geolocation' in navigator)) return say('Tu navegador no permite obtener la ubicación.');
    if (btn) btn.disabled = true;
    say('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      post('/ubicacion', { lat: lat, lng: lng }).then(function () {
        window.location.href = '/tiendas';
      });
    }, function (err) {
      if (btn) btn.disabled = false;
      say(err.code === 1
        ? 'Necesitamos tu permiso de ubicación para mostrarte las tiendas cercanas. Actívalo en la configuración del navegador.'
        : 'No pudimos obtener tu ubicación. Intenta de nuevo.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  document.querySelectorAll('[data-action="locate"]').forEach(function (btn) {
    btn.addEventListener('click', function () { locate(btn); });
  });

  /* ---------- Catálogo: agregar y cambiar cantidades ---------- */
  var replaceDialog = document.getElementById('replace-dialog');

  function updateProductCard(card, qty) {
    var form = card.querySelector('[data-add-form]');
    var control = card.querySelector('[data-qty-control]');
    card.querySelector('[data-qty]').textContent = qty;
    form.classList.toggle('hidden', qty > 0);
    control.classList.toggle('hidden', qty === 0);
  }

  function addToCart(card, replace) {
    var id = card.dataset.product;
    return post('/carrito/agregar', { productId: id, quantity: 1, replace: replace ? '1' : '' }).then(function (res) {
      if (res.conflict) {
        if (replaceDialog && replaceDialog.showModal) {
          replaceDialog.showModal();
          replaceDialog.querySelector('[data-confirm-replace]').onclick = function () {
            replaceDialog.close();
            addToCart(card, true).then(function () { window.location.reload(); });
          };
          replaceDialog.querySelector('[data-cancel]').onclick = function () { replaceDialog.close(); };
        } else if (confirm('Tu carrito tiene productos de otra tienda. ¿Vaciarlo y agregar este?')) {
          addToCart(card, true).then(function () { window.location.reload(); });
        }
        return;
      }
      if (res.error) return toast(res.error);
      updateProductCard(card, res.quantity);
      setCartCount(res.count);
      toast(res.limited ? 'Solo hay ' + res.quantity + ' disponibles' : 'Agregado: ' + res.name);
    });
  }

  document.querySelectorAll('.product[data-product]').forEach(function (card) {
    var form = card.querySelector('[data-add-form]');
    if (!form) return;
    form.addEventListener('submit', function (e) { e.preventDefault(); addToCart(card, false); });
    card.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var current = parseInt(card.querySelector('[data-qty]').textContent, 10) || 0;
        var qty = current + parseInt(b.dataset.step, 10);
        post('/carrito/actualizar', { productId: card.dataset.product, quantity: qty }).then(function (res) {
          if (res.error) return toast(res.error);
          updateProductCard(card, res.quantity);
          setCartCount(res.count);
          if (res.limited) toast('Solo hay ' + res.quantity + ' disponibles');
        });
      });
    });
  });

  /* ---------- Carrito: cantidades sin recargar ---------- */
  document.querySelectorAll('[data-line]').forEach(function (line) {
    var form = line.querySelector('[data-qty-form]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = e.submitter;
      var current = parseInt(line.querySelector('[data-qty]').textContent, 10) || 0;
      var qty = current + parseInt(btn ? btn.dataset.step : 0, 10);
      post('/carrito/actualizar', { productId: line.dataset.product, quantity: qty }).then(function (res) {
        if (res.error) return toast(res.error);
        if (res.empty) return window.location.reload();
        if (res.quantity === 0) line.remove();
        else {
          line.querySelector('[data-qty]').textContent = res.quantity;
          line.querySelector('[data-line-total]').textContent = money.format(res.quantity * Number(line.dataset.price));
        }
        if (res.limited) toast('Solo hay ' + res.quantity + ' disponibles');
        document.querySelector('[data-subtotal]').textContent = money.format(res.subtotal);
        document.querySelector('[data-total]').textContent = money.format(res.total);
        setCartCount(res.count);
      });
    });
  });

  /* ---------- Checkout ---------- */
  var checkout = document.querySelector('[data-checkout]');
  if (checkout) {
    var showPayDetail = function () {
      var selected = checkout.querySelector('input[name="payment"]:checked');
      checkout.querySelectorAll('[data-pay-detail]').forEach(function (d) {
        d.classList.toggle('hidden', !selected || d.dataset.payDetail !== selected.value);
      });
    };
    checkout.addEventListener('change', showPayDetail);
    showPayDetail();
    checkout.addEventListener('submit', function () {
      var b = checkout.querySelector('[data-submit]');
      b.disabled = true;
      b.textContent = 'Enviando pedido…';
    });
  }

  /* ---------- Confirmaciones ---------- */
  document.querySelectorAll('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) { if (!confirm(f.dataset.confirm)) e.preventDefault(); });
  });
})();
