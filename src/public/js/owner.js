/* Panel del tendero: mapa de ubicación, vista previa de fotos, stock rápido y aviso de pedidos nuevos */
(function () {
  'use strict';
  var csrf = document.querySelector('meta[name="csrf-token"]').content;
  var toast = window.veciToast || function () {};

  /* ---------- Mapa para ubicar la tienda (Leaflet) ---------- */
  var mapEl = document.getElementById('map');
  if (mapEl && window.L) {
    var latInput = document.getElementById('latitude');
    var lngInput = document.getElementById('longitude');
    var label = document.querySelector('[data-coords-label]');
    var lat = parseFloat(mapEl.dataset.lat), lng = parseFloat(mapEl.dataset.lng);
    var hasPoint = isFinite(lat) && isFinite(lng);
    var start = hasPoint ? [lat, lng] : [4.6097, -74.0817]; // Bogotá por defecto
    var map = L.map(mapEl).setView(start, hasPoint ? 17 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var marker = null;
    var setPoint = function (latlng, zoom) {
      if (!marker) {
        marker = L.marker(latlng, { draggable: true }).addTo(map);
        marker.on('dragend', function () { setPoint(marker.getLatLng()); });
      } else marker.setLatLng(latlng);
      latInput.value = latlng.lat.toFixed(6);
      lngInput.value = latlng.lng.toFixed(6);
      label.textContent = 'Ubicación marcada ✓';
      if (zoom) map.setView(latlng, zoom);
    };
    if (hasPoint) setPoint(L.latLng(lat, lng));
    map.on('click', function (e) { setPoint(e.latlng); });

    var locBtn = document.querySelector('[data-map-locate]');
    locBtn.addEventListener('click', function () {
      if (!navigator.geolocation) return toast('Tu navegador no permite obtener la ubicación');
      locBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        locBtn.disabled = false;
        setPoint(L.latLng(pos.coords.latitude, pos.coords.longitude), 18);
      }, function () {
        locBtn.disabled = false;
        toast('No pudimos obtener tu ubicación; márcala en el mapa');
      }, { enableHighAccuracy: true, timeout: 15000 });
    });
  }

  /* ---------- Vista previa de la foto ---------- */
  document.querySelectorAll('[data-photo-input]').forEach(function (input) {
    var preview = input.closest('.photo-picker').querySelector('[data-photo-preview]');
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        toast('La foto pesa más de 3 MB');
        input.value = '';
        return;
      }
      var img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      preview.innerHTML = '';
      preview.appendChild(img);
    });
  });

  /* ---------- Ajuste rápido de stock ---------- */
  document.querySelectorAll('[data-stock-input]').forEach(function (input) {
    var last = input.value;
    input.addEventListener('change', function () {
      var id = input.dataset.stockInput;
      fetch('/tendero/productos/' + id + '/stock?_method=PATCH', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Accept: 'application/json' },
        body: JSON.stringify({ stock: input.value }),
        credentials: 'same-origin'
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res.error) { input.value = last; return toast(res.error); }
        last = String(res.stock);
        toast('Inventario actualizado');
      });
    });
  });

  /* ---------- Aviso de pedidos nuevos (cada 30 s) ---------- */
  var badge = document.querySelector('[data-pending-count]');
  if (badge) {
    var known = null;
    var check = function () {
      fetch('/tendero/pedidos/pendientes.json', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          badge.textContent = res.pending || '';
          badge.dataset.count = res.pending;
          if (known !== null && res.pending > known) {
            toast('🔔 ¡Tienes un pedido nuevo!');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          }
          known = res.pending;
        }).catch(function () {});
    };
    check();
    setInterval(check, 30000);
  }
})();
