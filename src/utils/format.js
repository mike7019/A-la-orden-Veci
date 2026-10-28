const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const formatMoney = (value) => money.format(Number(value) || 0);
const formatDate = (d) => new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

// Deja solo dígitos; si es un celular colombiano de 10 dígitos agrega el indicativo 57
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
  return digits;
}

const PAYMENT_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', cripto: 'Criptomonedas' };
const STATUS_LABELS = {
  recibido: 'Recibido', preparando: 'Preparando', despachado: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado',
};

const CATEGORY_EMOJI = {
  Abarrotes: '🥫', 'Lácteos y huevos': '🥛', Panadería: '🥖', Bebidas: '🥤', 'Frutas y verduras': '🍌',
  'Carnes y embutidos': '🥩', 'Aseo del hogar': '🧴', 'Cuidado personal': '🧼', 'Snacks y dulces': '🍫',
  Licores: '🍺', Mascotas: '🐶',
};
const categoryEmoji = (c) => CATEGORY_EMOJI[c] || '🛍️';

module.exports = { categoryEmoji, formatMoney, formatDate, normalizePhone, PAYMENT_LABELS, STATUS_LABELS };
