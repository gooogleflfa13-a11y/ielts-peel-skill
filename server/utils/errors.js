/**
 * Unified API error shape: { error, code, retryable }
 */
export function apiError(res, status, error, { code = 'ERROR', retryable = false } = {}) {
  return res.status(status).json({ error, code, retryable });
}

export function sseError(res, error, { code = 'ERROR', retryable = false } = {}) {
  res.write(
    `data: ${JSON.stringify({ type: 'error', error, code, retryable })}\n\n`
  );
  res.end();
}
