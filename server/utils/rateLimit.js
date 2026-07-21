/**
 * Simple in-memory IP rate limiter (single-process only).
 * For multi-process (PM2 cluster), use Redis-backed limiter.
 */

const buckets = new Map();

/**
 * @param {{ windowMs?: number, max?: number }} opts
 */
export function createRateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  return function rateLimit(req, res, next) {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      return res.status(429).json({
        error: 'Too many requests. Slow down.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
    }
    next();
  };
}

// periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) {
    if (now - b.start > 120_000) buckets.delete(ip);
  }
}, 60_000).unref?.();
