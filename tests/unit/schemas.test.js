import { describe, expect, it } from 'vitest';
import { validatePeelUnit, validatePeelUnits } from '../../server/schemas/peel.js';
import { validateRequest } from '../../server/schemas/request.js';
import { validateResponse } from '../../server/schemas/response.js';

describe('PeelUnit schema', () => {
  it('accepts a complete P/E1/E2/L object', () => {
    const result = validatePeelUnit({
      P: 'Physical schooling builds social competence.',
      E1: 'Daily peer negotiation teaches empathy.',
      E2: 'Students form study groups around whiteboards.',
      L: 'Thus, physical schooling matters.',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-object with a field-level error', () => {
    const result = validatePeelUnit(null);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'PeelUnit', message: expect.any(String) }),
    ]);
  });

  it('reports each missing or empty layer by name', () => {
    const result = validatePeelUnit({ P: '  ', E1: '', E2: 'ok sentence' });
    expect(result.ok).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toEqual(['P', 'E1', 'L']);
    for (const error of result.errors) {
      expect(error.message).toEqual(expect.any(String));
    }
  });

  it('rejects non-string layers with field detail', () => {
    const result = validatePeelUnit({ P: 42, E1: [], E2: {}, L: true });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.field)).toEqual(['P', 'E1', 'E2', 'L']);
  });

  it('validatePeelUnits accepts an array of valid units', () => {
    const result = validatePeelUnits([
      { P: 'a', E1: 'b', E2: 'c', L: 'd' },
      { P: 'e', E1: 'f', E2: 'g', L: 'h' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validatePeelUnits rejects a non-array and reports per-unit errors with indices', () => {
    expect(validatePeelUnits('nope').ok).toBe(false);
    const result = validatePeelUnits([
      { P: 'a', E1: 'b', E2: 'c', L: 'd' },
      { P: '', E1: 'b', E2: 'c', L: 'd' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: '[1].P' }),
    ]);
  });
});

describe('Request schema', () => {
  it('validates a well-formed peel request and normalizes optional fields', () => {
    const result = validateRequest('peel', {
      input: 'online education',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      history: [{ role: 'user', content: 'hi' }],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual(
      expect.objectContaining({
        command: 'peel',
        input: 'online education',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        userId: 'default',
        history: [{ role: 'user', content: 'hi' }],
        aiScore: false,
      })
    );
  });

  it('rejects an unknown command with field detail', () => {
    const result = validateRequest('explode', { input: 'x', apiKey: 'k' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.issues).toBe(result.errors);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'command' }),
    ]);
  });

  it('rejects non-string input instead of coercing it', () => {
    const result = validateRequest('peel', { input: 42, apiKey: 'k' });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'INVALID_REQUEST',
        issues: [expect.objectContaining({ field: 'input' })],
      })
    );
  });

  it('requires a non-empty input for peel, matrix, and score', () => {
    for (const command of ['peel', 'matrix', 'score']) {
      const result = validateRequest(command, { input: '   ', apiKey: 'k' });
      expect(result.ok, command).toBe(false);
      expect(result.errors).toEqual([
        expect.objectContaining({ field: 'input' }),
      ]);
    }
  });

  it('allows an empty input for wizard and bank', () => {
    expect(validateRequest('wizard', { input: '', apiKey: 'k' }).ok).toBe(true);
    expect(validateRequest('bank', { input: '', apiKey: 'k' }).ok).toBe(true);
  });

  it('rejects input that exceeds the max length', () => {
    const result = validateRequest('peel', {
      input: 'x'.repeat(5001),
      apiKey: 'k',
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'input' }),
    ]);
  });

  it('rejects an invalid history entry with field detail', () => {
    const result = validateRequest('peel', {
      input: 'online education',
      apiKey: 'k',
      history: [{ role: 'system', content: 'nope' }, { role: 'user', content: 42 }],
    });
    expect(result.ok).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain('history[0]');
    expect(fields).toContain('history[1]');
  });

  it('coerces missing history to an empty array and missing userId to default', () => {
    const result = validateRequest('peel', { input: 'x', apiKey: 'k' });
    expect(result.ok).toBe(true);
    expect(result.value.history).toEqual([]);
    expect(result.value.userId).toBe('default');
  });

  it('rejects forbidden provider and aiScore fields', () => {
    const result = validateRequest('peel', {
      input: 'x',
      apiKey: 'k',
      baseUrl: 'https://attacker.example/v1',
      aiScore: true,
    });
    expect(result.ok).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain('baseUrl');
    expect(fields).toContain('aiScore');
  });

  it('score does not require an api key', () => {
    const result = validateRequest('score', { input: '[P] a [E1] b [E2] c [L] d' });
    expect(result.ok).toBe(true);
    expect(result.value.apiKey).toBeUndefined();
  });

  it('rejects a non-string api key when a key is required', () => {
    const result = validateRequest('peel', { input: 'x', apiKey: 123 });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'apiKey' }),
    ]);
  });

  it('rejects a non-object body with a single error', () => {
    const result = validateRequest('peel', null);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.issues).toBe(result.errors);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'body' }),
    ]);
  });
});

describe('Response schema', () => {
  it('validates a successful peel response with all contract fields', () => {
    const result = validateResponse('peel', {
      status: 'success',
      content: '[P] x',
      parsed: { peels: [] },
      validation: { passed: true },
      topic: { id: 'Education' },
      entities: [],
      retries: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates a quality_failed response (content may be null)', () => {
    const result = validateResponse('peel', {
      status: 'quality_failed',
      content: null,
      parsed: { peels: [] },
      validation: { passed: false },
      topic: null,
      entities: [],
      retries: 1,
    });
    expect(result.ok).toBe(true);
  });

  it('reports every missing contract field by name for peel', () => {
    const result = validateResponse('peel', { status: 'success' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_RESPONSE');
    expect(result.issues).toBe(result.errors);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(['content', 'parsed', 'validation', 'topic', 'entities', 'retries'])
    );
  });

  it('accepts a score response (feedback field, no retries required)', () => {
    const result = validateResponse('score', {
      status: 'success',
      content: 'x',
      parsed: { peels: [] },
      validation: { passed: true },
      feedback: { issues: [] },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown status value with field detail', () => {
    const result = validateResponse('peel', { status: 'wat', content: 'x', parsed: {}, validation: {}, topic: null, entities: [], retries: 0 });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'status' }),
    ]);
  });

  it('rejects a non-object result with a single error', () => {
    const result = validateResponse('peel', 'nope');
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'result' }),
    ]);
  });

  it('validates a bank response that carries the bank payload', () => {
    const result = validateResponse('bank', {
      status: 'success',
      content: 'x',
      parsed: { peels: [] },
      bank: { mode: 'stats' },
      topic: null,
      retries: 0,
    });
    expect(result.ok).toBe(true);
  });

  it('validateResponse returns ok for an unknown command defensively', () => {
    const result = validateResponse('nope', { status: 'success' });
    expect(result.ok).toBe(true);
  });
});
