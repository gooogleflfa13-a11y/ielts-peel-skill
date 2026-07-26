import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callLLM, streamLLM } from '../../server/utils/llmClient.js';

const options = {
  apiKey: 'sk-test',
  baseUrl: 'http://127.0.0.1:1/v1',
  model: 'test-model',
  system: 'system',
  user: 'user',
};

describe('LLM provider boundary', () => {
  let create;
  let createClient;

  beforeEach(() => {
    create = vi.fn();
    createClient = vi.fn(() => ({ chat: { completions: { create } } }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses only the runtime provider URL', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'answer' } }],
      usage: { total_tokens: 1 },
    });

    await callLLM(options, {
      baseUrl: 'https://trusted.example/v1',
      timeoutMs: 1_000,
      createClient,
    });

    expect(createClient).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      baseURL: 'https://trusted.example/v1',
      maxRetries: 0,
    });
    expect(JSON.stringify(createClient.mock.calls)).not.toContain('127.0.0.1');
  });

  it('links external cancellation to the provider request', async () => {
    let providerSignal;
    create.mockImplementation((_body, requestOptions) => {
      providerSignal = requestOptions.signal;
      return new Promise((_resolve, reject) => {
        providerSignal.addEventListener('abort', () => reject(providerSignal.reason), {
          once: true,
        });
      });
    });
    const controller = new AbortController();
    const reason = new Error('request disconnected');

    const pending = callLLM(options, {
      baseUrl: 'https://trusted.example/v1',
      timeoutMs: 1_000,
      signal: controller.signal,
      createClient,
    });
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(providerSignal.aborted).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('maps the logical deadline to UPSTREAM_TIMEOUT', async () => {
    create.mockImplementation((_body, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      })
    );

    await expect(
      callLLM(options, {
        baseUrl: 'https://trusted.example/v1',
        timeoutMs: 10,
        createClient,
      })
    ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries a stream only before its first emitted chunk', async () => {
    create
      .mockRejectedValueOnce(Object.assign(new Error('temporary'), { status: 503 }))
      .mockResolvedValueOnce(
        (async function* () {
          yield { choices: [{ delta: { content: 'final' } }] };
        })()
      );

    const retryingStream = streamLLM(options, {
      baseUrl: 'https://trusted.example/v1',
      timeoutMs: 5_000,
      createClient,
    });
    const firstChunk = retryingStream.next();

    await expect(firstChunk).resolves.toEqual({ value: 'final', done: false });
    expect(create).toHaveBeenCalledTimes(2);

    create.mockReset();
    create.mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: 'visible' } }] };
        throw Object.assign(new Error('stream failed'), { status: 503 });
      })()
    );

    const emittedStream = streamLLM(options, {
      baseUrl: 'https://trusted.example/v1',
      timeoutMs: 5_000,
      createClient,
    });
    await expect(emittedStream.next()).resolves.toEqual({
      value: 'visible',
      done: false,
    });
    await expect(emittedStream.next()).rejects.toThrow('stream failed');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
