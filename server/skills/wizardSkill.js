import { buildWizardPrompt } from '../prompts/wizardPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { parsePeelOutput } from '../parsing/peelParser.js';
import { validatePeels } from '../evaluation/validator.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import { recordPeelResult, addE2Fuel } from '../memory/userMemory.js';

export async function runWizardSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
}) {
  const { classification, knowledge: topicKnowledge } = retrieveTopic(input);

  const system = buildWizardPrompt({
    topicKnowledge,
    topicId: classification.topicId,
  });

  const userMessage =
    !input.trim() || input.trim() === '/wizard'
      ? '/wizard'
      : input.trim().startsWith('/wizard')
        ? input.trim()
        : `/wizard ${input.trim()}`;

  const { content, usage } = await callLLM({
    apiKey,
    baseUrl,
    model,
    system,
    user: userMessage,
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

  // Heuristic: store short user answers as potential E2 fuel
  if (history.length > 0 && input.trim().length > 8 && input.trim().length < 500) {
    addE2Fuel(userId, {
      topic: classification.topicId || 'General',
      entity: input.trim().slice(0, 120),
      sourceQuestion: 'wizard-turn',
      sourceAnswer: input.trim().slice(0, 200),
    });
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
