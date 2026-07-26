import { normalizePublicError, PublicError } from './publicErrors.js';

export function apiError(res, error) {
  const publicError = normalizePublicError(error);
  return res.status(publicError.status).json({
    error: publicError.message,
    code: publicError.code,
    retryable: publicError.retryable,
  });
}

export function sseError(res, error) {
  const publicError = normalizePublicError(error);
  res.write(
    `data: ${JSON.stringify({
      type: 'error',
      error: publicError.message,
      code: publicError.code,
      retryable: publicError.retryable,
    })}\n\n`
  );
  res.end();
}

export function publicError(code) {
  return new PublicError(code);
}
