/**
 * In-memory, single-process rate limiter. Distributed deployments need a
 * shared store, but the client key must still come from Express req.ip.
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 60,
  clock = Date.now,
  buckets = new Map(),
} = {}) {
  let nextSweepAt = null;

  return function rateLimit(req, res, next) {
    const ip = req.ip || 'unknown';
    const now = clock();

    if (nextSweepAt == null) {
      nextSweepAt = now + windowMs;
    } else if (now >= nextSweepAt) {
      for (const [bucketIp, bucket] of buckets) {
        if (now - bucket.start >= windowMs) buckets.delete(bucketIp);
      }
      nextSweepAt = now + windowMs;
    }

    let bucket = buckets.get(ip);

    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.start + windowMs - now) / 1_000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
    }

    next();
  };
}
