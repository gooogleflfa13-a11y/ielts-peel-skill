import { createHash, timingSafeEqual } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import { apiError, publicError, sseError } from './utils/errors.js';
import { log } from './utils/logger.js';
import { createRateLimiter } from './utils/rateLimit.js';
import { API_VERSION, COMMANDS, MAX_INPUT_CHARS } from './utils/constants.js';
import {
  createLocalFileMemoryStore,
  createNullMemoryStore,
} from './memory/memoryStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function bankNeedsApiKey(input) {
  return (
    /^\s*\/?bank\s+(peel|answer|答|作答)\b/i.test(input) ||
    (/\bpeel\b/i.test(input) &&
      !/random|search|links|stats|抽题|随机|搜|关联/i.test(input))
  );
}

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function validateBody(body, forcedCommand) {
  const requestBody = body && typeof body === 'object' ? body : {};
  if (hasOwn(requestBody, 'baseUrl')) throw publicError('PROVIDER_URL_NOT_ALLOWED');
  if (requestBody.aiScore === true) throw publicError('AI_SCORE_DISABLED');

  const command = forcedCommand || requestBody.command || 'peel';
  const input = String(requestBody.input || '');
  if (!COMMANDS.includes(command)) throw publicError('INVALID_REQUEST');
  if (input.length > MAX_INPUT_CHARS) throw publicError('INVALID_REQUEST');
  if (!input.trim() && command !== 'wizard' && command !== 'bank') {
    throw publicError('INVALID_REQUEST');
  }

  const needsKey =
    command !== 'score' && !(command === 'bank' && !bankNeedsApiKey(input));
  if (
    needsKey &&
    (typeof requestBody.apiKey !== 'string' || !requestBody.apiKey.trim())
  ) {
    throw publicError('INVALID_REQUEST');
  }

  return {
    apiKey: requestBody.apiKey,
    model: requestBody.model || 'gpt-4o-mini',
    command,
    input,
    history: Array.isArray(requestBody.history) ? requestBody.history : [],
    userId: requestBody.userId || 'default',
    aiScore: false,
  };
}

function tokenMatches(authorization, expectedToken) {
  const suppliedToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const suppliedDigest = createHash('sha256').update(suppliedToken).digest();
  const expectedDigest = createHash('sha256').update(expectedToken).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

export function createApp({
  config,
  runCommand,
  runCommandStream,
  getMetrics,
  memoryStore,
  serveClient = process.env.NODE_ENV === 'production',
} = {}) {
  if (!config || !runCommand || !runCommandStream || !getMetrics) {
    throw new TypeError('createApp requires config and injected runners');
  }

  const app = express();
  const selectedMemoryStore =
    memoryStore ||
    (config.enableLocalMemory
      ? createLocalFileMemoryStore()
      : createNullMemoryStore());
  const enablePrivateQuestionBank =
    config.appMode === 'local' && config.enablePrivateQuestionBank;
  const executionOptions = {
    enablePrivateQuestionBank,
    llmRuntime: {
      baseUrl: config.providerBaseUrl,
      timeoutMs: config.upstreamTimeoutMs,
    },
  };
  app.set('trust proxy', config.trustProxyHops);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-API-Version', API_VERSION);
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(publicError('CORS_FORBIDDEN'));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
    })
  );
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/', createRateLimiter());

  app.get('/api/health', (_req, res) => {
    const memory = process.memoryUsage();
    res.json({
      ok: true,
      agent: 'IELTS PEEL Hacker',
      version: API_VERSION,
      commands: enablePrivateQuestionBank
        ? COMMANDS
        : COMMANDS.filter((command) => command !== 'bank'),
      stream: {
        tokenStreamCommands: ['peel'],
        note: 'Other commands accepted on /stream but complete in one shot.',
      },
      dependencies: {
        memoryRssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        uptimeSec: Math.round(process.uptime()),
      },
    });
  });

  if (config.metricsToken) {
    app.get('/api/metrics', (req, res, next) => {
      if (!tokenMatches(req.get('authorization'), config.metricsToken)) {
        next(publicError('METRICS_UNAUTHORIZED'));
        return;
      }
      res.json({ version: API_VERSION, ...getMetrics() });
    });
  }

  app.post('/api/generate', async (req, res, next) => {
    try {
      const result = await runCommand(
        { ...validateBody(req.body), memoryStore: selectedMemoryStore },
        executionOptions
      );
      if (result.status === 'quality_failed') {
        throw publicError('QUALITY_FAILED');
      }
      res.json({ ...result, version: API_VERSION });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/generate/stream', async (req, res, next) => {
    let body;
    try {
      body = validateBody(req.body);
    } catch (error) {
      next(error);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const controller = new AbortController();
    const onDisconnect = () => {
      controller.abort(new Error('Request disconnected'));
    };
    const cleanup = () => {
      res.removeListener('close', onDisconnect);
    };
    res.once('close', onDisconnect);

    try {
      await runCommandStream(
        {
          ...body,
          memoryStore: selectedMemoryStore,
          signal: controller.signal,
          onChunk(chunk) {
            if (controller.signal.aborted || res.destroyed || res.writableEnded) return;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          },
          onComplete(result) {
            cleanup();
            if (controller.signal.aborted || res.destroyed || res.writableEnded) return;
            res.write(
              `data: ${JSON.stringify({ type: 'complete', version: API_VERSION, ...result })}\n\n`
            );
            res.end();
          },
          onError(error) {
            cleanup();
            if (controller.signal.aborted || res.destroyed || res.writableEnded) return;
            sseError(res, error);
          },
        },
        executionOptions
      );
    } catch (error) {
      cleanup();
      sseError(res, error);
    } finally {
      cleanup();
      if (!res.writableEnded) res.end();
    }
  });

  app.post('/api/score', async (req, res, next) => {
    try {
      const result = await runCommand(
        { ...validateBody(req.body, 'score'), memoryStore: selectedMemoryStore },
        executionOptions
      );
      res.json({ ...result, version: API_VERSION });
    } catch (error) {
      next(error);
    }
  });

  if (serveClient) {
    const distPath = path.join(__dirname, '../client/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'), (error) => {
        if (error && !res.headersSent) next(error);
      });
    });
  }

  app.use((error, _req, res, _next) => {
    const normalizedError =
      error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large'
        ? publicError('INVALID_REQUEST')
        : error;
    log('ERROR', 'unhandled.error', {
      code: normalizedError?.code || 'INTERNAL',
    });
    apiError(res, normalizedError);
  });

  return app;
}
