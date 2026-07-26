import { describe, expect, it } from 'vitest';
import {
  PublicError,
  normalizePublicError,
} from '../../server/utils/publicErrors.js';

const expectedStatuses = {
  PROVIDER_URL_NOT_ALLOWED: 400,
  AI_SCORE_DISABLED: 400,
  FEATURE_DISABLED: 403,
  INVALID_REQUEST: 400,
  QUALITY_FAILED: 422,
  CORS_FORBIDDEN: 403,
  RATE_LIMITED: 429,
  METRICS_UNAUTHORIZED: 401,
  PROVIDER_AUTH_FAILED: 401,
  UPSTREAM_RATE_LIMITED: 429,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_UNAVAILABLE: 502,
  INTERNAL: 500,
};

describe('public errors', () => {
  it.each(Object.entries(expectedStatuses))(
    'defines stable status and message for %s',
    (code, status) => {
      const error = new PublicError(code);

      expect(error).toMatchObject({ code, status });
      expect(error.message).toEqual(expect.any(String));
      expect(error.message.length).toBeGreaterThan(0);
    }
  );

  it('does not expose upstream details', () => {
    const error = normalizePublicError(
      new Error('sk-secret failed at http://internal:9000')
    );

    expect(JSON.stringify(error)).not.toContain('sk-secret');
    expect(JSON.stringify(error)).not.toContain('internal:9000');
    expect(error.code).toBe('INTERNAL');
  });

  it.each([
    [401, 'PROVIDER_AUTH_FAILED'],
    [403, 'PROVIDER_AUTH_FAILED'],
    [429, 'UPSTREAM_RATE_LIMITED'],
    [503, 'UPSTREAM_UNAVAILABLE'],
  ])('maps upstream status %s to %s', (status, code) => {
    expect(normalizePublicError({ status, message: 'provider detail' }).code).toBe(code);
  });

  it('preserves a documented code while replacing its message', () => {
    const error = normalizePublicError({
      code: 'UPSTREAM_TIMEOUT',
      message: 'private provider URL',
    });

    expect(error.code).toBe('UPSTREAM_TIMEOUT');
    expect(error.message).not.toContain('private provider URL');
  });
});
