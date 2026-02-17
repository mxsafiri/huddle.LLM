const axios = require('axios');
const { config } = require('../config');
const logger = require('../config/logger');

function getApi() {
  return axios.create({
    baseURL: `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}`,
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

async function sendMessage(to, text) {
  try {
    const response = await getApi().post('/messages', {
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
  try {
    const response = await getApi().post(`/groups/${groupId}/messages`, {
      messaging_product: 'whatsapp',
      type: 'text',
      text: { body: text },
    });
    logger.info('Group message sent', { groupId, messageId: response.data?.messages?.[0]?.id });
    return response.data;
  } catch (err) {
    logger.error('Failed to send group message', {
      groupId,
      error: err.response?.data || err.message,
    });
    throw err;
  }
}

async function createGroup(name, participants) {
  try {
    const response = await getApi().post('/groups', {
      messaging_product: 'whatsapp',
      name,
      participants: participants.map((p) => ({ phone_number: p })),
    });
    logger.info('Group created', { name, groupId: response.data?.id });
    return response.data;
  } catch (err) {
    logger.error('Failed to create group', {
      name,
      error: err.response?.data || err.message,
    });
    throw err;
  }
}

function parseWebhookMessage(body) {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const field = changes?.field;

    if (!value?.messages?.length) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const groupId = message.group_id || null;
    const isGroup = !!groupId;

    return {
      messageId: message.id,
      from: message.from,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body || '',
      senderName: contact?.profile?.name || 'Unknown',
      isGroup,
      groupId,
      field,
    };
  } catch (err) {
    logger.error('Failed to parse webhook message', { error: err.message });
    return null;
  }
}

module.exports = { sendMessage, sendGroupMessage, createGroup, parseWebhookMessage };
