import { buildPeelPrompt } from '../prompts/peelPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { parsePeelOutput } from '../parsing/peelParser.js';
import { validatePeels, detectEntities } from '../evaluation/validator.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import {
  getRelevantFuel,
  recordPeelResult,
} from '../memory/userMemory.js';
import {
  sanitizeUserInput,
  wrapAsTaskPayload,
} from '../utils/sanitize.js';
import { MAX_INPUT_CHARS } from '../utils/constants.js';

export async function runPeelSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
}) {
  const { clean: safeInput } = sanitizeUserInput(input, {
    maxLen: MAX_INPUT_CHARS,
  });
  const { classification, knowledge: topicKnowledge } = retrieveTopic(safeInput);

  const userFuel = getRelevantFuel(userId, classification?.topicId);
  const fuelHint =
    userFuel.length > 0
      ? `\n[USER E2 FUEL — prefer these personal entities]: ${userFuel
          .map((f) => f.entity)
          .join(' | ')}\n`
      : '';

  const system = buildPeelPrompt({
    topicKnowledge,
    topicId: classification.topicId,
    fuelHint,
  });

  const userMessage = safeInput.trim().startsWith('/peel')
    ? safeInput.trim()
    : `/peel ${safeInput.trim()}`;
  const wrappedUser = wrapAsTaskPayload(userMessage);

  const { content, usage } = await callLLM({
    apiKey,
    baseUrl,
    model,
    system,
    user: wrappedUser,
    history,
  });

  let finalContent = content;
  let finalParsed = parsePeelOutput(content);
  let finalValidation = validatePeels(finalParsed.peels);
  let retries = 0;
  let totalUsage = usage;

  if (
    !finalValidation.passed &&
    finalValidation.allWarnings.length > 0 &&
    finalParsed.peels.length > 0
  ) {
    retries = 1;
    const correctionHint = `Your previous output had these quality issues:\n${finalValidation.allWarnings
      .map((w, i) => `${i + 1}. ${w}`)
      .join(
        '\n'
      )}\n\nPLEASE REGENERATE. Fix all issues. Keep exact [P][E1][E2][L] format.`;

    // Inject failed attempt into history so the model sees its own prior output
    const corrected = await callLLM({
      apiKey,
      baseUrl,
      model,
      system,
      user: correctionHint,
      history: [
        ...history,
        { role: 'user', content: wrappedUser },
        { role: 'assistant', content: finalContent },
      ],
    });

    finalContent = corrected.content;
    finalParsed = parsePeelOutput(finalContent);
    finalValidation = validatePeels(finalParsed.peels);
    if (corrected.usage && totalUsage) {
      totalUsage = {
        prompt_tokens:
          (totalUsage.prompt_tokens || 0) + (corrected.usage.prompt_tokens || 0),
        completion_tokens:
          (totalUsage.completion_tokens || 0) +
          (corrected.usage.completion_tokens || 0),
        total_tokens:
          (totalUsage.total_tokens || 0) + (corrected.usage.total_tokens || 0),
      };
    } else {
      totalUsage = corrected.usage || totalUsage;
    }
  }

  recordPeelResult(userId, {
    topicId: classification.topicId,
    validation: finalValidation,
    command: 'peel',
  });

  const entities = (finalParsed.peels || []).flatMap((p) =>
    detectEntities([p.P, p.E1, p.E2, p.L].join(' '))
  );

  return {
    content: finalContent,
    parsed: finalParsed,
    usage: totalUsage,
    topic: {
      id: classification.topicId,
      score: classification.score,
      matchedKeywords: classification.matchedKeywords,
    },
    validation: finalValidation,
    entities,
    retries,
  };
}
