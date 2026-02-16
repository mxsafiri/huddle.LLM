const axios = require('axios');
const { config } = require('../config');
const logger = require('../config/logger');

const api = axios.create({
  baseURL: `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}`,
  headers: {
    Authorization: `Bearer ${config.whatsapp.accessToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

async function sendMessage(to, text) {
  try {
    const response = await api.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    });
    logger.info('Message sent', { to, messageId: response.data?.messages?.[0]?.id });
    return response.data;
  } catch (err) {
    logger.error('Failed to send WhatsApp message', {
      to,
      error: err.response?.data || err.message,
    });
    throw err;
  }
}

async function sendGroupMessage(groupId, text) {
  return sendMessage(groupId, text);
}

function parseWebhookMessage(body) {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    return {
      messageId: message.id,
      from: message.from,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body || '',
      senderName: contact?.profile?.name || 'Unknown',
      groupId: value.metadata?.display_phone_number || message.from,
      isGroup: !!message.group_id,
      groupJid: message.group_id || null,
    };
  } catch (err) {
    logger.error('Failed to parse webhook message', { error: err.message });
    return null;
  }
}

module.exports = { sendMessage, sendGroupMessage, parseWebhookMessage };
