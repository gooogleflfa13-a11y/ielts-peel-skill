import OpenAI from 'openai';
import { loadConfig } from '../config.js';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

function defaultClientFactory(options) {
  return new OpenAI(options);
}

function resolveRuntime(runtime) {
  if (runtime) return runtime;

  const config = loadConfig(process.env);
  return {
    baseUrl: config.providerBaseUrl,
    timeoutMs: config.upstreamTimeoutMs,
  };
}

function buildClient(apiKey, runtime) {
  const createClient = runtime.createClient || defaultClientFactory;
  return createClient({
    apiKey,
    baseURL: runtime.baseUrl.replace(/\/$/, ''),
    maxRetries: 0,
  });
}

function buildMessages({ system, user, history = [], messages }) {
  if (Array.isArray(messages) && messages.length) return messages;
  return [
    { role: 'system', content: system },
    ...history
      .filter(
        (message) =>
          message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
      )
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.content })),
    { role: 'user', content: user },
  ];
}

function createDeadline(runtime) {
  const controller = new AbortController();
  const timeoutError = Object.assign(new Error('Upstream request timed out'), {
    status: 504,
    code: 'UPSTREAM_TIMEOUT',
    retryable: true,
  });
  const timeout = setTimeout(() => controller.abort(timeoutError), runtime.timeoutMs);
  timeout.unref?.();

  const onExternalAbort = () => controller.abort(runtime.signal.reason);
  if (runtime.signal?.aborted) onExternalAbort();
  else runtime.signal?.addEventListener('abort', onExternalAbort, { once: true });

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      runtime.signal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

function isRetryable(error) {
  const status = error?.status || error?.response?.status;
  return status == null || status >= 500;
}

function abortableDelay(ms, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(done, ms);
    const onAbort = () => done(signal.reason);

    function done(error) {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function requestBody(options, stream = false) {
  return {
    model: options.model,
    messages: buildMessages(options),
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2500,
    ...(stream ? { stream: true } : {}),
  };
}

export async function callLLM(options, suppliedRuntime) {
  const runtime = resolveRuntime(suppliedRuntime);
  const deadline = createDeadline(runtime);
  const client = buildClient(options.apiKey, runtime);
  let lastError;

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const completion = await client.chat.completions.create(requestBody(options), {
          signal: deadline.signal,
        });
        return {
          content: completion.choices?.[0]?.message?.content || '',
          usage: completion.usage || null,
          ok: true,
        };
      } catch (error) {
        if (deadline.signal.aborted) throw deadline.signal.reason;
        lastError = error;
        if (!isRetryable(error) || attempt === MAX_RETRIES) break;
        await abortableDelay(BASE_DELAY_MS * (attempt + 1), deadline.signal);
      }
    }
  } finally {
    deadline.dispose();
  }

  throw lastError || new Error('LLM request failed after retries');
}

export async function* streamLLM(options, suppliedRuntime) {
  const runtime = resolveRuntime(suppliedRuntime);
  const deadline = createDeadline(runtime);
  const client = buildClient(options.apiKey, runtime);
  let lastError;
  let hasEmittedChunk = false;

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const stream = await client.chat.completions.create(requestBody(options, true), {
          signal: deadline.signal,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            hasEmittedChunk = true;
            yield delta;
          }
        }
        return;
      } catch (error) {
        if (deadline.signal.aborted) throw deadline.signal.reason;
        lastError = error;
        if (hasEmittedChunk || !isRetryable(error) || attempt === MAX_RETRIES) break;
        await abortableDelay(BASE_DELAY_MS * (attempt + 1), deadline.signal);
      }
    }
  } finally {
    deadline.dispose();
  }

  throw lastError || new Error('LLM stream failed after retries');
}

export function handleLLMError(error) {
  const status = error?.status || error?.response?.status;
  if (status === 429) return 'API rate limit reached. Wait 30 seconds and retry.';
  if (status === 401 || status === 403) return 'Invalid API key. Check your credentials.';
  if (status === 503) {
    return 'LLM provider is temporarily unavailable. Try again in a few minutes.';
  }
  return error?.error?.message || error?.message || 'LLM request failed';
}

export const callLLMStream = streamLLM;
