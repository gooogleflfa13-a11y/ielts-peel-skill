import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCommand, runCommandStream } from './orchestrator.js';
import { getMetrics } from './utils/metrics.js';
import { log } from './utils/logger.js';
import { createRateLimiter } from './utils/rateLimit.js';
import { apiError, sseError } from './utils/errors.js';
import { API_VERSION, COMMANDS, MAX_INPUT_CHARS } from './utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers (lightweight; no helmet dependency)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-API-Version', API_VERSION);
  next();
});

// CORS: allowlist via CORS_ORIGINS=comma,separated (default * for local dev)
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : true;
app.use(
  cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

app.use(express.json({ limit: '256kb' }));
app.use('/api/', createRateLimiter({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_MAX || 60) }));

function bankNeedsApiKey(inputStr) {
  return (
    /^\s*\/?bank\s+(peel|answer|答|作答)\b/i.test(inputStr) ||
    (/\bpeel\b/i.test(inputStr) &&
      !/random|search|links|stats|抽题|随机|搜|关联/i.test(inputStr))
  );
}

function validateGenerateBody(req, res) {
  const {
    apiKey,
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4o-mini',
    command = 'peel',
    input = '',
    history = [],
    userId = 'default',
    aiScore = false,
  } = req.body || {};

  if (!COMMANDS.includes(command)) {
    apiError(res, 400, `Invalid command. Use ${COMMANDS.join(' | ')}.`, {
      code: 'INVALID_COMMAND',
    });
    return null;
  }

  const inputStr = String(input || '');
  if (inputStr.length > MAX_INPUT_CHARS) {
    apiError(res, 400, `Input too long (max ${MAX_INPUT_CHARS} chars).`, {
      code: 'INPUT_TOO_LONG',
    });
    return null;
  }

  const needsKey =
    command !== 'score' &&
    !(command === 'bank' && !bankNeedsApiKey(inputStr));

  if (needsKey && (!apiKey || typeof apiKey !== 'string')) {
    apiError(res, 400, 'API Key is required.', { code: 'API_KEY_REQUIRED' });
    return null;
  }

  if (command === 'score' && aiScore && !apiKey) {
    apiError(res, 400, 'API Key is required for AI semantic scoring.', {
      code: 'API_KEY_REQUIRED',
    });
    return null;
  }

  if (!inputStr.trim() && command !== 'wizard' && command !== 'bank') {
    apiError(res, 400, 'Input required.', { code: 'INPUT_REQUIRED' });
    return null;
  }

  return {
    apiKey,
    baseUrl,
    model,
    command,
    input: inputStr,
    history,
    userId,
    aiScore: Boolean(aiScore),
  };
}

app.get('/api/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    agent: 'IELTS PEEL Hacker',
    version: API_VERSION,
    commands: COMMANDS,
    stream: {
      tokenStreamCommands: ['peel'],
      note: 'Other commands accepted on /stream but complete in one shot.',
    },
    dependencies: {
      memoryRssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      uptimeSec: Math.round(process.uptime()),
    },
  });
});

app.get('/api/metrics', (_req, res) => {
  res.json({ version: API_VERSION, ...getMetrics() });
});

/**
 * POST /api/generate
 */
app.post('/api/generate', async (req, res) => {
  const body = validateGenerateBody(req, res);
  if (!body) return;

  try {
    const result = await runCommand(body);
    res.json({ ...result, version: API_VERSION });
  } catch (err) {
    const status = err.status || 500;
    apiError(res, status, err.message || 'Request failed', {
      code: err.code || 'GENERATE_FAILED',
      retryable: Boolean(err.retryable),
    });
  }
});

/**
 * POST /api/generate/stream — SSE
 * Token streaming for peel; bank/score/matrix/wizard complete in one event.
 */
app.post('/api/generate/stream', async (req, res) => {
  const body = validateGenerateBody(req, res);
  if (!body) return;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-API-Version', API_VERSION);
  res.flushHeaders?.();

  try {
    await runCommandStream({
      ...body,
      onChunk: (chunk) => {
        res.write(
          `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`
        );
      },
      onComplete: (result) => {
        res.write(
          `data: ${JSON.stringify({ type: 'complete', version: API_VERSION, ...result })}\n\n`
        );
        res.end();
      },
      onError: (err) => {
        sseError(res, err.message || 'Stream failed', {
          code: err.code || 'STREAM_ERROR',
          retryable: true,
        });
      },
    });
  } catch (err) {
    sseError(res, err.message || 'Stream failed', {
      code: 'STREAM_ERROR',
      retryable: true,
    });
  }
});

/**
 * POST /api/score
 */
app.post('/api/score', async (req, res) => {
  const {
    input = '',
    apiKey,
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4o-mini',
    aiScore = false,
    userId = 'default',
  } = req.body || {};

  if (!String(input).trim()) {
    return apiError(res, 400, 'Input required.', { code: 'INPUT_REQUIRED' });
  }

  try {
    const result = await runCommand({
      command: 'score',
      input: String(input),
      apiKey,
      baseUrl,
      model,
      userId,
      aiScore: Boolean(aiScore),
    });
    res.json({ ...result, version: API_VERSION });
  } catch (err) {
    const status = err.status || 500;
    apiError(res, status, err.message || 'Score failed', {
      code: err.code || 'SCORE_FAILED',
      retryable: Boolean(err.retryable),
    });
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  log('ERROR', 'unhandled.error', { message: err.message });
  apiError(
    res,
    500,
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    { code: 'INTERNAL', retryable: true }
  );
});

// Production: serve Vite build
const distPath = path.join(__dirname, '../client/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err && !res.headersSent) next(err);
    });
  });
}

app.listen(PORT, () => {
  log('INFO', 'server.start', { port: PORT, version: API_VERSION });
  console.log(`IELTS PEEL Hacker server → http://localhost:${PORT}`);
});
