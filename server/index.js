import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './systemPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const COMMAND_PREFIX = {
  peel: '/peel',
  matrix: '/matrix',
  wizard: '/wizard',
};

function buildUserMessage(command, input) {
  const prefix = COMMAND_PREFIX[command] || '/peel';
  const trimmed = (input || '').trim();
  if (!trimmed) return `${prefix}`;
  // Avoid double-prefix if user already typed the command
  if (trimmed.startsWith('/peel') || trimmed.startsWith('/matrix') || trimmed.startsWith('/wizard')) {
    return trimmed;
  }
  return `${prefix} ${trimmed}`;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    agent: 'IELTS PEEL Hacker',
    commands: ['peel', 'matrix', 'wizard'],
  });
});

/**
 * POST /api/generate
 * Body: { apiKey, baseUrl?, model?, command, input, history? }
 */
app.post('/api/generate', async (req, res) => {
  const {
    apiKey,
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4o-mini',
    command = 'peel',
    input = '',
    history = [],
  } = req.body || {};

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API Key is required.' });
  }

  if (!['peel', 'matrix', 'wizard'].includes(command)) {
    return res.status(400).json({ error: 'Invalid command. Use peel | matrix | wizard.' });
  }

  const userContent = buildUserMessage(command, input);
  if (!userContent.replace(/^\/(peel|matrix|wizard)\s*/, '').trim() && history.length === 0) {
    // wizard first turn may only send empty with bank; still allow short
    if (command !== 'wizard') {
      return res.status(400).json({ error: 'Input required.' });
    }
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl.replace(/\/$/, ''),
    });

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...normalizeHistory(history),
      { role: 'user', content: userContent || '/wizard' },
    ];

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.55,
      max_tokens: 2500,
    });

    const content = completion.choices?.[0]?.message?.content || '';
    const usage = completion.usage || null;

    res.json({
      ok: true,
      command,
      model,
      content,
      usage,
      parsed: parsePeelOutput(content),
    });
  } catch (err) {
    const status = err?.status || err?.response?.status || 500;
    const message =
      err?.error?.message ||
      err?.message ||
      'Upstream LLM request failed.';
    console.error('[generate]', message);
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: message,
    });
  }
});

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));
}

/** Light structural parse for frontend highlighting */
function parsePeelOutput(text) {
  if (!text) return { peels: [], meta: null, raw: '' };

  const peels = [];
  const blockRe =
    /\[P\]\s*([\s\S]*?)(?=\n\s*\[E1\])\s*\[E1\]\s*([\s\S]*?)(?=\n\s*\[E2\])\s*\[E2\]\s*([\s\S]*?)(?=\n\s*\[L\])\s*\[L\]\s*([\s\S]*?)(?=(?:\n\s*\[P\])|(?:\n\s*---)|(?:\n\s*##)|(?:\n\s*###)|$)/gi;

  let m;
  while ((m = blockRe.exec(text)) !== null) {
    peels.push({
      P: m[1].trim(),
      E1: m[2].trim(),
      E2: m[3].trim(),
      L: m[4].trim().split('\n')[0].trim(),
    });
  }

  const metaMatch = text.match(/底层逻辑[：:]\s*(.+)/);
  const modelMatch = text.match(/Model\s*([ABC])\s*[:：]\s*(.+)/i);

  return {
    peels,
    meta: metaMatch ? metaMatch[1].trim() : null,
    model: modelMatch ? { id: modelMatch[1].toUpperCase(), label: modelMatch[2].trim() } : null,
    raw: text,
  };
}

// Production: serve Vite build if present
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
  console.log(`IELTS PEEL Hacker server → http://localhost:${PORT}`);
});
