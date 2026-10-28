require('dotenv').config({ quiet: true });

const env = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-cambiar',
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  searchRadiusKm: parseFloat(process.env.SEARCH_RADIUS_KM) || 5,
  courierSpeedKmh: parseFloat(process.env.COURIER_SPEED_KMH) || 30,
  whatsapp: {
    provider: (process.env.WHATSAPP_PROVIDER || 'link').toLowerCase(),
    cloud: {
      token: process.env.WHATSAPP_CLOUD_TOKEN,
      phoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
      apiVersion: process.env.WHATSAPP_CLOUD_API_VERSION || 'v21.0',
      template: process.env.WHATSAPP_CLOUD_TEMPLATE,
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_WHATSAPP_FROM,
    },
  },
};

if (env.isProd && env.sessionSecret === 'dev-secret-cambiar') {
  throw new Error('Configura SESSION_SECRET en producción');
}

module.exports = env;
