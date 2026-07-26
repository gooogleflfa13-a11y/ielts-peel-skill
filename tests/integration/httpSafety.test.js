import { describe, expect, it, vi } from 'vitest';
import { request as httpRequest, ServerResponse } from 'node:http';
import request from 'supertest';
import { createApp } from '../../server/app.js';

function config(overrides = {}) {
  return {
    appMode: 'public',
    providerBaseUrl: 'https://api.openai.com/v1',
    upstreamTimeoutMs: 30_000,
    corsOrigins: ['https://app.example.com'],
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

describe('HTTP safety', () => {
  it('rejects request-controlled baseUrl before command execution', async () => {
    const runCommand = vi.fn();
    const response = await request(app({ runCommand }))
      .post('/api/generate')
      .send({
        command: 'peel',
        input: 'question',
        apiKey: 'sk-test',
        baseUrl: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PROVIDER_URL_NOT_ALLOWED');
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('rejects aiScore=true', async () => {
    const runCommand = vi.fn();
    const response = await request(app({ runCommand }))
      .post('/api/score')
      .send({ input: '[P] text', aiScore: true });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('AI_SCORE_DISABLED');
    expect(runCommand).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('rejects an empty API key before command execution', async (apiKey) => {
    const runCommand = vi.fn();
    const response = await request(app({ runCommand }))
      .post('/api/generate')
      .send({ command: 'peel', input: 'question', apiKey });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('maps malformed JSON to INVALID_REQUEST', async () => {
    const response = await request(app())
      .post('/api/generate')
      .set('Content-Type', 'application/json')
      .send('{"input":');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_REQUEST');
  });

  it('rejects denied CORS origins', async () => {
    const response = await request(app())
      .get('/api/health')
      .set('Origin', 'https://evil.example.com');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CORS_FORBIDDEN');
  });

  it('does not trust spoofed X-Forwarded-For by default', async () => {
    const server = app();
    let response;

    for (let index = 0; index <= 60; index += 1) {
      response = await request(server)
        .get('/api/health')
        .set('X-Forwarded-For', `198.51.100.${index}`);
    }

    expect(response.status).toBe(429);
    expect(response.body.code).toBe('RATE_LIMITED');
  });

  it('returns Retry-After when rate limited', async () => {
    const server = app();
    let response;

    for (let index = 0; index <= 60; index += 1) {
      response = await request(server).get('/api/health');
    }

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toMatch(/^\d+$/);
  });

  it('hides metrics when no token exists', async () => {
    const response = await request(app()).get('/api/metrics');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({});
  });

  it('requires exact bearer token for metrics', async () => {
    const server = app({ config: { metricsToken: 'metrics-secret' } });

    const missing = await request(server).get('/api/metrics');
    const incorrect = await request(server)
      .get('/api/metrics')
      .set('Authorization', 'Bearer metrics-secret-extra');
    const correct = await request(server)
      .get('/api/metrics')
      .set('Authorization', 'Bearer metrics-secret');

    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(incorrect.body.code).toBe('METRICS_UNAUTHORIZED');
    expect(correct.status).toBe(200);
    expect(correct.body.requests).toBe(1);
  });

  it('normalizes command failures without exposing details', async () => {
    const response = await request(
      app({
        runCommand: vi
          .fn()
          .mockRejectedValue(new Error('sk-secret at http://internal:9000')),
      })
    )
      .post('/api/generate')
      .send({ command: 'peel', input: 'question', apiKey: 'sk-test' });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL');
    expect(JSON.stringify(response.body)).not.toContain('sk-secret');
    expect(JSON.stringify(response.body)).not.toContain('internal:9000');
  });

  it('cleans up disconnect handling before a successful stream closes', async () => {
    let providerSignal;
    const runCommandStream = vi.fn(async ({ signal, onComplete }) => {
      providerSignal = signal;
      onComplete({ ok: true, content: 'complete' });
    });

    const response = await request(app({ runCommandStream }))
      .post('/api/generate/stream')
      .send({ command: 'peel', input: 'question', apiKey: 'sk-test' });

    expect(response.status).toBe(200);
    expect(providerSignal).toBeInstanceOf(AbortSignal);
    expect(providerSignal.aborted).toBe(false);
  });

  it('injects memory, bank policy, and provider runtime into sync execution', async () => {
    const memoryStore = { getRelevantFuel: vi.fn() };
    const runCommand = vi.fn().mockResolvedValue({ ok: true });
    const server = createApp({
      config: config({
        appMode: 'local',
        providerBaseUrl: 'https://trusted.example/v1',
        upstreamTimeoutMs: 1234,
        enablePrivateQuestionBank: true,
      }),
      memoryStore,
      runCommand,
      runCommandStream: vi.fn(),
      getMetrics: vi.fn(() => ({})),
    });

    await request(server)
      .post('/api/generate')
      .send({ command: 'peel', input: 'question', apiKey: 'sk-test' })
      .expect(200);

    expect(runCommand).toHaveBeenCalledWith(
      expect.objectContaining({ memoryStore }),
      {
        enablePrivateQuestionBank: true,
        llmRuntime: {
          baseUrl: 'https://trusted.example/v1',
          timeoutMs: 1234,
        },
      }
    );
  });

  it('defaults public execution to null memory and a disabled bank', async () => {
    const runCommand = vi.fn().mockResolvedValue({ ok: true });

    await request(app({ runCommand }))
      .post('/api/generate')
      .send({ command: 'peel', input: 'question', apiKey: 'sk-test' })
      .expect(200);

    const [requestOptions, executionOptions] = runCommand.mock.calls[0];
    await requestOptions.memoryStore.addE2Fuel(
      { userId: 'public-user' },
      { sourceAnswer: 'private' }
    );
    expect(
      await requestOptions.memoryStore.getRelevantFuel(
        { userId: 'public-user' },
        'Education'
      )
    ).toEqual([]);
    expect(executionOptions.enablePrivateQuestionBank).toBe(false);
  });

  it('injects memory, bank policy, provider runtime, and abort signal into streaming', async () => {
    const memoryStore = { getRelevantFuel: vi.fn() };
    const runCommandStream = vi.fn(async ({ onComplete }) => {
      onComplete({ ok: true, content: 'complete' });
    });
    const server = createApp({
      config: config({ appMode: 'local', enablePrivateQuestionBank: true }),
      memoryStore,
      runCommand: vi.fn(),
      runCommandStream,
      getMetrics: vi.fn(() => ({})),
    });

    await request(server)
      .post('/api/generate/stream')
      .send({ command: 'peel', input: 'question', apiKey: 'sk-test' })
      .expect(200);

    expect(runCommandStream).toHaveBeenCalledWith(
      expect.objectContaining({ memoryStore, signal: expect.any(AbortSignal) }),
      {
        enablePrivateQuestionBank: true,
        llmRuntime: {
          baseUrl: 'https://api.openai.com/v1',
          timeoutMs: 30_000,
        },
      }
    );
  });

  it('omits bank from health unless it is explicitly enabled locally', async () => {
    const disabled = await request(app()).get('/api/health');
    const enabled = await request(
      app({ config: { appMode: 'local', enablePrivateQuestionBank: true } })
    ).get('/api/health');

    expect(disabled.body.commands).not.toContain('bank');
    expect(enabled.body.commands).toContain('bank');
  });

  it('maps a sync quality failure to 422 QUALITY_FAILED', async () => {
    const response = await request(
      app({
        runCommand: vi.fn().mockResolvedValue({
          ok: false,
          status: 'quality_failed',
          code: 'QUALITY_FAILED',
        }),
      })
    )
      .post('/api/generate')
      .send({ command: 'peel', input: 'question', apiKey: 'sk-test' });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('QUALITY_FAILED');
  });

  it('aborts stream execution and suppresses late writes after disconnect', async () => {
    let providerSignal;
    const lateWrites = [];
    const originalWrite = ServerResponse.prototype.write;
    const writeSpy = vi
      .spyOn(ServerResponse.prototype, 'write')
      .mockImplementation(function (...args) {
        if (this.destroyed || this.closed) lateWrites.push(args);
        return originalWrite.apply(this, args);
      });
    const runCommandStream = vi.fn(
      ({ signal, onChunk, onComplete }) =>
        new Promise((resolve) => {
          providerSignal = signal;
          signal.addEventListener(
            'abort',
            () => {
              onChunk('late');
              onComplete({ ok: true, content: 'late' });
              resolve();
            },
            { once: true }
          );
        })
    );
    const server = app({ runCommandStream }).listen(0);

    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const port = server.address().port;
      const client = httpRequest({
        method: 'POST',
        port,
        path: '/api/generate/stream',
        headers: { 'content-type': 'application/json' },
      });
      client.on('response', (response) => response.destroy());
      client.on('error', () => {});
      client.end(JSON.stringify({ command: 'peel', input: 'question', apiKey: 'sk-test' }));

      await vi.waitFor(() => expect(providerSignal?.aborted).toBe(true));
      await vi.waitFor(() => expect(runCommandStream).toHaveResolved());
      expect(lateWrites).toEqual([]);
    } finally {
      writeSpy.mockRestore();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
