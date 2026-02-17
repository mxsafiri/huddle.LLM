require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v24.0',
    get baseUrl() {
      return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    },
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: 500,
  },

  session: {
    expiryDays: parseInt(process.env.SESSION_EXPIRY_DAYS, 10) || 3,
    cleanupCron: process.env.CLEANUP_CRON || '0 */6 * * *',
  },
};

function validateConfig() {
  const required = [
    ['WHATSAPP_VERIFY_TOKEN', config.whatsapp.verifyToken],
    ['WHATSAPP_ACCESS_TOKEN', config.whatsapp.accessToken],
    ['WHATSAPP_PHONE_NUMBER_ID', config.whatsapp.phoneNumberId],
    ['DATABASE_URL', config.database.url],
    ['OPENAI_API_KEY', config.openai.apiKey],
  ];

  const missing = required.filter(([, val]) => !val).map(([name]) => name);

  if (missing.length > 0) {
    console.warn(`WARNING: Missing env vars: ${missing.join(', ')}. Some features will not work.`);
  }
}

module.exports = { config, validateConfig };
