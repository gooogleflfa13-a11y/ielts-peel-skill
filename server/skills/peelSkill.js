import { buildPeelPrompt } from '../prompts/peelPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { parsePeelOutput } from '../parsing/peelParser.js';
import { validatePeels, detectEntities } from '../evaluation/validator.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import {
  getRelevantFuel,
  recordPeelResult,
} from '../memory/userMemory.js';

export async function runPeelSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
}) {
  const { classification, knowledge: topicKnowledge } = retrieveTopic(input);

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

  const userMessage = input.trim().startsWith('/peel')
    ? input.trim()
    : `/peel ${input.trim()}`;

  const { content, usage } = await callLLM({
    apiKey,
    baseUrl,
    model,
    system,
    user: userMessage,
    history,
  });

  let finalContent = content;
  let finalParsed = parsePeelOutput(content);
  let finalValidation = validatePeels(finalParsed.peels);
  let retries = 0;

  if (!finalValidation.passed && finalValidation.allWarnings.length > 0 && finalParsed.peels.length > 0) {
    retries = 1;
    const correctionHint = `Your previous output had these quality issues:\n${finalValidation.allWarnings
      .map((w, i) => `${i + 1}. ${w}`)
      .join('\n')}\n\nPLEASE REGENERATE. Fix all issues. Keep exact [P][E1][E2][L] format.`;

    const corrected = await callLLM({
      apiKey,
      baseUrl,
      model,
      system,
      user: `${userMessage}\n\n[CORRECTION INSTRUCTION]\n${correctionHint}`,
      history,
    });

    finalContent = corrected.content;
    finalParsed = parsePeelOutput(finalContent);
    finalValidation = validatePeels(finalParsed.peels);
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
    usage,
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
