const logger = require('../config/logger');

const TRIGGERS = [
  {
    name: 'start_huddle',
    keywords: ['start huddle', 'anza huddle'],
    action: 'START_HUDDLE',
  },
  {
    name: 'close_huddle',
    keywords: ['close huddle', 'funga huddle', 'close', 'funga'],
    action: 'CLOSE_HUDDLE',
  },
  {
    name: 'summarize',
    keywords: ['summary', 'muhtasari'],
    action: 'SUMMARIZE',
  },
  {
    name: 'assign_task',
    keywords: ['i will', 'nitafanya', 'niko tayari'],
    action: 'ASSIGN_TASK',
  },
];

const CONTRIBUTION_REGEX = /(\d[\d,]*\.?\d*)\s*[kK]?\s*(TZS|tsh|TSH|Tsh)?/i;
const AMOUNT_MULTIPLIER_REGEX = /(\d[\d,]*\.?\d*)\s*[kK]/i;

function detectTrigger(text) {
  if (!text || typeof text !== 'string') return null;

  const normalized = text.toLowerCase().trim();

  for (const trigger of TRIGGERS) {
    for (const keyword of trigger.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        logger.debug('Trigger matched', { trigger: trigger.name, text: normalized });
        return { name: trigger.name, action: trigger.action };
      }
    }
  }

  const contribution = extractContribution(text);
  if (contribution) {
    return { name: 'track_contribution', action: 'TRACK_CONTRIBUTION', data: contribution };
  }

  return null;
}

function extractContribution(text) {
  if (!text) return null;

  const match = text.match(CONTRIBUTION_REGEX);
  if (!match) return null;

  let amount = parseFloat(match[1].replace(/,/g, ''));

  if (AMOUNT_MULTIPLIER_REGEX.test(text)) {
    amount *= 1000;
  }

  if (amount <= 0 || amount > 100_000_000) return null;

  return { amount, raw: match[0] };
}

function detectLanguage(text) {
  if (!text) return 'en';

  const swahiliMarkers = [
    'habari', 'sawa', 'asante', 'tafadhali', 'ndiyo', 'hapana',
    'karibu', 'kwaheri', 'sana', 'bado', 'tayari', 'kazi',
    'pesa', 'hela', 'shilingi', 'mchango', 'kikundi', 'watu',
    'nitafanya', 'niko', 'tuko', 'anza', 'funga', 'muhtasari',
    'nimeshatuma', 'nitatuma', 'tunaendelea', 'haya', 'safi',
  ];

  const normalized = text.toLowerCase();
  const swahiliCount = swahiliMarkers.filter((m) => normalized.includes(m)).length;
  const words = normalized.split(/\s+/).length;
  const ratio = swahiliCount / Math.max(words, 1);

  return ratio > 0.1 || swahiliCount >= 2 ? 'sw' : 'en';
}

module.exports = { detectTrigger, extractContribution, detectLanguage, TRIGGERS };
