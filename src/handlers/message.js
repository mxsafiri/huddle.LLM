const { detectTrigger, detectLanguage } = require('../triggers');
const memory = require('../services/memory');
const ai = require('../services/ai');
const whatsapp = require('../services/whatsapp');
const logger = require('../config/logger');

const RESPONSES = {
  en: {
    sessionStarted: '🟢 Huddle started! Share contributions or commitments. Type "summary" anytime, "close" when done.',
    sessionExists: '⚡ A Huddle is already active in this group.',
    noSession: '❌ No active Huddle. Type "start huddle" to begin.',
    contributionLogged: (name, amount) => `✅ ${name}: ${amount} TZS logged.`,
    taskLogged: (name, text) => `📌 ${name} committed: "${text}"`,
    sessionClosed: '🔴 Huddle closed. Data will be auto-deleted in 3 days.',
    intro: '👋 I\'m Huddle — I help groups align quickly. Add me and type "start huddle" to begin. Auto-deletes when done.',
    error: '⚠️ Something went wrong. Please try again.',
  },
  sw: {
    sessionStarted: '🟢 Huddle imeanza! Tuma mchango au ahadi yako. Andika "muhtasari" wakati wowote, "funga" ukimaliza.',
    sessionExists: '⚡ Huddle tayari ipo kwenye kikundi hiki.',
    noSession: '❌ Hakuna Huddle inayoendelea. Andika "anza huddle" kuanza.',
    contributionLogged: (name, amount) => `✅ ${name}: ${amount} TZS imerekodiwa.`,
    taskLogged: (name, text) => `📌 ${name} ameahidi: "${text}"`,
    sessionClosed: '🔴 Huddle imefungwa. Data itafutwa baada ya siku 3.',
    intro: '👋 Mimi ni Huddle — ninasaidia vikundi kupatana haraka. Niongeze na andika "anza huddle". Inajifuta ikimalizika.',
    error: '⚠️ Kuna tatizo. Tafadhali jaribu tena.',
  },
};

function getResponse(lang, key, ...args) {
  const template = RESPONSES[lang]?.[key] || RESPONSES.en[key];
  return typeof template === 'function' ? template(...args) : template;
}

async function handleMessage(parsed) {
  if (!parsed || !parsed.text) return;

  const { from, text, senderName, groupJid } = parsed;
  const chatId = groupJid || from;

  try {
    const trigger = detectTrigger(text);
    const detectedLang = detectLanguage(text);

    if (!trigger) {
      logger.info('No trigger matched, sending intro', { chatId, text });
      await whatsapp.sendMessage(from, getResponse(detectedLang, 'intro'));
      return;
    }

    logger.info('Processing trigger', { action: trigger.action, chatId, from });

    switch (trigger.action) {
      case 'START_HUDDLE':
        return await handleStartHuddle(chatId, detectedLang);

      case 'TRACK_CONTRIBUTION':
        return await handleContribution(chatId, from, senderName, trigger.data);

      case 'ASSIGN_TASK':
        return await handleTask(chatId, from, senderName, text);

      case 'SUMMARIZE':
        return await handleSummary(chatId);

      case 'CLOSE_HUDDLE':
        return await handleClose(chatId);

      default:
        logger.warn('Unknown trigger action', { action: trigger.action });
    }
  } catch (err) {
    logger.error('Message handler error', { error: err.message, chatId });
    const session = await memory.getActiveSession(chatId);
    const lang = session?.language || 'en';
    await whatsapp.sendMessage(chatId, getResponse(lang, 'error'));
  }
}

async function handleStartHuddle(chatId, language) {
  const existing = await memory.getActiveSession(chatId);
  if (existing) {
    return whatsapp.sendMessage(chatId, getResponse(existing.language, 'sessionExists'));
  }

  const session = await memory.createSession(chatId, language);
  await whatsapp.sendMessage(chatId, getResponse(session.language, 'sessionStarted'));
}

async function handleContribution(chatId, userId, userName, data) {
  const session = await memory.getActiveSession(chatId);
  if (!session) {
    const lang = detectLanguage('');
    return whatsapp.sendMessage(chatId, getResponse(lang, 'noSession'));
  }

  await memory.addContribution(session.id, userId, userName, data.amount, null);
  const lang = session.language;
  await whatsapp.sendMessage(
    chatId,
    getResponse(lang, 'contributionLogged', userName || userId, data.amount)
  );
}

async function handleTask(chatId, userId, userName, text) {
  const session = await memory.getActiveSession(chatId);
  if (!session) {
    return whatsapp.sendMessage(chatId, getResponse('en', 'noSession'));
  }

  await memory.addContribution(session.id, userId, userName, null, text);
  const lang = session.language;
  await whatsapp.sendMessage(chatId, getResponse(lang, 'taskLogged', userName || userId, text));
}

async function handleSummary(chatId) {
  const session = await memory.getActiveSession(chatId);
  if (!session) {
    return whatsapp.sendMessage(chatId, getResponse('en', 'noSession'));
  }

  const full = await memory.getSessionWithContributors(session.id);
  const summary = await ai.generateSummary(full, session.language);
  await whatsapp.sendMessage(chatId, `📊 *Huddle Summary*\n\n${summary}`);
}

async function handleClose(chatId) {
  const session = await memory.getActiveSession(chatId);
  if (!session) {
    return whatsapp.sendMessage(chatId, getResponse('en', 'noSession'));
  }

  const full = await memory.getSessionWithContributors(session.id);
  let summary = null;

  try {
    summary = await ai.generateSummary(full, session.language);
  } catch (err) {
    logger.warn('Failed to generate closing summary', { error: err.message });
  }

  await memory.closeSession(chatId, summary);

  let closeMsg = getResponse(session.language, 'sessionClosed');
  if (summary) {
    closeMsg = `📊 *Final Summary*\n\n${summary}\n\n${closeMsg}`;
  }

  await whatsapp.sendMessage(chatId, closeMsg);
}

module.exports = { handleMessage, RESPONSES };
