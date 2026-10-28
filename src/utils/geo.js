const env = require('../config/env');

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// Distancia en km entre dos coordenadas (fórmula de Haversine)
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Tiempo estimado de entrega: alistamiento (3 min) + recorrido en moto
function estimateMinutes(distanceKm) {
  return Math.max(5, Math.round(3 + (distanceKm / env.courierSpeedKmh) * 60));
}

function parseCoords(lat, lng) {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

module.exports = { haversineKm, estimateMinutes, parseCoords, EARTH_RADIUS_KM };
