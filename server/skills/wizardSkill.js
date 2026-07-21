import { buildWizardPrompt } from '../prompts/wizardPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { parsePeelOutput } from '../parsing/peelParser.js';
import { validatePeels } from '../evaluation/validator.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import { recordPeelResult, addE2Fuel } from '../memory/userMemory.js';
import { sanitizeFuelText, sanitizeUserInput, wrapAsTaskPayload } from '../utils/sanitize.js';
import { MAX_INPUT_CHARS } from '../utils/constants.js';

export async function runWizardSkill({
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

  const system = buildWizardPrompt({
    topicKnowledge,
    topicId: classification.topicId,
  });

  const userMessage =
    !safeInput.trim() || safeInput.trim() === '/wizard'
      ? '/wizard'
      : safeInput.trim().startsWith('/wizard')
        ? safeInput.trim()
        : `/wizard ${safeInput.trim()}`;

  const { content, usage } = await callLLM({
    apiKey,
    baseUrl,
    model,
    system,
    user: wrapAsTaskPayload(userMessage),
    history,
    maxTokens: 3500,
  });

  const parsed = parsePeelOutput(content);
  const validation =
    parsed.peels.length > 0
      ? validatePeels(parsed.peels)
      : {
          passed: true,
          details: [],
          summary: { structure: 0, layers: 0, physical: 0, totalWarnings: 0 },
          allWarnings: [],
        };

  // Store sanitized user answers as E2 fuel (no email/phone; max 300 chars)
  if (history.length > 0) {
    const fuel = sanitizeFuelText(safeInput, { maxLen: 300 });
    if (fuel) {
      addE2Fuel(userId, {
        topic: classification.topicId || 'General',
        entity: fuel.slice(0, 120),
        sourceQuestion: 'wizard-turn',
        sourceAnswer: fuel.slice(0, 200),
      });
    }
  }

  recordPeelResult(userId, {
    topicId: classification.topicId,
    validation,
    command: 'wizard',
  });

  return {
    content,
    parsed,
    usage,
    topic: {
      id: classification.topicId,
      score: classification.score,
      matchedKeywords: classification.matchedKeywords,
    },
    validation,
    entities: [],
    retries: 0,
  };
}
