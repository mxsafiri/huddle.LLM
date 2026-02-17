const { detectTrigger, detectLanguage } = require('../triggers');
const memory = require('../services/memory');
const ai = require('../services/ai');
const whatsapp = require('../services/whatsapp');
const logger = require('../config/logger');

const RESPONSES = {
  en: {
    sessionStarted: (code) =>
      `🟢 *Huddle started!*\n\n📋 Session code: *${code}*\n\nShare this code with your group members. They can join by messaging me:\n\`join ${code}\`\n\nCommands: "summary", "close", or send an amount.`,
    sessionExists: (code) =>
      `⚡ You already have an active Huddle: *${code}*\nShare it so others can join: \`join ${code}\``,
    joined: (code, count) =>
      `✅ You joined Huddle *${code}*! (${count} participants)\n\nSend contributions (e.g. "5000"), commitments ("I will..."), or "summary".`,
    alreadyJoined: (code) => `You're already in Huddle *${code}*.`,
    invalidCode: '❌ Invalid code. Ask the huddle creator for the correct code.',
    noSession: '❌ No active Huddle. Type *"start huddle"* to create one, or *"join HUD-XXXXXX"* to join.',
    contributionLogged: (name, amount) => `✅ ${name}: ${amount} TZS logged.`,
    taskLogged: (name, text) => `📌 ${name} committed: "${text}"`,
    sessionClosed: '🔴 Huddle closed. Data will be auto-deleted in 3 days.',
    myHuddle: (code, participants, contributions) =>
      `📋 *Your Huddle: ${code}*\n👥 ${participants} participants\n💰 ${contributions} contributions`,
    left: '👋 You left the Huddle.',
    notInHuddle: '❌ You\'re not in any active Huddle.',
    intro: '👋 *I\'m Huddle* — I help groups track contributions and commitments.\n\n📌 *"start huddle"* — create a new session\n📌 *"join HUD-XXXXXX"* — join an existing session\n📌 *"summary"* — get a summary\n📌 *"close"* — end the session\n\nAll data auto-deletes after 3 days.',
    error: '⚠️ Something went wrong. Please try again.',
    notifyJoined: (name) => `👤 *${name}* joined the Huddle.`,
    notifyContribution: (name, amount) => `💰 *${name}* contributed ${amount} TZS.`,
    notifyTask: (name, text) => `📌 *${name}* committed: "${text}"`,
    notifyClosed: (closer) => `🔴 *${closer}* closed the Huddle.`,
  },
  sw: {
    sessionStarted: (code) =>
      `🟢 *Huddle imeanza!*\n\n📋 Nambari ya kikao: *${code}*\n\nShiriki nambari hii na wanakikundi wako. Wanaweza kujiunga kwa kunimtumia:\n\`jiunge ${code}\`\n\nAmri: "muhtasari", "funga", au tuma kiasi.`,
    sessionExists: (code) =>
      `⚡ Tayari una Huddle inayoendelea: *${code}*\nShiriki: \`jiunge ${code}\``,
    joined: (code, count) =>
      `✅ Umejiunga na Huddle *${code}*! (washiriki ${count})\n\nTuma mchango (mfano "5000"), ahadi ("nitafanya..."), au "muhtasari".`,
    alreadyJoined: (code) => `Tayari uko kwenye Huddle *${code}*.`,
    invalidCode: '❌ Nambari si sahihi. Uliza muundaji wa huddle nambari sahihi.',
    noSession: '❌ Hakuna Huddle. Andika *"anza huddle"* kuunda, au *"jiunge HUD-XXXXXX"* kujiunga.',
    contributionLogged: (name, amount) => `✅ ${name}: ${amount} TZS imerekodiwa.`,
    taskLogged: (name, text) => `📌 ${name} ameahidi: "${text}"`,
    sessionClosed: '🔴 Huddle imefungwa. Data itafutwa baada ya siku 3.',
    myHuddle: (code, participants, contributions) =>
      `📋 *Huddle yako: ${code}*\n👥 Washiriki ${participants}\n💰 Michango ${contributions}`,
    left: '👋 Umeondoka kwenye Huddle.',
    notInHuddle: '❌ Huko kwenye Huddle yoyote.',
    intro: '👋 *Mimi ni Huddle* — ninasaidia vikundi kufuatilia michango na ahadi.\n\n📌 *"anza huddle"* — unda kikao kipya\n📌 *"jiunge HUD-XXXXXX"* — jiunge na kikao\n📌 *"muhtasari"* — pata muhtasari\n📌 *"funga"* — maliza kikao\n\nData inajifuta baada ya siku 3.',
    error: '⚠️ Kuna tatizo. Tafadhali jaribu tena.',
    notifyJoined: (name) => `👤 *${name}* amejiunga na Huddle.`,
    notifyContribution: (name, amount) => `💰 *${name}* amechangia ${amount} TZS.`,
    notifyTask: (name, text) => `📌 *${name}* ameahidi: "${text}"`,
    notifyClosed: (closer) => `🔴 *${closer}* amefunga Huddle.`,
  },
};

function getResponse(lang, key, ...args) {
  const template = RESPONSES[lang]?.[key] || RESPONSES.en[key];
  return typeof template === 'function' ? template(...args) : template;
}

function reply(from, text) {
  return whatsapp.sendMessage(from, text);
}

