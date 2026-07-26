import { parsePeelOutput, parseLooseLines } from '../parsing/peelParser.js';
import { validatePeels } from '../evaluation/validator.js';
import { buildStructuralFeedback } from '../evaluation/structuralFeedback.js';

/**
 * Review user-pasted PEEL structure deterministically.
 */
export async function runScoreSkill({ input }) {
  let parsed = parsePeelOutput(input);
  let peels = parsed.peels;

  if (peels.length === 0) {
    const looseLineCount = String(input || '')
      .split(/\n/)
      .filter((line) => line.trim()).length;
    const loose = looseLineCount === 4 ? parseLooseLines(input) : null;
    if (loose) {
      peels = [loose];
      parsed = { ok: true, peels, meta: null, model: null, raw: input };
    }
  }

  const validation = validatePeels(peels);
  const review = buildStructuralFeedback(parsed, validation);

  return {
    content: input,
    parsed,
    ...review,
    topic: null,
    retries: 0,
  };
}
