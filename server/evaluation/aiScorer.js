/**
 * Deprecated Phase 0 entry point. AI scoring is intentionally unreachable.
 */
export async function aiSemanticScore() {
  throw Object.assign(new Error('AI scoring is disabled. Use PEEL Structure Review.'), {
    code: 'AI_SCORE_DISABLED',
    status: 400,
  });
}
