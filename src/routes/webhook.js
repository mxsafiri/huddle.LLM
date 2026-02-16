const express = require('express');
const { config } = require('../config');
const { parseWebhookMessage } = require('../services/whatsapp');
const { handleMessage } = require('../handlers/message');
const logger = require('../config/logger');

const router = express.Router();

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Webhook verified');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', { mode, token });
  return res.sendStatus(403);
});

router.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const parsed = parseWebhookMessage(req.body);
    if (!parsed) return;

    logger.info('Incoming message', {
      from: parsed.from,
      type: parsed.type,
      group: parsed.groupJid,
    });

    await handleMessage(parsed);
  } catch (err) {
    logger.error('Webhook processing error', { error: err.message, stack: err.stack });
  }
});

module.exports = router;
