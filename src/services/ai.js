const OpenAI = require('openai');
const { config } = require('../config');
const logger = require('../config/logger');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const SYSTEM_PROMPT = `You are Huddle, a concise group coordination assistant. 
Rules:
- Keep responses under 3 sentences
- Support both English and Swahili
- Reply in the same language as the input
- Focus on actionable summaries
- Never store or repeat personal data beyond the session`;

async function generateSummary(sessionData, language = 'en') {
  const langInstruction = language === 'sw'
    ? 'Respond in Swahili.'
    : 'Respond in English.';

  const prompt = `${langInstruction}
Summarize this group coordination session concisely:

Session Status: ${sessionData.status}
Contributors: ${sessionData.contributors?.length || 0}
Total Pledged: ${sessionData.totalAmount || 0}
Commitments:
${(sessionData.contributors || []).map(c =>
    `- ${c.user_name || c.user_id}: ${c.amount ? `${c.amount} TZS` : ''} ${c.commitment_text || ''}`
  ).join('\n')}`;

  return callAI(prompt);
}

async function resolveConflict(context, language = 'en') {
  const langInstruction = language === 'sw'
    ? 'Respond in Swahili.'
    : 'Respond in English.';

  const prompt = `${langInstruction}
Help clarify this group coordination issue in one short paragraph:
${context}`;

  return callAI(prompt);
}

async function normalizeLanguage(text) {
  const prompt = `Detect language (en or sw) and extract the key intent from this message. 
Return JSON: {"language": "en"|"sw", "intent": "brief description", "normalized": "cleaned text"}
Message: "${text}"`;

  const response = await callAI(prompt, true);
  try {
    return JSON.parse(response);
  } catch {
    return { language: 'en', intent: text, normalized: text };
  }
}

async function callAI(prompt, json = false) {
  try {
    const params = {
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    };

    if (json) {
      params.response_format = { type: 'json_object' };
    }

    const completion = await openai.chat.completions.create(params);

    const usage = completion.usage;
    logger.info('AI call', {
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    logger.error('AI service error', { error: err.message });
    throw err;
  }
}

module.exports = { generateSummary, resolveConflict, normalizeLanguage };
