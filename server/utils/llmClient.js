import OpenAI from 'openai';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

function buildClient(apiKey, baseUrl) {
  return new OpenAI({
    apiKey,
    baseURL: (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
  });
}

function buildMessages({ system, user, history = [], messages }) {
  if (Array.isArray(messages) && messages.length) return messages;
  return [
    { role: 'system', content: system },
    ...history
      .filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string'
      )
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: user },
  ];
}

/**
 * Unified LLM call with retries for 5xx/network errors.
 */
export async function callLLM({
  apiKey,
  baseUrl,
  model,
  system,
  user,
  history = [],
  messages,
  temperature = 0.3,
  maxTokens = 2500,
}) {
  const client = buildClient(apiKey, baseUrl);
  const msgs = buildMessages({ system, user, history, messages });

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: msgs,
        temperature,
        max_tokens: maxTokens,
      });

      const content = completion.choices?.[0]?.message?.content || '';
      const usage = completion.usage || null;
      return { content, usage, ok: true };
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.response?.status || 500;
      if (status >= 400 && status < 500) break;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('LLM request failed after retries');
}

export function handleLLMError(err) {
  const status = err?.status || err?.response?.status;
  if (status === 429) return 'API rate limit reached. Wait 30 seconds and retry.';
  if (status === 401 || status === 403) return 'Invalid API key. Check your credentials.';
  if (status === 503)
    return 'LLM provider is temporarily unavailable. Try again in a few minutes.';
  return err?.error?.message || err?.message || 'LLM request failed';
}

/**
 * Streaming variant — async generator of text deltas.
 * Accepts either { system, user, history } or prebuilt { messages }.
 */
export async function* streamLLM({
  apiKey,
  baseUrl,
  model,
  system,
  user,
  history = [],
  messages,
  temperature = 0.3,
  maxTokens = 2500,
}) {
  const client = buildClient(apiKey, baseUrl);
  const msgs = buildMessages({ system, user, history, messages });

  const stream = await client.chat.completions.create({
    model,
    messages: msgs,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** Alias used by orchestrator stream path */
export const callLLMStream = streamLLM;
