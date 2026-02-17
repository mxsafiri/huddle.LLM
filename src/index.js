const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const { config, validateConfig } = require('./config');
const logger = require('./config/logger');
const webhookRoutes = require('./routes/webhook');
const { healthCheck } = require('./db/pool');
const { cleanupExpiredSessions } = require('./services/memory');

validateConfig();

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    dbOk = await healthCheck();
  } catch {
    dbOk = false;
  }
  res.status(200).json({
    status: dbOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbOk ? 'connected' : 'disconnected',
  });
});

app.get('/', (_req, res) => {
  res.json({ service: 'huddle', status: 'running' });
});

app.get('/test-groups-api', async (_req, res) => {
  const axios = require('axios');
  const { config } = require('./config');
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/groups`,
      {
        messaging_product: 'whatsapp',
        name: 'Huddle Test Group',
        participants: [],
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.json({
      success: false,
      status: err.response?.status,
      error: err.response?.data || err.message,
    });
  }
});

app.use('/', webhookRoutes);

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

try {
  cron.schedule(config.session.cleanupCron, async () => {
    logger.info('Running scheduled session cleanup');
    try {
      const result = await cleanupExpiredSessions();
      logger.info('Cleanup complete', result);
    } catch (err) {
      logger.error('Scheduled cleanup failed', { error: err.message });
    }
  });
} catch (err) {
  logger.error('Failed to schedule cleanup cron', { error: err.message });
}

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Huddle agent running on port ${config.port}`, {
    env: config.nodeEnv,
    cleanup: config.session.cleanupCron,
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

module.exports = app;
