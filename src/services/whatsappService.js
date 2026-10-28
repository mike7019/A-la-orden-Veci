/**
 * Notificación de pedidos a la tienda por WhatsApp.
 * Proveedores (WHATSAPP_PROVIDER):
 *  - cloud : WhatsApp Cloud API de Meta (envío automático)
 *  - twilio: Twilio WhatsApp (envío automático)
 *  - link  : no envía; genera un enlace wa.me con el mensaje para que el cliente lo envíe
 * Siempre se genera el enlace wa.me como respaldo.
 */
const env = require('../config/env');
const { formatMoney, PAYMENT_LABELS } = require('../utils/format');

function buildOrderMessage(order, store) {
  const lines = order.items.map((i) => `• ${i.quantity} x ${i.product_name} — ${formatMoney(i.line_total)}`);
  const maps = order.customer_lat
    ? `\n📍 Ubicación: https://maps.google.com/?q=${order.customer_lat},${order.customer_lng}` : '';
  return [
    `🛒 *Nuevo pedido #${order.code}* — A la orden Veci`,
    `Tienda: ${store.name}`,
    '',
    `👤 ${order.first_name} ${order.last_name}`,
    `📞 ${order.phone}`,
    `🏠 ${order.address}`,
    order.reference ? `ℹ️ Referencia: ${order.reference}` : null,
    maps ? maps.trim() : null,
    '',
    '*Productos:*',
    ...lines,
    '',
    `Subtotal: ${formatMoney(order.subtotal)}`,
    `Domicilio: ${formatMoney(order.delivery_fee)}`,
    `*Total: ${formatMoney(order.total)}*`,
    `💳 Pago: ${PAYMENT_LABELS[order.payment_method]}`,
    order.notes ? `📝 Nota: ${order.notes}` : null,
    '',
    `Gestionar pedido: ${env.appUrl}/tendero/pedidos/${order.id}`,
  ].filter((l) => l !== null).join('\n');
}

const waLink = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

async function sendViaCloud(to, text, order) {
  const { token, phoneNumberId, apiVersion, template } = env.whatsapp.cloud;
  if (!token || !phoneNumberId) throw new Error('Faltan credenciales de WhatsApp Cloud API');
  // Fuera de la ventana de 24 h Meta exige una plantilla aprobada
  const body = template
    ? {
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name: template, language: { code: 'es' },
        components: [{ type: 'body', parameters: [
          { type: 'text', text: order.code },
          { type: 'text', text: `${order.first_name} ${order.last_name} · ${formatMoney(order.total)}` },
        ] }],
      },
    }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text } };
  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WhatsApp Cloud API ${res.status}: ${await res.text()}`);
}

async function sendViaTwilio(to, text) {
  const { accountSid, authToken, from } = env.whatsapp.twilio;
  if (!accountSid || !authToken || !from) throw new Error('Faltan credenciales de Twilio');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: `whatsapp:+${to}`, Body: text.slice(0, 1600) }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

/**
 * Notifica a la tienda. Nunca lanza error: el pedido ya quedó guardado.
 * @returns {{status: 'enviado'|'enlace'|'error', link: string}}
 */
async function notifyStore(order, store) {
  const text = buildOrderMessage(order, store);
  const link = waLink(store.whatsapp, text);
  const { provider } = env.whatsapp;
  try {
    if (provider === 'cloud') await sendViaCloud(store.whatsapp, text, order);
    else if (provider === 'twilio') await sendViaTwilio(store.whatsapp, text);
    else return { status: 'enlace', link };
    return { status: 'enviado', link };
  } catch (err) {
    console.error(`[WhatsApp] No se pudo notificar el pedido ${order.code}:`, err.message);
    return { status: 'error', link };
  }
}

module.exports = { notifyStore, buildOrderMessage, waLink };
