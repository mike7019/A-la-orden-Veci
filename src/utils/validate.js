// Validaciones sencillas para formularios
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const int = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : NaN;
};
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => /^\d{7,15}$/.test(String(v).replace(/\D/g, ''));

module.exports = { str, int, isEmail, isPhone };
