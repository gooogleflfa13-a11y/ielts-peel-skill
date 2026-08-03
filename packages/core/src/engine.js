/**
 * @ielts-peel/core engine — contract-level composition used by the CLI.
 *
 * Implements the deterministic stages declared in contracts/commands.json:
 *   - classify  -> classifyPrompt(text)
 *   - validate  -> reviewPeel(text, { prompt })
 *   - review    -> reviewPeel(...).feedback (+ criterion proxy when `skill` given)
 *
 * No LLM calls happen here; these are pure, deterministic operations.
 */
import { parsePeelOutput, parseLooseLines } from './index.js';
import { validatePeels } from './index.js';
import { buildStructuralFeedback } from './index.js';
import { buildCriterionFeedback } from './index.js';
import { retrieveTopic } from './index.js';

/** Parse a PEEL response with the loose four-line fallback. */
export function parsePeel(text) {
  let parsed = parsePeelOutput(text);
  let peels = parsed.peels;

  if (peels.length === 0) {
    const looseLineCount = String(text || '')
      .split(/\n/)
      .filter((line) => line.trim()).length;
    const loose = looseLineCount === 4 ? parseLooseLines(text) : null;
    if (loose) {
      peels = [loose];
      parsed = { ok: true, peels, meta: null, model: null, raw: text };
    }
  }
  return parsed;
}

/**
 * Deterministic review of a PEEL text (workflow: /review).
 * @param {string} text - labeled or loose 4-line PEEL text
 * @param {{ prompt?: string, skill?: 'writing'|'speaking' }} [options]
 */
export function reviewPeel(text, { prompt, skill = 'writing' } = {}) {
  const parsed = parsePeel(text);
  const validation = validatePeels(parsed.peels, { prompt });
  const structural = buildStructuralFeedback(parsed, validation);
  const criterionFeedback = buildCriterionFeedback({
    skill,
    parseResult: parsed,
    validation,
  });
  return {
    parsed,
    validation,
    feedback: structural.feedback,
    disclaimer: structural.disclaimer,
    criterionFeedback,
  };
}

/**
 * Topic classification (workflow: /peel & /matrix stage 1).
 */
export function classifyPrompt(text) {
  const { classification, knowledge } = retrieveTopic(text);
  return { classification, knowledge };
}
