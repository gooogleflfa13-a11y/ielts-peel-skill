import { buildMatrixPrompt } from '../prompts/matrixPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { parsePeelOutput } from '../parsing/peelParser.js';
import { validatePeels, detectEntities } from '../evaluation/validator.js';
import {
  retrieveTopic,
  matchReductionModel,
} from '../knowledge/topicRetriever.js';
import { recordPeelResult } from '../memory/userMemory.js';

export async function runMatrixSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
}) {
  const { classification, knowledge: topicKnowledge } = retrieveTopic(input);
  const reductionModel = matchReductionModel(input);

  const system = buildMatrixPrompt({
    topicKnowledge,
    topicId: classification.topicId,
    reductionModel,
  });

  const userMessage = input.trim().startsWith('/matrix')
    ? input.trim()
    : `/matrix ${input.trim()}`;

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
  const validation = validatePeels(parsed.peels);

  recordPeelResult(userId, {
    topicId: classification.topicId,
    validation,
    command: 'matrix',
  });

  const entities = (parsed.peels || []).flatMap((p) =>
    detectEntities([p.E2].join(' '))
  );

  return {
    content,
    parsed,
    usage,
    topic: {
      id: classification.topicId,
      score: classification.score,
      matchedKeywords: classification.matchedKeywords,
    },
    reductionModel: {
      id: reductionModel.id,
      name: reductionModel.name,
      score: reductionModel.score,
    },
    validation,
    entities,
    retries: 0,
  };
}
