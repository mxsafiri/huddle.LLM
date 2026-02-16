const { query } = require('../db/pool');
const { config } = require('../config');
const logger = require('../config/logger');

async function createSession(groupId, language = 'en') {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.session.expiryDays);

  const result = await query(
    `INSERT INTO sessions (group_id, status, language, expires_at)
     VALUES ($1, 'active', $2, $3)
     ON CONFLICT (group_id, status) DO NOTHING
     RETURNING *`,
    [groupId, language, expiresAt]
  );

  if (result.rows.length === 0) {
    return getActiveSession(groupId);
  }

  logger.info('Session created', { groupId, sessionId: result.rows[0].id });
  return result.rows[0];
}

async function getActiveSession(groupId) {
  const result = await query(
    `SELECT * FROM sessions WHERE group_id = $1 AND status = 'active' LIMIT 1`,
    [groupId]
  );
  return result.rows[0] || null;
}

async function getSessionWithContributors(sessionId) {
  const sessionResult = await query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  const session = sessionResult.rows[0];
  if (!session) return null;

  const contribResult = await query(
    'SELECT * FROM contributors WHERE session_id = $1 ORDER BY created_at',
    [sessionId]
  );

  const contributors = contribResult.rows;
  const totalAmount = contributors.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  return { ...session, contributors, totalAmount };
}

async function addContribution(sessionId, userId, userName, amount, commitmentText) {
  const result = await query(
    `INSERT INTO contributors (session_id, user_id, user_name, amount, commitment_text)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [sessionId, userId, userName, amount, commitmentText]
  );
  logger.info('Contribution added', { sessionId, userId, amount });
  return result.rows[0];
}

async function closeSession(groupId, summary = null) {
  const result = await query(
    `UPDATE sessions 
     SET status = 'closed', closed_at = NOW(), summary = $2
     WHERE group_id = $1 AND status = 'active'
     RETURNING *`,
    [groupId, summary]
  );

  if (result.rows.length > 0) {
    logger.info('Session closed', { groupId, sessionId: result.rows[0].id });
  }
  return result.rows[0] || null;
}

async function cleanupExpiredSessions() {
  const result = await query(
    `UPDATE sessions SET status = 'expired' WHERE status = 'active' AND expires_at < NOW() RETURNING id`
  );
  const expiredCount = result.rowCount;

  if (expiredCount > 0) {
    logger.info('Expired sessions cleaned up', { count: expiredCount });
  }

  const deleted = await query(
    `DELETE FROM sessions WHERE status IN ('closed', 'expired') AND 
     (closed_at < NOW() - INTERVAL '3 days' OR expires_at < NOW() - INTERVAL '3 days')
     RETURNING id`
  );

  if (deleted.rowCount > 0) {
    logger.info('Old sessions deleted', { count: deleted.rowCount });
  }

  return { expired: expiredCount, deleted: deleted.rowCount };
}

async function updateSessionLanguage(groupId, language) {
  await query(
    `UPDATE sessions SET language = $2 WHERE group_id = $1 AND status = 'active'`,
    [groupId, language]
  );
}

if (require.main === module) {
  cleanupExpiredSessions()
    .then((result) => {
      console.log('Cleanup result:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}

module.exports = {
  createSession,
  getActiveSession,
  getSessionWithContributors,
  addContribution,
  closeSession,
  cleanupExpiredSessions,
  updateSessionLanguage,
};
