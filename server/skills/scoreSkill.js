import { parsePeelOutput, parseLooseLines } from '../parsing/peelParser.js';
import { validatePeels, detectEntities } from '../evaluation/validator.js';
import { aiSemanticScore } from '../evaluation/aiScorer.js';
import { log } from '../utils/logger.js';

/**
 * Score user-pasted PEEL — programmatic by default; optional AI semantic layer.
 */
export async function runScoreSkill({
  input,
  apiKey,
  baseUrl,
  model,
  aiScore = false,
}) {
  let parsed = parsePeelOutput(input);
  let peels = parsed.peels;

  if (peels.length === 0) {
    const loose = parseLooseLines(input);
    if (loose) {
      peels = [loose];
      parsed = { peels, meta: null, model: null, raw: input };
    }
  }

  const validation = validatePeels(peels);
  const entities = peels.flatMap((p) =>
    detectEntities([p.P, p.E1, p.E2, p.L].join(' '))
  );

  let semantic = null;
  let semanticError = null;
  if (aiScore && apiKey && peels[0]) {
    try {
      semantic = await aiSemanticScore(peels[0], { apiKey, baseUrl, model });
    } catch (err) {
      semanticError = err?.message || 'AI semantic score failed';
      log('WARN', 'ai.score.failed', { message: semanticError });
      semantic = null;
    }
  }

  return {
    content: input,
    parsed,
    validation,
    entities,
    semantic,
    semanticError,
    topic: null,
    retries: 0,
  };
}
