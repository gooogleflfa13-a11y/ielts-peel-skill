import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../../server/utils/rateLimit.js';

function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('createRateLimiter', () => {
  it('uses the injected clock to roll a req.ip bucket into a new window', () => {
    let now = 0;
    const next = vi.fn();
    const limit = createRateLimiter({ windowMs: 1_000, max: 1, clock: () => now });
    const req = { ip: '203.0.113.10' };

    limit(req, response(), next);
    const limited = response();
    limit(req, limited, next);
    now = 1_001;
    limit(req, response(), next);

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['Retry-After']).toBe('1');
    expect(limited.body.code).toBe('RATE_LIMITED');
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('evicts expired buckets while processing later requests', () => {
    let now = 0;
    const buckets = new Map();
    const limit = createRateLimiter({
      windowMs: 1_000,
      clock: () => now,
      buckets,
    });

    limit({ ip: '203.0.113.1' }, response(), vi.fn());
    limit({ ip: '203.0.113.2' }, response(), vi.fn());
    now = 1_001;
    limit({ ip: '203.0.113.3' }, response(), vi.fn());

    expect([...buckets.keys()]).toEqual(['203.0.113.3']);
  });
});
