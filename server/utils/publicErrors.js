const DEFINITIONS = Object.freeze({
  PROVIDER_URL_NOT_ALLOWED: {
    status: 400,
    message: 'Provider URL cannot be set by a request.',
  },
  AI_SCORE_DISABLED: {
    status: 400,
    message: 'AI scoring is disabled.',
  },
  FEATURE_DISABLED: {
    status: 403,
    message: 'This feature is disabled.',
  },
  INVALID_REQUEST: {
    status: 400,
    message: 'The request is invalid.',
  },
  QUALITY_FAILED: {
    status: 422,
    message: 'The generated output did not meet the required structure.',
  },
  CORS_FORBIDDEN: {
    status: 403,
    message: 'This origin is not allowed.',
  },
  RATE_LIMITED: {
    status: 429,
    message: 'Too many requests. Try again later.',
    retryable: true,
  },
  METRICS_UNAUTHORIZED: {
    status: 401,
    message: 'Metrics access is unauthorized.',
  },
  PROVIDER_AUTH_FAILED: {
    status: 401,
    message: 'The provider rejected the supplied credentials.',
  },
  UPSTREAM_RATE_LIMITED: {
    status: 429,
    message: 'The upstream provider is rate limited.',
    retryable: true,
  },
  UPSTREAM_TIMEOUT: {
    status: 504,
    message: 'The upstream provider timed out.',
    retryable: true,
  },
  UPSTREAM_UNAVAILABLE: {
    status: 502,
    message: 'The upstream provider is unavailable.',
    retryable: true,
  },
  INTERNAL: {
    status: 500,
    message: 'Internal server error.',
  },
});

export class PublicError extends Error {
  constructor(code = 'INTERNAL') {
    const definition = DEFINITIONS[code] || DEFINITIONS.INTERNAL;
    const stableCode = DEFINITIONS[code] ? code : 'INTERNAL';
    super(definition.message);
    this.name = 'PublicError';
    this.code = stableCode;
    this.status = definition.status;
    this.retryable = Boolean(definition.retryable);
  }
}

export function normalizePublicError(error) {
  if (error instanceof PublicError) return error;
  if (error?.code && DEFINITIONS[error.code]) return new PublicError(error.code);

  const status = error?.status || error?.response?.status;
  if (status === 401 || status === 403) return new PublicError('PROVIDER_AUTH_FAILED');
  if (status === 429) return new PublicError('UPSTREAM_RATE_LIMITED');
  if (status >= 500 && status < 600) return new PublicError('UPSTREAM_UNAVAILABLE');
  return new PublicError('INTERNAL');
}
