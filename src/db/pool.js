const { Pool } = require('pg');
const { config } = require('../config');
const logger = require('../config/logger');

let pool = null;

function getPool() {
  if (!pool && config.database.url) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });
  }
  return pool;
}

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    logger.debug('DB query', { text: text.substring(0, 80), duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('DB query error', { text: text.substring(0, 80), error: err.message });
    throw err;
  }
}

async function getClient() {
  return getPool().connect();
}

async function healthCheck() {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { query, getClient, healthCheck, getPool };
