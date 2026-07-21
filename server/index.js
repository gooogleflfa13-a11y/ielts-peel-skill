import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCommand, runCommandStream } from './orchestrator.js';
import { getMetrics } from './utils/metrics.js';
import { log } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    agent: 'IELTS PEEL Hacker',
    version: '2.0.0-evolution',
    commands: ['peel', 'matrix', 'wizard', 'score'],
  });
});

app.get('/api/metrics', (_req, res) => {
  res.json(getMetrics());
});

/**
 * POST /api/generate
 * Body: { apiKey, baseUrl?, model?, command, input, history?, userId?, aiScore? }
 */
app.post('/api/generate', async (req, res) => {
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

  if (!['peel', 'matrix', 'wizard', 'score'].includes(command)) {
    return res
      .status(400)
      .json({ error: 'Invalid command. Use peel | matrix | wizard | score.' });
  }

  // score can run without API key (programmatic only)
  if (command !== 'score' && (!apiKey || typeof apiKey !== 'string')) {
    return res.status(400).json({ error: 'API Key is required.' });
  }

  if (command === 'score' && aiScore && !apiKey) {
    return res
      .status(400)
      .json({ error: 'API Key is required for AI semantic scoring.' });
  }

  if (!String(input || '').trim() && command !== 'wizard') {
    return res.status(400).json({ error: 'Input required.' });
  }

  try {
    const result = await runCommand({
      command,
      input: String(input || ''),
      history,
      apiKey,
      baseUrl,
      model,
      userId,
      aiScore: Boolean(aiScore),
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Request failed' });
  }
});

/**
 * POST /api/generate/stream — Server-Sent Events streaming
 * Query: ?stream=true
 * Body: same as /api/generate
 */
app.post('/api/generate/stream', async (req, res) => {
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

  if (!['peel', 'matrix', 'wizard', 'score'].includes(command)) {
    return res
      .status(400)
      .json({ error: 'Invalid command. Use peel | matrix | wizard | score.' });
  }

  if (command !== 'score' && (!apiKey || typeof apiKey !== 'string')) {
    return res.status(400).json({ error: 'API Key is required.' });
  }

  if (command === 'score' && aiScore && !apiKey) {
    return res
      .status(400)
      .json({ error: 'API Key is required for AI semantic scoring.' });
  }

  if (!String(input || '').trim() && command !== 'wizard') {
    return res.status(400).json({ error: 'Input required.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    await runCommandStream({
      command,
      input: String(input || ''),
      history,
      apiKey,
      baseUrl,
      model,
      userId,
      aiScore: Boolean(aiScore),
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      onComplete: (result) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
        res.end();
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
      },
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/score — dedicated score endpoint (alias)
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
    return res.status(400).json({ error: 'Input required.' });
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
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Score failed' });
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  log('ERROR', 'unhandled.error', { message: err.message });
  res.status(500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
});

// Production: serve Vite build
const distPath = path.join(__dirname, '../client/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

app.listen(PORT, () => {
  log('INFO', 'server.start', { port: PORT });
  console.log(`IELTS PEEL Hacker server → http://localhost:${PORT}`);
});
