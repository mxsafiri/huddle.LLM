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
  const dbOk = await healthCheck();
  const status = dbOk ? 'healthy' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbOk ? 'connected' : 'disconnected',
  });
});

app.use('/', webhookRoutes);

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

cron.schedule(config.session.cleanupCron, async () => {
  logger.info('Running scheduled session cleanup');
  try {
    const result = await cleanupExpiredSessions();
    logger.info('Cleanup complete', result);
  } catch (err) {
    logger.error('Scheduled cleanup failed', { error: err.message });
  }
});

const server = app.listen(config.port, () => {
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

module.exports = app;