async function handleMessage(parsed) {
  if (!parsed || !parsed.text) return;

  const { from, text, senderName } = parsed;

  try {
    const trigger = detectTrigger(text);
    const detectedLang = detectLanguage(text);

    if (!trigger) {
      const session = await memory.getUserActiveSession(from);
      if (session) {
        logger.info('User in session but no trigger', { from, text });
      } else {
        await reply(from, getResponse(detectedLang, 'intro'));
      }
      return;
    }

    logger.info('Processing trigger', { action: trigger.action, from });

    switch (trigger.action) {
      case 'START_HUDDLE':
        return await handleStartHuddle(from, senderName, detectedLang);

      case 'JOIN_HUDDLE':
        return await handleJoinHuddle(from, senderName, trigger.data.code, detectedLang);

      case 'TRACK_CONTRIBUTION':
        return await handleContribution(from, senderName, trigger.data);

      case 'ASSIGN_TASK':
        return await handleTask(from, senderName, text);

      case 'SUMMARIZE':
        return await handleSummary(from);

      case 'CLOSE_HUDDLE':
        return await handleClose(from, senderName);

      case 'MY_HUDDLE':
        return await handleMyHuddle(from);

      case 'LEAVE_HUDDLE':
        return await handleLeave(from);

      default:
        logger.warn('Unknown trigger action', { action: trigger.action });
    }
  } catch (err) {
    logger.error('Message handler error', { error: err.message, from });
    await reply(from, getResponse('en', 'error'));
  }
}

async function handleStartHuddle(from, senderName, language) {
  const existing = await memory.getUserActiveSession(from);
  if (existing) {
    return reply(from, getResponse(existing.language, 'sessionExists', existing.session_code));
  }

  const session = await memory.createSession(from, language, from);
  await reply(from, getResponse(session.language, 'sessionStarted', session.session_code));
}

async function handleJoinHuddle(from, senderName, code, language) {
  const existing = await memory.getUserActiveSession(from);
  if (existing) {
    return reply(from, getResponse(existing.language, 'alreadyJoined', existing.session_code));
  }

  const session = await memory.getSessionByCode(code);
  if (!session) {
    return reply(from, getResponse(language, 'invalidCode'));
  }

  await memory.addParticipant(session.id, from, senderName);
  const participants = await memory.getParticipants(session.id);
  const lang = session.language;

  await reply(from, getResponse(lang, 'joined', session.session_code, participants.length));

  await memory.notifyParticipants(
    session.id,
    getResponse(lang, 'notifyJoined', senderName || from),
    (userId, text) => whatsapp.sendMessage(userId, text),
    from
  );
}

async function handleContribution(from, senderName, data) {
  const session = await memory.getUserActiveSession(from);
  if (!session) {
    return reply(from, getResponse('en', 'noSession'));
  }

  await memory.addContribution(session.id, from, senderName, data.amount, null);
  const lang = session.language;
  await reply(from, getResponse(lang, 'contributionLogged', senderName || from, data.amount));

  await memory.notifyParticipants(
    session.id,
    getResponse(lang, 'notifyContribution', senderName || from, data.amount),
    (userId, text) => whatsapp.sendMessage(userId, text),
    from
  );
}

async function handleTask(from, senderName, text) {
  const session = await memory.getUserActiveSession(from);
  if (!session) {
    return reply(from, getResponse('en', 'noSession'));
  }

  await memory.addContribution(session.id, from, senderName, null, text);
  const lang = session.language;
  await reply(from, getResponse(lang, 'taskLogged', senderName || from, text));

  await memory.notifyParticipants(
    session.id,
    getResponse(lang, 'notifyTask', senderName || from, text),
    (userId, text) => whatsapp.sendMessage(userId, text),
    from
  );
}

async function handleSummary(from) {
  const session = await memory.getUserActiveSession(from);
  if (!session) {
    return reply(from, getResponse('en', 'noSession'));
  }

  const full = await memory.getSessionWithContributors(session.id);
  const summary = await ai.generateSummary(full, session.language);
  await reply(from, `📊 *Huddle Summary (${session.session_code})*\n\n${summary}`);
}

async function handleClose(from, senderName) {
  const session = await memory.getUserActiveSession(from);
  if (!session) {
    return reply(from, getResponse('en', 'noSession'));
  }

  const full = await memory.getSessionWithContributors(session.id);
  let summary = null;

  try {
    summary = await ai.generateSummary(full, session.language);
  } catch (err) {
    logger.warn('Failed to generate closing summary', { error: err.message });
  }

  await memory.closeSession(session.group_id, summary);

  let closeMsg = getResponse(session.language, 'sessionClosed');
  if (summary) {
    closeMsg = `📊 *Final Summary (${session.session_code})*\n\n${summary}\n\n${closeMsg}`;
  }

  await memory.notifyParticipants(
    session.id,
    closeMsg,
    (userId, text) => whatsapp.sendMessage(userId, text)
  );
}

async function handleMyHuddle(from) {
  const session = await memory.getUserActiveSession(from);
  if (!session) {
    return reply(from, getResponse('en', 'notInHuddle'));
  }

  const participants = await memory.getParticipants(session.id);
  const full = await memory.getSessionWithContributors(session.id);
  const lang = session.language;

  await reply(from, getResponse(lang, 'myHuddle', session.session_code, participants.length, full.contributors.length));
}

async function handleLeave(from) {
  const session = await memory.getUserActiveSession(from);
  if (!session) {
    return reply(from, getResponse('en', 'notInHuddle'));
  }

  const { query } = require('../db/pool');
  await query('DELETE FROM participants WHERE session_id = $1 AND user_id = $2', [session.id, from]);

  const lang = session.language;
  await reply(from, getResponse(lang, 'left'));
}

module.exports = { handleMessage, RESPONSES };
