const { query } = require('../db/pool');
const { config } = require('../config');
const logger = require('../config/logger');

function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `HUD-${code}`;
}

async function createSession(groupId, language = 'en', creatorId = null) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.session.expiryDays);
  const sessionCode = generateSessionCode();

  const result = await query(
    `INSERT INTO sessions (group_id, session_code, creator_id, status, language, expires_at)
     VALUES ($1, $2, $3, 'active', $4, $5)
     ON CONFLICT (group_id, status) DO NOTHING
     RETURNING *`,
    [groupId, sessionCode, creatorId, language, expiresAt]
  );

  if (result.rows.length === 0) {
    return getActiveSession(groupId);
  }

  if (creatorId) {
    await addParticipant(result.rows[0].id, creatorId);
  }

  logger.info('Session created', { groupId, sessionId: result.rows[0].id, sessionCode });
  return result.rows[0];
}

async function getActiveSession(groupId) {
  const result = await query(
    `SELECT * FROM sessions WHERE group_id = $1 AND status = 'active' LIMIT 1`,
    [groupId]
  );
  return result.rows[0] || null;
}

async function getSessionByCode(code) {
  const result = await query(
    `SELECT * FROM sessions WHERE session_code = $1 AND status = 'active' LIMIT 1`,
    [code.toUpperCase()]
  );
  return result.rows[0] || null;
}

async function getUserActiveSession(userId) {
  const result = await query(
    `SELECT s.* FROM sessions s
     JOIN participants p ON p.session_id = s.id
     WHERE p.user_id = $1 AND s.status = 'active'
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function addParticipant(sessionId, userId, userName = null) {
  const result = await query(
    `INSERT INTO participants (session_id, user_id, user_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, user_id) DO NOTHING
     RETURNING *`,
    [sessionId, userId, userName]
  );
  return result.rows[0] || null;
}

async function getParticipants(sessionId) {
  const result = await query(
    `SELECT * FROM participants WHERE session_id = $1 ORDER BY joined_at`,
    [sessionId]
  );
  return result.rows;
}

async function notifyParticipants(sessionId, text, sendFn, excludeUserId = null) {
  const participants = await getParticipants(sessionId);
  for (const p of participants) {
    if (p.user_id !== excludeUserId) {
      try {
        await sendFn(p.user_id, text);
      } catch (err) {
        logger.error('Failed to notify participant', { userId: p.user_id, error: err.message });
      }
    }
  }
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
  getSessionByCode,
  getUserActiveSession,
  addParticipant,
  getParticipants,
  notifyParticipants,
  getSessionWithContributors,
  addContribution,
  closeSession,
  cleanupExpiredSessions,
  updateSessionLanguage,
};
