const { detectTrigger, extractContribution, detectLanguage } = require('../src/triggers');

describe('Trigger Engine', () => {
  describe('detectTrigger', () => {
    test('detects "start huddle" keyword', () => {
      const result = detectTrigger('start huddle');
      expect(result).toEqual({ name: 'start_huddle', action: 'START_HUDDLE' });
    });

    test('detects "anza huddle" (Swahili)', () => {
      const result = detectTrigger('anza huddle sasa');
      expect(result).toEqual({ name: 'start_huddle', action: 'START_HUDDLE' });
    });

    test('detects "close" keyword', () => {
      const result = detectTrigger('close huddle');
      expect(result).toEqual({ name: 'close_huddle', action: 'CLOSE_HUDDLE' });
    });

    test('detects "funga" (Swahili close)', () => {
      const result = detectTrigger('funga huddle');
      expect(result).toEqual({ name: 'close_huddle', action: 'CLOSE_HUDDLE' });
    });

    test('detects "summary" keyword', () => {
      const result = detectTrigger('summary');
      expect(result).toEqual({ name: 'summarize', action: 'SUMMARIZE' });
    });

    test('detects "muhtasari" (Swahili summary)', () => {
      const result = detectTrigger('muhtasari');
      expect(result).toEqual({ name: 'summarize', action: 'SUMMARIZE' });
    });

    test('detects "I will" task assignment', () => {
      const result = detectTrigger('I will bring the chairs');
      expect(result).toEqual({ name: 'assign_task', action: 'ASSIGN_TASK' });
    });

    test('detects "nitafanya" (Swahili task)', () => {
      const result = detectTrigger('nitafanya kazi hiyo');
      expect(result).toEqual({ name: 'assign_task', action: 'ASSIGN_TASK' });
    });

    test('detects "niko tayari" (Swahili ready)', () => {
      const result = detectTrigger('niko tayari kusaidia');
      expect(result).toEqual({ name: 'assign_task', action: 'ASSIGN_TASK' });
    });

    test('detects contribution amounts', () => {
      const result = detectTrigger('5000 TZS');
      expect(result).not.toBeNull();
      expect(result.name).toBe('track_contribution');
      expect(result.action).toBe('TRACK_CONTRIBUTION');
      expect(result.data.amount).toBe(5000);
    });

    test('detects contribution with k multiplier', () => {
      const result = detectTrigger('5k TZS');
      expect(result).not.toBeNull();
      expect(result.data.amount).toBe(5000);
    });

    test('returns null for unrecognized messages', () => {
      const result = detectTrigger('hello everyone');
      expect(result).toBeNull();
    });

    test('returns null for empty input', () => {
      expect(detectTrigger('')).toBeNull();
      expect(detectTrigger(null)).toBeNull();
      expect(detectTrigger(undefined)).toBeNull();
    });

    test('is case-insensitive', () => {
      expect(detectTrigger('START HUDDLE')).toEqual({ name: 'start_huddle', action: 'START_HUDDLE' });
      expect(detectTrigger('Summary')).toEqual({ name: 'summarize', action: 'SUMMARIZE' });
    });
  });

  describe('extractContribution', () => {
    test('extracts plain number', () => {
      const result = extractContribution('5000');
      expect(result).toEqual({ amount: 5000, raw: '5000' });
    });

    test('extracts number with TZS', () => {
      const result = extractContribution('10000 TZS');
      expect(result.amount).toBe(10000);
    });

    test('extracts number with tsh', () => {
      const result = extractContribution('20000 tsh');
      expect(result.amount).toBe(20000);
    });

    test('extracts k multiplier', () => {
      const result = extractContribution('5k TZS');
      expect(result.amount).toBe(5000);
    });

    test('extracts comma-separated numbers', () => {
      const result = extractContribution('50,000 TZS');
      expect(result.amount).toBe(50000);
    });

    test('rejects zero amounts', () => {
      expect(extractContribution('0 TZS')).toBeNull();
    });

    test('rejects unreasonably large amounts', () => {
      expect(extractContribution('999999999 TZS')).toBeNull();
    });

    test('returns null for no numbers', () => {
      expect(extractContribution('hello')).toBeNull();
      expect(extractContribution(null)).toBeNull();
    });
  });

  describe('detectLanguage', () => {
    test('detects English', () => {
      expect(detectLanguage('I will bring the food')).toBe('en');
    });

    test('detects Swahili', () => {
      expect(detectLanguage('Sawa nitafanya kazi hiyo asante')).toBe('sw');
    });

    test('detects Swahili with multiple markers', () => {
      expect(detectLanguage('Habari, niko tayari kusaidia')).toBe('sw');
    });

    test('defaults to English for empty input', () => {
      expect(detectLanguage('')).toBe('en');
      expect(detectLanguage(null)).toBe('en');
    });

    test('defaults to English for ambiguous text', () => {
      expect(detectLanguage('ok')).toBe('en');
    });
  });
});
