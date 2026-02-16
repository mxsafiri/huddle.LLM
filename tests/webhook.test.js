const request = require('supertest');

jest.mock('../src/services/whatsapp', () => ({
  sendMessage: jest.fn().mockResolvedValue({}),
  sendGroupMessage: jest.fn().mockResolvedValue({}),
  parseWebhookMessage: jest.requireActual('../src/services/whatsapp').parseWebhookMessage,
}));

jest.mock('../src/services/memory', () => ({
  createSession: jest.fn().mockResolvedValue({ id: 'test-id', group_id: 'g1', language: 'en', status: 'active' }),
  getActiveSession: jest.fn().mockResolvedValue(null),
  getSessionWithContributors: jest.fn().mockResolvedValue({ status: 'active', contributors: [], totalAmount: 0 }),
  addContribution: jest.fn().mockResolvedValue({}),
  closeSession: jest.fn().mockResolvedValue({}),
  cleanupExpiredSessions: jest.fn().mockResolvedValue({ expired: 0, deleted: 0 }),
  updateSessionLanguage: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/ai', () => ({
  generateSummary: jest.fn().mockResolvedValue('Test summary'),
  resolveConflict: jest.fn().mockResolvedValue('Resolved'),
  normalizeLanguage: jest.fn().mockResolvedValue({ language: 'en', intent: 'test', normalized: 'test' }),
}));

jest.mock('../src/db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  healthCheck: jest.fn().mockResolvedValue(true),
  pool: { on: jest.fn(), end: jest.fn() },
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

const app = require('../src/index');

function buildWebhookPayload(text, from = '255700000000') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550000000', phone_number_id: '123' },
              contacts: [{ profile: { name: 'Test User' }, wa_id: from }],
              messages: [
                {
                  from,
                  id: 'msg_001',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: text },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

describe('Webhook Endpoint', () => {
  describe('GET /webhook (verification)', () => {
    test('verifies with correct token', async () => {
      const res = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token_here',
          'hub.challenge': 'challenge_code',
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('challenge_code');
    });

    test('rejects invalid token', async () => {
      const res = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_code',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /webhook (message handling)', () => {
    test('returns 200 for valid webhook payload', async () => {
      const res = await request(app)
        .post('/webhook')
        .send(buildWebhookPayload('hello'))
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
    });

    test('returns 200 for empty payload', async () => {
      const res = await request(app)
        .post('/webhook')
        .send({ object: 'whatsapp_business_account', entry: [] })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
    });

    test('handles "start huddle" message', async () => {
      const res = await request(app)
        .post('/webhook')
        .send(buildWebhookPayload('start huddle'))
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /health', () => {
    test('returns health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('database', 'connected');
      expect(res.body).toHaveProperty('uptime');
    });
  });
});
