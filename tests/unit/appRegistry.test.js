import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { COMMAND_NAMES, lookup } from '../../server/commands/registry.js';

function config(overrides = {}) {
  return {
    appMode: 'public',
    providerBaseUrl: 'https://api.openai.com/v1',
    upstreamTimeoutMs: 30_000,
    corsOrigins: [],
    trustProxyHops: 0,
    metricsToken: null,
    enableLocalMemory: false,
    enablePrivateQuestionBank: false,
    ...overrides,
  };
}

function app(overrides = {}) {
  return createApp({
    config: config(overrides.config),
    runCommand: overrides.runCommand || vi.fn().mockResolvedValue({ ok: true }),
    runCommandStream: overrides.runCommandStream || vi.fn(),
    getMetrics: overrides.getMetrics || vi.fn(() => ({ requests: 1 })),
  });
}

describe('app derives command list from registry', () => {
  it('health endpoint returns exactly the registry command names (public mode filters bank)', async () => {
    const response = await request(app()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.commands).toEqual(
      COMMAND_NAMES.filter((c) => c !== 'bank')
    );
  });

  it('health endpoint includes bank when enablePrivateQuestionBank is true', async () => {
    const response = await request(
      app({ config: { appMode: 'local', enablePrivateQuestionBank: true } })
    ).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.commands).toEqual(COMMAND_NAMES);
  });
});

describe('app derives command validity from registry', () => {
  it('rejects a command not in the registry', async () => {
    const runCommand = vi.fn();
    const response = await request(app({ runCommand }))
      .post('/api/generate')
      .send({ command: 'unknown', input: 'question', apiKey: 'sk-test' });
    expect(response.status).toBe(400);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('accepts every command defined in the registry', async () => {
    for (const name of COMMAND_NAMES) {
      const runCommand = vi.fn().mockResolvedValue({ ok: true });
      const body = { command: name, input: 'question' };
      if (lookup(name).requiresApiKey) body.apiKey = 'sk-test';
      if (name === 'bank') body.input = 'random';
      const response = await request(app({ runCommand }))
        .post('/api/generate')
        .send(body);
      expect(response.status).toBe(200);
    }
  });
});

describe('app derives apiKey requirement from registry', () => {
  it('score does not require an api key (requiresApiKey=false)', async () => {
    const runCommand = vi.fn().mockResolvedValue({ ok: true });
    const response = await request(app({ runCommand }))
      .post('/api/score')
      .send({ input: '[P] text' });
    expect(response.status).toBe(200);
    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  it('peel requires an api key (requiresApiKey=true)', async () => {
    const runCommand = vi.fn();
    const response = await request(app({ runCommand }))
      .post('/api/generate')
      .send({ command: 'peel', input: 'question' });
    expect(response.status).toBe(400);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('bank random does not require an api key despite requiresApiKey=true', async () => {
    const runCommand = vi.fn().mockResolvedValue({ ok: true });
    const response = await request(app({ runCommand }))
      .post('/api/generate')
      .send({ command: 'bank', input: 'random' });
    expect(response.status).toBe(200);
  });
});
