const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');
const logger = require('../config/logger');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await pool.query(sql);
    logger.info('Database migration completed successfully');
  } catch (err) {
    logger.error('Database migration failed', { error: err.message });
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrate };
